/**
 * 가계부의 **오케스트레이션** — 화면과 저장소 사이([[ADR-003]]·[[ADR-005]], [[ADR-094]] 결정 6).
 *
 * 화면은 `storage/` 를 직접 안 부른다(CLAUDE.md 의 CRITICAL 규칙). 여기서 하는 일은 셋이다:
 *
 * ① **행의 신원을 만든다** — `id` 와 `recordedAt`. 어댑터가 만들면 «같은 입력에 같은 SQL» 이
 *    깨져 테스트가 값을 못 박는다(`storage/income.ts` 파일 머리). 그래서 **불순한 자리를 여기
 *    하나로 모은다** — 이 파일이 `Math.random()` 과 `new Date()` 를 부르는 유일한 곳이다.
 * ② **시세를 기억한다** — 메포 지출을 저장할 때 그 시세를 다음 입력의 기본값으로 남긴다
 *    ([[ADR-166]] 결정 5).
 * ③ **여러 원천을 하루로 접는다** — 캘린더 칸이 받는 `CalendarAmounts` 를 만든다. 원천이 넷이고
 *    (손입력 둘 · 보스 결정석 · 아이템 판매) 뒤의 둘은 **여기서 못 고친다**([[ADR-172]] 결정 8).
 */
import { withSqliteFallback } from '../boss-profit/sqlite-guards'
import type { BossDifficulty } from '../../types'
import { compareBossOrder } from '../../lib/boss-matching'
import type { CalendarAmounts, CalendarDayAmounts } from '../../lib/calendar-month'
import { dropPayoutMeso } from '../../lib/drop-price'
import { pointToMeso } from '../../lib/spend-catalog'
import { getBossDropRecords, getBossDropRecordsRevision } from '../../storage/boss-drops'
import { getBossProfitRecordsRevision, getDatedBossProfitRecords } from '../../storage/boss-profit'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { resolveDefeatDates } from '../boss-profit/defeat-dates'
import { useBossProfitStore } from '../boss-profit/store'
import {
  deleteIncomeRecord,
  getIncomeRecordsBetween,
  insertIncomeRecord,
  updateIncomeRecord,
  type IncomeRecord,
} from '../../storage/income'
import { getLastPointRate, setLastPointRate } from '../../storage/last-point-rate'
import {
  deleteSpendRecord,
  getSpendRecordsBetween,
  insertSpendRecord,
  updateSpendRecord,
  type SpendRecord,
} from '../../storage/spend'

export type IncomeDraft = Omit<IncomeRecord, 'id' | 'recordedAt'>
export type SpendDraft = Omit<SpendRecord, 'id' | 'recordedAt'>

/**
 * 행 하나의 신원. **자연키가 없어서** 필요하다 — 손입력은 «같은 날 같은 것을 두 번» 이 정상이다
 * ([[ADR-170]] 결정 2).
 *
 * `crypto.randomUUID` 를 안 쓰는 이유는 Hermes 에 없기 때문이다. 충돌만 안 나면 되는 로컬 키라
 * 시각 + 난수로 충분하다 — 같은 밀리초에 두 번 저장하는 것은 손입력에서 일어나지 않고,
 * 그래도 뒤의 난수가 갈라 준다.
 */
