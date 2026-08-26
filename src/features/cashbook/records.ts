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
import type { CalendarAmounts, CalendarDayAmounts } from '../../lib/calendar-month'
import { dropPayoutMeso } from '../../lib/drop-price'
import { pointToMeso } from '../../lib/spend-catalog'
import { getBossDropRecords } from '../../storage/boss-drops'
import { getDatedBossProfitRecords } from '../../storage/boss-profit'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { resolveDefeatDates } from '../boss-profit/defeat-dates'
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
 * 지출 한 건의 **메소 축 금액**([[ADR-166]] 정정 2 ①).
 *
 * 메소로 낸 것 + 메소마켓 시세로 환산한 메포다. **캐시는 안 든다** — 환산 자체를 안 하므로
 * (현금과 게임 재화의 교환비가 실제로 성립하는 경로가 운영정책 위반 거래다) 캐시 지출이 있는 날은
 * 이 값이 그날 지출의 전부가 아니다. 그 사실은 고른 날의 상세가 따로 말한다.
 */
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
   * `payoutMeso` 는 **여기까지만** 산다 — 줄에 실릴 때 정렬에 쓰고 버린다. 마리당 금액은 파티원
   * 수·정가와 함께 봐야 뜻이 생겨(그 자리가 보스 수익 탭이다) 타일이 적지 않는다.
   */
  bosses: { boss: string; difficulty: BossDifficulty; payoutMeso: number }[]
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
      payoutMeso: record.payoutMeso,
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
 * 판매). 넷째까지 붙은 것이 **#239**([[ADR-172]])이고, 남은 것은 사냥 타이머 자동 수익 하나다.
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
    addTo(amounts, income.earnedOn, { incomeMeso: income.mesoAmount })
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
export async function loadTrackedCharacters(): Promise<Array<{ ocid: string; name: string }>> {
  const ocids = await getTrackedCharacterOcids().catch(() => null)
  if (ocids === null || ocids.length === 0) {
    return []
  }
  const named = await Promise.all(
    ocids.map(async (ocid) => ({
      ocid,
      name: (await getCachedCharacterBasic(ocid).catch(() => null))?.profile.name ?? '',
    })),
  )
  return named.filter((each) => each.name !== '')
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
export type ManualDayRecord =
  | { kind: 'income'; record: IncomeRecord }
  | { kind: 'spend'; record: SpendRecord }

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

  const manual: ManualDayRecord[] = [
    ...incomes.map((record): ManualDayRecord => ({ kind: 'income', record })),
    ...spends.map((record): ManualDayRecord => ({ kind: 'spend', record })),
  ].sort((left, right) => left.record.recordedAt.localeCompare(right.record.recordedAt))

  // **자동 줄이 위**다. 그날의 큰 금액이고 손이 닿지 않는 줄이라, 손으로 적은 것 사이에 섞이면
  // «왜 이건 안 눌리지» 가 된다.
  return [...(await toAutoRecords(bossSummaries)), ...manual]
}

/** 요약을 줄로 — 이름을 여기서 붙인다(캘린더 칸은 이름이 필요 없어 그쪽은 안 읽는다). */
async function toAutoRecords(summaries: BossDaySummary[]): Promise<AutoDayRecord[]> {
  const names = new Map(
    await Promise.all(
      [...new Set(summaries.map((summary) => summary.ocid))].map(
        async (ocid) =>
          [ocid, (await getCachedCharacterBasic(ocid).catch(() => null))?.profile.name ?? ''] as const,
      ),
    ),
  )

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
        // **큰 것부터**다([[ADR-172]] 정정 1). 게임 순서로 세우면 «오늘 제일 큰 것이 무엇이었나» 를
        // 눈으로 못 찾는다. 금액이 같으면(가격 미확정 보스끼리 0 이다) 읽은 순서 그대로 둔다 —
        // `sort` 가 안정 정렬이라 그 순서가 조회 순서이고, 조회 순서는 [[ADR-036]] 이 결정적으로 만든다.
        bosses: [...summary.bosses]
          .sort((left, right) => right.payoutMeso - left.payoutMeso)
          .map(({ boss, difficulty }) => ({ boss, difficulty })),
      })
    }
    // 안 판 드롭만 있어도 줄이 선다 — 「미입력」 이 그 줄이 할 말이다([[ADR-124]] 는 «가격 미입력이
    // 정상» 이라 정했고, 그래서 그 줄이 없으면 먹은 것 자체가 캘린더에서 사라진다).
    if (summary.dropCount > 0 || summary.unpricedCount > 0) {
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
export function recordTitleOf(entry: DayRecord): string {
  if (!isManualRecord(entry)) {
    const label = AUTO_LABELS[entry.kind]
    return entry.characterName === '' ? label : `${entry.characterName} · ${label}`
  }
  return entry.record.item ?? entry.record.category
}

/** 줄의 **메소 축** 금액. 캐시는 환산을 안 하므로 0 이다([[ADR-166]] 정정 2 ①). */
export function recordMesoOf(entry: DayRecord): number {
  if (!isManualRecord(entry)) return entry.payoutMeso
  return entry.kind === 'income' ? entry.record.mesoAmount : spendMesoOf(entry.record)
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

/** 캐시로 낸 지출만 값을 준다 — 그 줄은 메소가 아니라 **원**으로 적힌다. */
export function recordCashOf(entry: DayRecord): number | null {
  return entry.kind === 'spend' ? entry.record.cashAmount : null
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