function newRecordId(now: Date): string {
  return `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function recordIncome(draft: IncomeDraft, now: Date): Promise<void> {
  await insertIncomeRecord({ ...draft, id: newRecordId(now), recordedAt: now.toISOString() })
}

export async function recordSpend(draft: SpendDraft, now: Date): Promise<void> {
  await insertSpendRecord({ ...draft, id: newRecordId(now), recordedAt: now.toISOString() })
  // 저장이 성공한 뒤에만 기억한다 — 던진 입력의 시세를 다음 기본값으로 남기면 안 된다.
  if (draft.pointPer100mMeso !== null) {
    await setLastPointRate(draft.pointPer100mMeso)
  }
}

/**
 * 손입력 한 건의 **메소 축 금액**([[ADR-166]] 정정 2 ① · [[ADR-170]] 정정 15).
 *
 * 메소로 낸(번) 것 + 메소마켓 시세로 환산한 메포다. **캐시는 안 든다** — 환산 자체를 안 하므로
 * (현금과 게임 재화의 교환비가 실제로 성립하는 경로가 운영정책 위반 거래다) 캐시가 낀 날은
 * 이 값이 그날의 전부가 아니다. 그 사실은 고른 날의 상세가 따로 말한다.
 *
 * **수입과 지출이 같은 식이다** — 그래야 «수입 − 지출» 이 한 자로 재인다. 두 테이블이 같은 칸
 * 이름을 쓰는 이유가 이것이다(정정 15 결정 3).
 */
export function incomeMesoOf(record: IncomeRecord): number {
  const meso = record.mesoAmount ?? 0
  if (record.pointAmount === null || record.pointPer100mMeso === null) return meso
  return meso + pointToMeso(record.pointAmount, record.pointPer100mMeso)
}

export function spendMesoOf(record: SpendRecord): number {
  const meso = record.mesoAmount ?? 0
  if (record.pointAmount === null || record.pointPer100mMeso === null) return meso
  return meso + pointToMeso(record.pointAmount, record.pointPer100mMeso)
}

function addTo(
  amounts: Record<string, CalendarDayAmounts>,
  dateKey: string,
  delta: Partial<CalendarDayAmounts>,
): void {
  const current = amounts[dateKey] ?? { incomeMeso: 0, expenseMeso: 0 }
  amounts[dateKey] = {
    incomeMeso: current.incomeMeso + (delta.incomeMeso ?? 0),
    expenseMeso: current.expenseMeso + (delta.expenseMeso ?? 0),
  }
}

/**
 * 자동으로 흘러든 하루치 — **캐릭터 하나 × 하루**([[ADR-172]] 결정 7).
 *
 * 보스마다 한 줄이 아니라 이 요약이 한 줄이 된다. [[ADR-171]] 결정 1 의 «한 줄이 한 기록» 에서
 * 보스만 빠지는 이유는 그 규칙의 근거가 «접으면 어느 쪽을 고치는지 못 고른다» 였는데, **보스 줄은
 * 여기서 못 고치기 때문**이다 — 접어도 잃는 것이 없다. 접지 않으면 목요일 한 칸이 캐릭터 수 × 12줄이 된다.
 */
interface BossDaySummary {
  dateKey: string
  ocid: string
  crystalMeso: number
  bossCount: number
  /**
   * 그날 잡은 보스 — 줄을 펼치면 뜨는 타일의 원재료다([[ADR-172]] 정정 1).
   *
   * **새로 읽는 것이 아니다.** `getDatedBossProfitRecords` 가 이미 보스·난이도를 돌려주고 있었고,
   * 그것을 `crystalMeso` 로 접기만 하고 버리던 것을 들고 있게 한 것뿐이다.
   *
   * **마리당 금액을 안 든다**([[ADR-186]]). 「큰 것부터」 정렬에만 쓰던 값인데 순서가 정규 순서로
   * 바뀌며 읽는 곳이 없어졌다 — 타일은 애초에 금액을 안 적는다(파티원 수·정가와 함께 봐야 뜻이
   * 생겨 그 자리가 보스 수익 탭이다).
   */
  bosses: { boss: string; difficulty: BossDifficulty }[]
  dropMeso: number
  dropCount: number
  unpricedCount: number
}

function summaryKey(dateKey: string, ocid: string): string {
  return `${dateKey}|${ocid}`
}

/** 드롭이 짝인 수익 행을 찾는 키 — 넷이 같으면 같은 처치다([[ADR-172]] 결정 6). */
function bossRowKey(record: {
  ocid: string
  boss: string
  difficulty: string
  periodKey: string
}): string {
  return `${record.ocid}|${record.boss}|${record.difficulty}|${record.periodKey}`
}

/**
 * 이 범위(**두 끝 포함**)에 잡은 것으로 밝혀진 보스 수익 — 날짜를 **모르는 기록은 안 든다**
 * ([[ADR-172]] 결정 4). 그것을 어느 칸에 얹으면 그 순간 거짓 날짜가 되고, 주간 보기에서는
 * `period_key` 로 제자리에 서므로 잃는 것은 월간 칸뿐이다.
 *
 * **아무것도 안 읽고 끝나는 길이 둘**이다 — 추적 캐릭터가 없다 · 그 범위에 날짜 붙은 보스 기록이
 * 없다. 후자에서 드롭 조회를 건너뛰는 것이 중요하다: 드롭은 자기 날짜가 없어서 **보스 행이 없으면
 * 어차피 어느 칸에도 못 선다.**
 */
async function loadBossDaySummaries(
  fromDateKey: string,
  toDateKey: string,
): Promise<BossDaySummary[]> {
  const ocids = await getTrackedCharacterOcids().catch(() => null)
  if (ocids === null || ocids.length === 0) {
    return []
  }

  const records = await withSqliteFallback(
    getDatedBossProfitRecords(ocids, fromDateKey, toDateKey),
    [],
  )
  if (records.length === 0) {
    return []
  }

  const summaries = new Map<string, BossDaySummary>()
  function bucketOf(dateKey: string, ocid: string): BossDaySummary {
    const key = summaryKey(dateKey, ocid)
    const existing = summaries.get(key)
    if (existing !== undefined) return existing
    const created: BossDaySummary = {
      dateKey,
      ocid,
      crystalMeso: 0,
      bossCount: 0,
      bosses: [],
      dropMeso: 0,
      dropCount: 0,
      unpricedCount: 0,
    }
    summaries.set(key, created)
    return created
  }

  const dateByBossRow = new Map<string, string>()
  for (const record of records) {
    dateByBossRow.set(bossRowKey(record), record.defeatedOn)
    const bucket = bucketOf(record.defeatedOn, record.ocid)
    bucket.crystalMeso += record.payoutMeso
    bucket.bossCount += 1
    bucket.bosses.push({
      boss: record.boss,
      // 이 컬럼이 드는 값은 다섯뿐이다 — `rows.ts`·`drop-price-store.ts` 가 같은 자리에서 같은 단언을 한다.
      difficulty: record.difficulty as BossDifficulty,
    })
  }

  const periodKeys = [...new Set(records.map((record) => record.periodKey))]
  const drops = await withSqliteFallback(getBossDropRecords(ocids, periodKeys), [])
  for (const drop of drops) {
    // 짝인 수익 행이 없으면 물려받을 날짜가 없다 — 결정석 가격을 모르는 보스가 그렇다.
    const dateKey = dateByBossRow.get(bossRowKey(drop))
    if (dateKey === undefined) continue

    const bucket = bucketOf(dateKey, drop.ocid)
    if (drop.priceState === 'entered') {
      bucket.dropMeso += dropPayoutMeso(drop)
      bucket.dropCount += 1
      continue
    }
    // `'excluded'`(기록 안 함)는 미입력이 아니다 — 사용자가 «안 적겠다» 고 정한 것이라 셈에서 뺀다.
    if (drop.priceState === null) {
      bucket.unpricedCount += 1
    }
  }

  return [...summaries.values()]
}

/**
 * 날짜 범위의 칸 금액 — **두 끝을 포함**한다.
 *
 * 접는 원천이 **넷**이다 — 손입력 둘(`income_records`·`spend_records`)과 보스 둘(결정석 · 아이템
 * 판매). 넷째까지 붙은 것이 **#239**([[ADR-172]])이고, **넷이 전부다** — 다섯째로 예정돼 있던
 * 사냥 타이머 자동 수익은 폐기됐다([[ADR-005]] ⛔, 2026-08-30).
 *
 * **날짜를 모르는 보스 기록은 안 든다**([[ADR-172]] 결정 4) — 어느 칸에 얹으면 그것이 거짓 날짜가
 * 된다. 그런 기록은 주간 보기에서 `period_key` 로 제자리에 서므로, 잃는 것은 월간 칸뿐이다.
 */
export async function loadCalendarAmounts(
  fromDateKey: string,
  toDateKey: string,
): Promise<CalendarAmounts> {
  // **읽기가 실패해도 화면이 죽지 않는다.** 커넥션이 stale 하거나(리로드 직후) 응답이 없으면
  // 빈 값으로 진행하고 다음 방문에서 다시 읽는다 — `features/boss-profit` 이 같은 결함으로
  // «불러오는 중…» 에 영영 멈췄던 자리라 그 처방을 그대로 쓴다(이름이 boss-profit 에 있을 뿐
  // 내용은 SQLite 일반이다). 여기서는 «칸이 0 으로 보인다» 가 그 대가다.
  const [incomes, spends, bossSummaries] = await Promise.all([
    withSqliteFallback(getIncomeRecordsBetween(fromDateKey, toDateKey), []),
    withSqliteFallback(getSpendRecordsBetween(fromDateKey, toDateKey), []),
    loadBossDaySummaries(fromDateKey, toDateKey),
  ])

  const amounts: Record<string, CalendarDayAmounts> = {}
  for (const income of incomes) {
    addTo(amounts, income.earnedOn, { incomeMeso: incomeMesoOf(income) })
  }
  for (const spend of spends) {
    addTo(amounts, spend.spentOn, { expenseMeso: spendMesoOf(spend) })
  }
  for (const summary of bossSummaries) {
    addTo(amounts, summary.dateKey, { incomeMeso: summary.crystalMeso + summary.dropMeso })
  }
  return amounts
}

/**
 * 가계부가 트는 **처치 날짜 캐기**([[ADR-172]] 결정 9) — 캔 건수를 돌려준다. 0 이면 다시 읽을
 * 이유가 없다.
 *
 * 보스 수익 탭도 같은 일을 하지만(그쪽은 동기화 뒤), **한 번도 그 탭을 안 열어도 칸이 채워지도록**
 * 여기서도 튼다. 겹침은 그 함수가 막는다 — 조회 원장과 `inFlight` 둘이다.
 *
 * **던지지 않는다.** 날짜를 못 캔 것은 «칸이 덜 채워진다» 이지 화면이 죽을 일이 아니고, 캘린더
 * 읽기가 실패를 빈 값으로 흡수하는 것과 같은 태도다.
 */
export async function resolveTrackedDefeatDates(now: Date): Promise<number> {
  const ocids = await getTrackedCharacterOcids().catch(() => null)
  if (ocids === null || ocids.length === 0) {
    return 0
  }
  return resolveDefeatDates(ocids, now).catch(() => 0)
}

/**
 * 시트가 고를 수 있는 **캐릭터 목록**([[ADR-166]] 결정 3 — 「캐릭터를 선택해서 입력하는 방법」).
 *
 * 추적 캐릭터만 든다 — 가계부가 보스 줄의 이름을 붙일 때 쓰는 그 경로 그대로다.
 *
 * **이름을 모르는 캐릭터는 안 든다.** `ocid` 는 사용자에게 아무 뜻도 없는 문자열이고([[ADR-172]]
 * 결정 7 과 같은 이유), 「알 수 없음」 은 있지도 않은 캐릭터를 목록에 만든다. 캐시는 캐릭터를 한
 * 번이라도 연 뒤에 찬다.
 *
 * **던지지 않는다** — 못 읽으면 목록이 비고, 그때 고르개는 「선택 안함」 하나만 남는다.
 */
export async function loadTrackedCharacters(): Promise<
  Array<{ ocid: string; name: string; level: number | null }>
> {
  const ocids = await getTrackedCharacterOcids().catch(() => null)
  if (ocids === null || ocids.length === 0) {
    return []
  }
  const named = await Promise.all(
    ocids.map(async (ocid) => {
      const profile = (await getCachedCharacterBasic(ocid).catch(() => null))?.profile
      return {
        ocid,
        name: profile?.name ?? '',
        // **레벨은 사냥 계산기가 쓴다**([[ADR-175]] 결정 6) — 지역을 ±20 으로 거르고 레벨 차이
        // 페널티를 낸다. 캐시가 아직 안 따뜻하면 `null` 이고, 그때는 페널티 없이 계산하며
        // 시트가 그 사실을 한 줄로 말한다. 이름이 없으면 아래에서 걸러지므로 여기서 안 막는다.
        level: profile?.level ?? null,
      }
    }),
  )
  return named.filter((each) => each.name !== '')
}

/**
 * 가계부의 **당겨서 새로고침**([[ADR-170]] 정정 8) — 셋을 차례로 한다.
 *
 * ① **동기화** — 새 처치를 가져온다. 이것이 없으면 오늘 잡은 보스는 기록 자체가 없어서 날짜를
 *    캘 것도 없다(사용자 보고 2026-08-27: «오늘 수익데이터는 있는데 캘린더에 왜 안 찍혀»).
 * ② **날짜 캐기** — 그 기록에 `defeated_on` 을 채운다([[ADR-172]] 결정 9).
 * ③ 다시 읽기는 **화면의 몫**이다 — 이 함수가 끝나면 화면이 표를 올린다.
 *
 * **차례가 계약이다.** ②가 먼저면 그 순간 없는 기록을 캐려 들고, 새로 온 것은 다음 번까지 안 뜬다.
 *
 * 보스 수익 탭의 당김과 **같은 재조회**를 부른다([[ADR-072]] 결정 2 의 태도) — 두 하위 탭이 같은
 * 원천을 보므로 «어느 탭에서 당겼나» 로 결과가 달라지면 안 된다.
 *
 * **던지지 않는다.** 실패를 말하는 것은 그 스토어의 `error` 와 토스트다([[ADR-063]]) — 여기서
 * 다시 말하면 같은 실패가 두 번 뜬다.
 */
export async function refreshCashbook(now: Date): Promise<void> {
  const ocids = await getTrackedCharacterOcids().catch(() => null)
  if (ocids !== null && ocids.length > 0) {
    await useBossProfitStore
      .getState()
      .refresh(ocids)
      .catch(() => undefined)
  }
  await resolveTrackedDefeatDates(now)
}

/**
 * 화면이 «내 숫자가 낡았나» 를 묻는 값([[ADR-189]] 결정 3) — 이 화면이 읽는 두 표의 «판» 을 하나로
 * 접는다. 화면은 다시 들어올 때 이 값이 달라졌을 때만 조회를 다시 튼다.
 *
 * **여기 있는 이유**는 화면이 `storage/` 를 직접 안 부르기 때문이다(CLAUDE.md CRITICAL ·
 * [[ADR-003]]·[[ADR-005]]). 가계부의 모든 조회가 이 파일을 지나므로 리비전만 예외로 두면 그 벽에
 * 구멍이 나고, 원천이 늘 때 화면을 다시 고쳐야 한다.
 *
 * **합인 이유**: 두 수 다 단조 증가라 어느 쪽이 올라도 합이 달라진다. 어느 표가 바뀌었는지는 화면이
 * 알 필요가 없다 — 어차피 넷을 함께 다시 읽는다.
 *
 * **손입력 둘(`income_records`·`spend_records`)은 안 든다**(결정 4) — 쓰는 곳이 이 화면 하나뿐이고
 * 그 자리에서 이미 다시 읽는다. 두 번째 쓰는 쪽이 생기는 날 저장 계층에 한 줄, 여기에 한 항이다.
 */
export function cashbookDataRevision(): number {
  return getBossDropRecordsRevision() + getBossProfitRecordsRevision()
}

/** 다음 입력의 시세 기본값([[ADR-166]] 결정 5). 화면이 `storage/` 를 직접 안 부르게 한 번 감싼다. */
export async function loadLastPointRate(): Promise<number | null> {
  return getLastPointRate().catch(() => null)
}


/**
 * 그날 목록의 **손입력 줄**([[ADR-171]] 결정 1) — 여기서 고치고 지운다.
 *
 * 수입과 지출은 테이블이 갈려 있어([[ADR-170]] 결정 2) 한 목록에 세우려면 어느 쪽인지를 들고
 * 다녀야 한다. 그 표식이 `kind` 다.
 */
interface ManualDayRecordBase {
  /**
   * 그 기록에 붙은 캐릭터의 이름 — **없으면 빈 문자열**이다([[ADR-173]] 결정 16).
   *
   * `ocid` 가 `null`(계정 단위, 기본)이거나 캐시에 이름이 없으면 빈다. 줄은 그때 항목만 적는다.
   */
  characterName: string
}

export type ManualDayRecord =
  | ({ kind: 'income'; record: IncomeRecord } & ManualDayRecordBase)
  | ({ kind: 'spend'; record: SpendRecord } & ManualDayRecordBase)

/** 펼친 결정석 줄의 **타일 하나**([[ADR-172]] 정정 1) — 초상·난이도·이름이 여기서 나온다. */
export interface DefeatedBoss {
  boss: string
  difficulty: BossDifficulty
}

/**
 * 자동 줄이 함께 드는 것 — 캐릭터 하나 × 하루 × 갈래 하나.
 *
 * 두 갈래가 갈라져 있어도 **머리는 같다**: 누가·얼마·몇. 그 셋으로 줄의 겉모습(`recordTitleOf`·
 * `recordMesoOf`)이 나오므로 갈래를 안 물어보고 그린다.
 */
interface AutoDayRecordBase {
  ocid: string
  /** 캐시에 없으면 빈 문자열 — 그때 줄은 갈래 이름만 적는다(`recordTitleOf`). */
  characterName: string
  payoutMeso: number
  /** 결정석이면 «마리», 판매면 «건». */
  count: number
}

/**
 * 결정석 줄 — 누르면 **그 자리에서 펼쳐진다**([[ADR-172]] 정정 1).
 *
 * `bosses` 가 이 갈래에만 있는 것이 곧 «판매 줄은 못 펼친다» 다 — 결정 8 이 시트에 대해 한 것과
 * 같은 장치이고, 화면이 조건을 잘못 쓰면 컴파일 단계에서 걸린다.
 */
export interface BossCrystalDayRecord extends AutoDayRecordBase {
  kind: 'bossCrystal'
  /** 그날 잡은 보스 — **큰 것부터**다(`toAutoRecords`). 비어 있지 않다(이 줄이 서는 조건이다). */
  bosses: readonly DefeatedBoss[]
}

/** 아이템 판매 줄 — 누르면 **보스 수익 탭**이다. 「미입력 n」 이 저쪽에 할 일이 있다고 말한다. */
export interface DropSaleDayRecord extends AutoDayRecordBase {
  kind: 'dropSale'
  /** 값을 아직 안 넣은 드롭 수. `'excluded'`(기록 안 함)는 안 센다. */
  unpricedCount: number
}

/**
 * 그날 목록의 **자동 줄**([[ADR-172]] 결정 7·8) — 보스 수익 탭이 원천이라 **여기서 못 고친다.**
 *
 * 캐릭터당 둘이다. 갈라 두는 이유는 **출처 테이블이 다르기 때문**이고(`boss_profit_records` ·
 * `boss_drop_records`), 합치면 「미입력 n」 을 걸 자리가 없어진다. 갈라 둔 덕에 **누르면 하는 일도
 * 갈린다**(정정 1) — 결정석은 펼치고, 판매는 저쪽으로 간다.
 */
export type AutoDayRecord = BossCrystalDayRecord | DropSaleDayRecord

/**
 * 그날 목록의 한 줄. **갈리는 기준은 테이블**이다([[ADR-172]] 결정 8) — `income_records`·
 * `spend_records` 에서 온 줄이면 손입력이고, 그것이 곧 «여기서 고칠 수 있는가» 의 답이다.
 */
export type DayRecord = ManualDayRecord | AutoDayRecord

/** 이 줄을 여기서 고칠 수 있나([[ADR-171]] 결정 5 = [[ADR-172]] 결정 8). */
export function isManualRecord(entry: DayRecord): entry is ManualDayRecord {
  return entry.kind === 'income' || entry.kind === 'spend'
}

/**
 * 목록의 `key`. 손입력은 행의 `id`(자연키가 없어 만든 신원), 자동 줄은 **갈래 + 캐릭터**다 —
 * 하루에 그 조합이 하나뿐이라 그것이 곧 신원이다.
 */
export function rowKeyOf(entry: DayRecord): string {
  return isManualRecord(entry) ? entry.record.id : `${entry.kind}:${entry.ocid}`
}

/**
 * 그날 적은 것 — **적은 순**이다.
 *
 * 금액순으로 정렬하지 않는 이유는 «방금 적은 것» 이 목록 어디로 튈지 모르기 때문이다. 방금 적은
 * 것이 맨 아래에 있으면 눈이 거기부터 간다.
 *
 * 읽기 실패는 **빈 값으로 진행한다** — 캘린더 칸과 같은 처방이다(`loadCalendarAmounts` 참조).
 * 한쪽만 실패하면 다른 쪽은 보인다.
 */
export async function loadDayRecords(dateKey: string): Promise<DayRecord[]> {
  const [incomes, spends, bossSummaries] = await Promise.all([
    withSqliteFallback(getIncomeRecordsBetween(dateKey, dateKey), []),
    withSqliteFallback(getSpendRecordsBetween(dateKey, dateKey), []),
    loadBossDaySummaries(dateKey, dateKey),
  ])

  /**
   * 이름을 **한 번에** 찾는다 — 손입력 줄과 보스 줄이 같은 캐릭터를 가리킬 수 있다([[ADR-173]]
   * 결정 16). 갈라 부르면 같은 `ocid` 를 두 번 읽는다.
   */
  const names = await namesByOcid([
    ...incomes.flatMap((record) => (record.ocid === null ? [] : [record.ocid])),
    ...spends.flatMap((record) => (record.ocid === null ? [] : [record.ocid])),
    ...bossSummaries.map((summary) => summary.ocid),
  ])
  const nameOf = (ocid: string | null): string => (ocid === null ? '' : (names.get(ocid) ?? ''))

  const manual: ManualDayRecord[] = [
    ...incomes.map(
      (record): ManualDayRecord => ({ kind: 'income', record, characterName: nameOf(record.ocid) }),
    ),
    ...spends.map(
      (record): ManualDayRecord => ({ kind: 'spend', record, characterName: nameOf(record.ocid) }),
    ),
  ].sort((left, right) => left.record.recordedAt.localeCompare(right.record.recordedAt))

  // **자동 줄이 위**다. 그날의 큰 금액이고 손이 닿지 않는 줄이라, 손으로 적은 것 사이에 섞이면
  // «왜 이건 안 눌리지» 가 된다.
  return [...toAutoRecords(bossSummaries, names), ...manual]
}

/**
 * `ocid` → 캐릭터 이름 — **줄에 이름을 붙이는 유일한 자리**다.
 *
 * 자동 줄(보스)과 손입력 줄이 같은 표를 쓴다. 갈라 두면 같은 캐릭터가 한 목록 안에서 다르게
 * 불릴 수 있다.
 *
 * **못 찾으면 빈 문자열**이다 — `ocid` 는 사용자에게 아무 뜻도 없는 문자열이라 그것을 적을 바에
 * 이름을 안 적는다([[ADR-172]] 결정 7). 캐시는 캐릭터를 한 번이라도 연 뒤에 찬다.
 */
async function namesByOcid(ocids: readonly string[]): Promise<Map<string, string>> {
  return new Map(
    await Promise.all(
      [...new Set(ocids)].map(
        async (ocid) =>
          [ocid, (await getCachedCharacterBasic(ocid).catch(() => null))?.profile.name ?? ''] as const,
      ),
    ),
  )
}

/** 요약을 줄로 — 이름은 부르는 쪽이 이미 찾아 둔 표에서 온다(캘린더 칸은 이름이 필요 없다). */
function toAutoRecords(
  summaries: BossDaySummary[],
  names: Map<string, string>,
): AutoDayRecord[] {
  const rows: AutoDayRecord[] = []
  for (const summary of summaries) {
    const characterName = names.get(summary.ocid) ?? ''
    if (summary.bossCount > 0) {
      rows.push({
        kind: 'bossCrystal',
        ocid: summary.ocid,
        characterName,
        payoutMeso: summary.crystalMeso,
        count: summary.bossCount,
        /**
         * **`weekly-bosses.json` 정규 순서**다([[ADR-186]]) — 앱에서 보스 무리가 서는 네 자리가
         * 한 순서를 쓴다. ~~큰 것부터~~([[ADR-172]] 정정 1)는 여기서 죽은 한 줄이고, 「제일 큰
         * 것」 의 자리는 마리당 금액이 실제로 적힌 보스 수익 탭으로 남는다.
         *
         * 비교자가 **완전 결정적**이라 `getDatedBossProfitRecords` 의 조회 순서에 안 기댄다 —
         * 그 SELECT 에는 `ORDER BY` 가 없고([[ADR-036]] 결정 4 가 그렇게 정했다) 앞의 주석은
         * 그 사실과 반대로 «조회 순서는 [[ADR-036]] 이 결정적으로 만든다» 고 적고 있었다.
         */
        bosses: [...summary.bosses].sort(compareBossOrder),
      })
    }
    /**
     * **판 것이 하나라도 있어야 줄이 선다**(사용자 지정 2026-08-29).
     *
     * 종전에는 미입력만 있어도 세웠다 — [[ADR-124]] 가 «가격 미입력이 정상» 이라 정했으니 그 줄이
     * 없으면 «먹은 것 자체가 캘린더에서 사라진다» 는 근거였다. 그런데 **가계부는 돈이 오간 기록을
     * 세는 자리**라, 아직 값이 없는 건이 0원으로 서면 그날의 목록이 그만큼 헐거워진다.
     *
     * **줄이 서면 「미입력 n」 은 그대로 적는다** — 그것은 «항목» 이 아니라 **저쪽에 할 일이
     * 있다**는 표시이고, 그 줄은 이미 판 것이 있어서 선 줄이다([[ADR-172]] 결정 8).
     */
    if (summary.dropCount > 0) {
      rows.push({
        kind: 'dropSale',
        ocid: summary.ocid,
        characterName,
        payoutMeso: summary.dropMeso,
        count: summary.dropCount,
        unpricedCount: summary.unpricedCount,
      })
    }
  }
  return rows
}

const AUTO_LABELS: Record<AutoDayRecord['kind'], string> = {
  bossCrystal: '보스 결정석',
  dropSale: '아이템 판매',
}

/**
 * 줄에 적는 이름 — 손입력은 항목이고, 없으면 **갈래 이름**이다([[ADR-171]] 결정 1).
 *
 * 직접 입력에서 사용처를 비우는 것은 정상이라(«비워 둬도 됩니다») 이름 없는 기록이 실제로 생긴다.
 * 그 줄을 비워 두면 «무엇인지 모르는 줄» 이 되는데, 갈래는 언제나 있으므로 그것을 쓴다.
 *
 * 자동 줄은 **캐릭터 · 갈래**다. 이름을 모르면(캐시가 비었다) **갈래만 적는다** — `ocid` 는
 * 사용자에게 아무 뜻도 없는 문자열이고, 「알 수 없음」 은 있지도 않은 캐릭터를 만들어 낸다.
 */
/**
 * 손입력 줄의 첫 칸 — 적어 둔 이름, 없으면 갈래.
 *
 * **「사냥」만 갈래로 적는다**(사용자 지정 2026-08-29). 거기 적힌 이름은 사냥터인데, 그 줄이
 * 답하는 것은 «오늘 무엇으로 벌었나» 이고 «어느 맵이었나» 는 열어 봐야 뜻이 생기는 값이다
 * (수정 시트가 그것을 든다). 대신 **몇 재획을 돌았나**가 세는 칸에 선다(`recordCountLabelOf`).
 */
function manualLabelOf(entry: ManualDayRecord): string {
  if (entry.kind === 'income' && entry.record.category === '사냥') return entry.record.category
  return entry.record.item ?? entry.record.category
}

export function recordTitleOf(entry: DayRecord): string {
  const label = isManualRecord(entry) ? manualLabelOf(entry) : AUTO_LABELS[entry.kind]
  // **캐릭터가 붙어 있으면 이름이 앞에 선다**([[ADR-173]] 결정 16) — 보스 줄이 이미 쓰던 어법
  // 그대로다. 손입력만 다르게 적으면 한 목록 안에 두 어법이 생긴다.
  return entry.characterName === '' ? label : `${entry.characterName} · ${label}`
}

/** 줄의 **메소 축** 금액. 캐시는 환산을 안 하므로 0 이다([[ADR-166]] 정정 2 ①). */
export function recordMesoOf(entry: DayRecord): number {
  if (!isManualRecord(entry)) return entry.payoutMeso
  return entry.kind === 'income' ? incomeMesoOf(entry.record) : spendMesoOf(entry.record)
}

/**
 * 그날 상세의 **합계 두 줄** — 그날 줄들에서 바로 낸다([[ADR-169]] 정정 5).
 *
 * **칸 금액 표(`loadCalendarAmounts`)를 안 본다.** 그 표는 «지금 격자가 덮는 범위» 것이고 고른
 * 날은 기간을 옮겨도 안 바뀌므로, 표를 보면 그 날이 범위 밖으로 나가는 순간 상세가 통째로
 * 사라진다 — 「그 날 기록이 없다」와 「그 날이 범위 밖이다」가 같은 `undefined` 로 말해진다
 * (사용자 보고 2026-08-26: 8월 25일을 고른 채 7월로 옮기면 「기록이 없어요」가 떴다).
 *
 * **두 길은 같은 수를 낸다** — 수입 = 손입력 + 결정석 + 판매, 지출 = `spendMesoOf`. 그 등식을
 * `records.spec` 이 붙들고 있다(깨지면 칸에 적힌 수와 그 칸을 눌러 나온 수가 갈린다).
 *
 * 캐시로 낸 지출은 **0 을 더한다** — 환산을 안 하므로 메소 축에 얹을 값이 없다([[ADR-166]] 정정 2 ①).
 * 그 사실은 그 줄이 「원」 으로 적히는 것으로 말한다.
 */
export function dayTotalsOf(entries: readonly DayRecord[]): CalendarDayAmounts {
  let incomeMeso = 0
  let expenseMeso = 0
  for (const entry of entries) {
    // 자동 줄은 언제나 수익이다([[ADR-172]] 결정 7) — 갈리는 것은 지출뿐이다.
    if (entry.kind === 'spend') {
      expenseMeso += recordMesoOf(entry)
      continue
    }
    incomeMeso += recordMesoOf(entry)
  }
  return { incomeMeso, expenseMeso }
}

/**
 * 캐시로 낸(번) 줄만 값을 준다 — 그 줄은 메소가 아니라 **원**으로 적힌다.
 *
 * 수입도 같다([[ADR-170]] 정정 15) — 이벤트 보상이 캐시로 들어오는 자리가 있고, 환산을 안 하는
 * 것도 지출과 같은 이유다.
 */
export function recordCashOf(entry: DayRecord): number | null {
  if (entry.kind === 'spend') return entry.record.cashAmount
  return entry.kind === 'income' ? entry.record.cashAmount : null
}

/**
 * 이름과 금액 **사이**에 서는 작은 글자 — 없으면 `null`.
 *
 * 갈래마다 세는 것이 다르다: 지출은 수량(`×2` — 맨 숫자는 «2번째» 로도 읽힌다), 결정석은 마리 수,
 * 판매는 건수와 **미입력 건수**다. 화면이 갈래별로 분기하지 않도록 여기서 한 문자열로 접는다
 * ([[ADR-147]] 결정 8 — 판정과 그리기를 가른다).
 */
export function recordCountLabelOf(entry: DayRecord): string | null {
  if (entry.kind === 'spend') {
    const { quantity } = entry.record
    return quantity !== null && quantity > 1 ? `×${quantity}` : null
  }
  if (entry.kind === 'bossCrystal') {
    return `${entry.count}마리`
  }
  if (entry.kind === 'dropSale') {
    return entry.unpricedCount > 0 ? `${entry.count}건 · 미입력 ${entry.unpricedCount}` : `${entry.count}건`
  }
  /**
   * 사냥은 **몇 재획을 돌았나**다(사용자 지정 2026-08-29) — 보스 줄의 「n마리」와 **같은 자리·같은
   * 모양**이라 화면은 아무것도 안 가른다(그 칸이 하나뿐이다).
   *
   * [[ADR-175]] 이전에 적힌 행은 계산 입력이 없어 셀 것이 없다 — 그때는 칸이 안 선다.
   */
  // `!= null` 인 이유: 계산기 이전 행은 `null` 이고, 옛 저장분을 읽는 자리에서는 칸이 **아예
  // 없을** 수도 있다(`undefined`). 둘 다 «셀 것이 없다» 다.
  if (entry.kind === 'income' && entry.record.hunt != null) {
    return `${entry.record.hunt.sojae}재획`
  }
  return null
}

/**
 * 고치기 — `recordedAt` 은 안 바뀐다([[ADR-171]] 결정 4). 시세를 기억하는 순서는 넣을 때와 같다:
 * **성공한 뒤에만.**
 */
export async function editSpend(record: SpendRecord): Promise<void> {
  await updateSpendRecord(record)
  if (record.pointPer100mMeso !== null) {
    await setLastPointRate(record.pointPer100mMeso)
  }
}

export async function editIncome(record: IncomeRecord): Promise<void> {
  await updateIncomeRecord(record)
}

/** 지우기 — 갈래가 어느 테이블인지를 안다. **손입력만** 받는다([[ADR-172]] 결정 8). */
export async function removeRecord(entry: ManualDayRecord): Promise<void> {
  if (entry.kind === 'spend') {
    await deleteSpendRecord(entry.record.id)
    return
  }
  await deleteIncomeRecord(entry.record.id)
}
