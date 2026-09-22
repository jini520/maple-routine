import { notifyAfterBatch } from './record-revision-batch'
import { getBossProfitDb } from './sqlite/db'
import type { BossCycle } from '../types/scheduler'

export interface BossProfitRecord {
  ocid: string
  /** 보스 key. 기본키에 든다. */
  bossKey: string
  /** 기록할 때의 보스 이름. 보이는 이름은 key 로 보스 표에서 찾고, 표에서 빠진 보스일 때만 이 값을 쓴다. */
  boss: string
  /** 난이도 key(`easy` 등). */
  difficulty: string
  cycle: BossCycle
  periodKey: string
  partySize: number
  priceMeso: number
  payoutMeso: number
  /** 그 건의 결정석 분배 비율. `null` 이면 파티 인원으로 균등이라 옛 기록이 그대로 맞는다. */
  crystalMyShare: number | null
  crystalSharesTotal: number | null
  /** 차액 송금의 수수료율 스냅샷. `null` 은 3 이다. */
  splitFeePercent: number | null
  recordedAt: string // ISO 8601
  /**
   * 기록 시점의 월드 스냅샷. `null` 이면 "월드 모름"이고 월드별 결정석 집계에서
   * 제외된다.
   *
   * 파생값(캐시된 `character/basic` 의 `world_name`)으로 두면 **월드 리프가 모든 과거 주의 귀속을
   * 소급 이동**시킨다. 분모(`90 × 월드 수`)까지 바뀐다. 판매 한도가 월드마다 따로 산정된다는
   * 사실(사용자 확인)과 정면으로 어긋나므로 기록에 박아 고정한다.
   */
  world: string | null
  /** 기록 시점의 월드 key. 집계는 이 값으로 가른다. `world` 가 `null` 이거나 월드 표에 없으면 `null` 이다 */
  worldKey: string | null
  /**
   * 며칟날 잡았나(KST `YYYY-MM-DD`). 모르면 `null`.
   *
   * 가계부의 월간 칸이 첫 소비자였고, 이제 **월간 보스를 어느 주에 세울지**도 이 값이 정한다
   * (`lib/boss/monthly-boss-week`). 월간 기록의 `period_key` 는 달이라 그 자체로는 주를 못 든다.
   *
   * **읽을 때는 언제나 있고 쓸 때는 없다.** `upsertBossProfitRecord` 는 이 칸을 안 건드린다.
   * 날짜는 나중에 `setBossProfitDefeatedOn` 이 따로 채운다. 그래서 옵셔널이다.
   */
  defeatedOn?: string | null
  /**
   * 누가 썼나. `auto` 는 동기화가 쓴 기록이고 `manual` 은 사용자가 직접 적은 완료다.
   *
   * 칸이 생기기 전 기록은 `NULL` 이라 읽을 때 `auto` 로 본다. 이 값이 바꾸는 것은 표식 · 수정 ·
   * 취소가 붙는가 하나이고, 세는 방법은 자동 기록과 한 글자도 다르지 않다.
   */
  source?: BossProfitRecordSource
}

/** 기록을 쓴 주체. */
export type BossProfitRecordSource = 'auto' | 'manual'

const UPSERT_SQL = `
  INSERT INTO boss_profit_records
    (ocid, boss_key, boss, difficulty, cycle, period_key, party_size, price_meso, payout_meso,
     crystal_my_share, crystal_shares_total, split_fee_percent, recorded_at, world, world_key, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(ocid, boss_key, difficulty, period_key) DO UPDATE SET
    source = excluded.source,
    boss = excluded.boss,
    cycle = excluded.cycle,
    party_size = excluded.party_size,
    price_meso = excluded.price_meso,
    payout_meso = excluded.payout_meso,
    crystal_my_share = excluded.crystal_my_share,
    crystal_shares_total = excluded.crystal_shares_total,
    split_fee_percent = excluded.split_fee_percent,
    recorded_at = excluded.recorded_at,
    -- 월드는 아는 값이 있을 때만 덮어쓴다. 파티원 수 수정처럼 월드를 모르는 경로에서 upsert가
    -- 일어나도(그때 world를 null로 넘긴다) 이미 박아둔 스냅샷을 지우지 않는다.
    world = COALESCE(excluded.world, boss_profit_records.world),
    world_key = COALESCE(excluded.world_key, boss_profit_records.world_key)
`

/**
 * `boss_profit_records` 가 바뀔 때마다 오르는 수. **이 표를 캐시하는 쪽이 **내 스냅샷이 낡았나** 를
 * 물을 수 있게** 하는 값이다. `storage/boss-drops` 의 그것과 같은 물건이고
 * 같은 규칙을 따른다.
 *
 * **쓰기 셋 전부에서 오른다**. 이 쓰기는 저쪽이 안 읽는 칸이다 로 고르지 않는다. 그 판단은
 * 읽는 쪽이 늘 때마다 다시 해야 하고, 한 번 틀리면 증상이 가끔 안 맞는다 로 나타나 잡기 어렵다.
 * 이 수의 뜻은 ****이 표가 바뀌었다** 하나**다.
 *
 * **영속화하지 않는다.** 프로세스와 함께 사라지는 것이 맞다. 앱을 다시 켜면 어느 캐시든 비어 있다.
 */
let recordsRevision = 0
const revisionListeners = new Set<() => void>()

export function getBossProfitRecordsRevision(): number {
  return recordsRevision
}

/**
 * 판이 오를 때 부를 함수를 건다. 풀 함수를 돌려준다.
 *
 * `storage/boss-drops` 의 같은 이름 함수와 같은 물건이다. 쓰기마다 곧바로 다시 읽어야 하는 쪽이 쓴다.
 */
export function subscribeBossProfitRecordsRevision(listener: () => void): () => void {
  revisionListeners.add(listener)
  return () => {
    revisionListeners.delete(listener)
  }
}

function notifyRevisionListeners(): void {
  for (const listener of revisionListeners) listener()
}

function bumpRecordsRevision(): void {
  recordsRevision += 1
  notifyAfterBatch(notifyRevisionListeners)
}

/** 테스트 전용. 모듈 수준 상태라 테스트끼리 오염된다. 프로덕션에서 부르지 말 것. */
export function resetBossProfitRecordsRevisionForTests(): void {
  recordsRevision = 0
}

export async function upsertBossProfitRecord(record: BossProfitRecord): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(UPSERT_SQL, [
    record.ocid,
    record.bossKey,
    record.boss,
    record.difficulty,
    record.cycle,
    record.periodKey,
    record.partySize,
    record.priceMeso,
    record.payoutMeso,
    // SQLite 바인딩은 undefined 를 못 받는다. 칸이 없는 옛 픽스처도 NULL 로 떨어뜨린다.
    record.crystalMyShare ?? null,
    record.crystalSharesTotal ?? null,
    record.splitFeePercent ?? null,
    record.recordedAt,
    record.world,
    record.worldKey,
    record.source ?? 'auto',
  ])
  // **쓰기가 끝난 뒤**에 올린다. 중간에 던지면 표가 안 바뀐 것이라, 그때 올리면 읽는 쪽이 헛일한다.
  bumpRecordsRevision()
}

const FILL_MISSING_WORLD_SQL = `
  UPDATE boss_profit_records SET world = ?, world_key = ? WHERE ocid = ? AND world IS NULL
`

/**
 * `world` 가 비어 있는 기존 기록을 지금 아는 월드로 채우는 보정.
 *
 * 컬럼을 새로 더했으므로 그전 기록에는 월드가 없다. `NULL` 로 두면 안전하지만 기존 사용자의 과거 주
 * 결정석 칩이 통째로 사라지고, 현재 월드로 채우면 **이미 리프한 캐릭터의 과거만** 잘못 고정된다.
 * 아직 실사용자가 없어(사용자 확인) 후자를 택했다. **배포 후에는 할 수 없는 선택이므로
 * 지금 하지 않으면 비용이 커진다.**
 *
 * `world IS NULL` 조건이 멱등성을 보장한다. 한 번 채워진 기록은 이후 호출에 걸리지 않으므로 리프
 * 후에 다시 실행돼도 과거 스냅샷을 덮어쓰지 않는다.
 */
export async function fillMissingRecordWorlds(
  worldByOcid: Map<string, { world: string; worldKey: string | null }>,
): Promise<void> {
  if (worldByOcid.size === 0) {
    return
  }
  const db = await getBossProfitDb()
  for (const [ocid, { world, worldKey }] of worldByOcid) {
    await db.run(FILL_MISSING_WORLD_SQL, [world, worldKey, ocid])
  }
  bumpRecordsRevision()
}

function rowToRecord(row: Record<string, unknown>): BossProfitRecord {
  return {
    ocid: row.ocid as string,
    bossKey: row.boss_key as string,
    boss: row.boss as string,
    difficulty: row.difficulty as string,
    cycle: row.cycle as BossCycle,
    periodKey: row.period_key as string,
    partySize: row.party_size as number,
    priceMeso: row.price_meso as number,
    payoutMeso: row.payout_meso as number,
    crystalMyShare: (row.crystal_my_share as number | null | undefined) ?? null,
    crystalSharesTotal: (row.crystal_shares_total as number | null | undefined) ?? null,
    splitFeePercent: (row.split_fee_percent as number | null | undefined) ?? null,
    recordedAt: row.recorded_at as string,
    // 컬럼을 더하기 전 기록에는 없다. undefined도 null로 정규화해 호출부가 한 형태만 다루게 한다.
    world: (row.world as string | null | undefined) ?? null,
    worldKey: (row.world_key as string | null | undefined) ?? null,
    defeatedOn: (row.defeated_on as string | null | undefined) ?? null,
    // 칸이 생기기 전 기록은 `NULL` 이다. 그때는 전부 동기화가 쓴 것이었다.
    source: row.source === 'manual' ? 'manual' : 'auto',
  }
}

/**
 * 기록을 하나라도 남긴 캐릭터. **추적 목록과 무관하다.**
 *
 * 화면이 `누구의 것을 그릴까` 를 추적 목록에 물으면, 캐릭터를 관리 목록에서 빼는 순간 지운 적
 * 없는 과거 수익이 통째로 사라진다. 기록 자신이 그 답을 갖는다.
 *
 * **드롭 표까지 훑는다.** 결정석 가격을 모르는 보스는 수익 행이 안 남고 드롭만 남아, 수익 표만
 * 보면 그 캐릭터가 드롭 히스토리에서 사라진다.
 *
 * 기간으로 안 자른다. 자르면 부르는 자리마다 어느 기간 키를 넣을지를 다시 정해야 하고(월간 탭은
 * 그 달의 주차 키까지), 안 잘라도 행은 어차피 기록이 있는 기간에만 선다.
 */
export async function getRecordedCharacterOcids(): Promise<string[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT ocid FROM boss_profit_records UNION SELECT ocid FROM boss_drop_records`,
  )

  return (values ?? []).map((row) => row.ocid as string)
}

export async function getBossProfitRecords(
  ocids: string[],
  periodKeys: string[],
): Promise<BossProfitRecord[]> {
  if (ocids.length === 0 || periodKeys.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const periodKeyPlaceholders = periodKeys.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT * FROM boss_profit_records WHERE ocid IN (${ocidPlaceholders}) AND period_key IN (${periodKeyPlaceholders})`,
    [...ocids, ...periodKeys],
  )

  return (values ?? []).map(rowToRecord)
}

/**
 * 그 달에서 **주간 기록이 있는 주차**들. 오름차순이다.
 *
 * 날짜를 모르는 월간 보스를 어느 주에 세울지를 이것이 고른다(`resolveUndatedWeek`). 기록이 없는
 * 주는 이전 기간 게이트에 막혀 열리지 않으므로, 거기에 세우면 금액이 못 가는 자리에 갇힌다.
 *
 * @param monthKey `YYYY-MM`. 주간 `period_key` 는 `YYYY-MM-DD` 라 앞 7자가 그 달이다
 */
export async function getWeeklyPeriodKeysWithRecords(
  ocids: string[],
  monthKey: string,
): Promise<string[]> {
  if (ocids.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const placeholders = ocids.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT DISTINCT period_key FROM boss_profit_records
     WHERE ocid IN (${placeholders}) AND cycle = 'weekly' AND substr(period_key, 1, 7) = ?
     ORDER BY period_key`,
    [...ocids, monthKey],
  )

  return (values ?? []).map((row) => row.period_key as string)
}

/**
 * 기록이 있는 **가장 가까운 기간**. 없으면 `null`.
 *
 * 화살표가 한 칸씩 걸으면 오래 쉬었다 돌아온 사용자가 예전 기록에 닿는 데 수십 번이 든다.
 * 그 사이는 전부 조회 불가라 같은 화면이다. 여기서 착지할 곳을 바로 낸다.
 *
 * **부등호를 SQL 에 맡긴다.** 키를 열거해 훑으면 목록이 몇 백 개가 되고, `MAX`/`MIN` 하나면
 * 끝난다.
 *
 * `tab` 이 기준을 정한다. 주간 탭은 weekly 기록만 보고, 월간 탭은 monthly 기록과 그 달에 속한
 * weekly 기록을 함께 본다. weekly `period_key` 는 `YYYY-MM-DD` 라 앞 7자가 그 달이다.
 *
 * @param direction `prev` 는 이 키보다 앞선 것 중 가장 큰 것, `next` 는 뒤선 것 중 가장 작은 것
 */
export async function findAdjacentPeriodKeyWithRecords(
  ocids: string[],
  tab: BossCycle,
  periodKey: string,
  direction: 'prev' | 'next',
): Promise<string | null> {
  if (ocids.length === 0) {
    return null
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const pick = direction === 'prev' ? 'MAX' : 'MIN'
  const compare = direction === 'prev' ? '<' : '>'
  // 월간은 두 축의 키가 모양이 달라 weekly 를 달로 접은 뒤 비교한다. 그래야 `MAX` 가 한 축에서만
  // 답을 고르지 않는다.
  const expression =
    tab === 'monthly' ? `${pick}(substr(period_key, 1, 7))` : `${pick}(period_key)`
  const condition =
    tab === 'monthly'
      ? `((cycle = 'monthly' AND period_key ${compare} ?) OR (cycle = 'weekly' AND substr(period_key, 1, 7) ${compare} ?))`
      : `(cycle = 'weekly' AND period_key ${compare} ?)`
  const parameters = tab === 'monthly' ? [...ocids, periodKey, periodKey] : [...ocids, periodKey]

  const { values } = await db.query(
    `SELECT ${expression} AS period_key FROM boss_profit_records
      WHERE ocid IN (${ocidPlaceholders}) AND ${condition}`,
    parameters,
  )

  // 행이 없어도 집계 함수는 한 줄을 주고 그 값이 NULL 이다.
  const found = values?.[0]?.period_key
  return typeof found === 'string' ? found : null
}

/**
 * 월간 기록의 **처치일**들. 중복 없이, 날짜를 모르는 기록은 빼고 준다.
 *
 * 주간 화살표가 이 값으로 월간 처치가 선 주를 찾는다. 월간 기록의 `period_key` 는 달이라
 * 주간 키 비교에 안 걸리고, 그대로 두면 화살표가 못 여는 주에 그 금액이 갇힌다.
 */
export async function getMonthlyDefeatDates(ocids: string[]): Promise<string[]> {
  if (ocids.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT DISTINCT defeated_on FROM boss_profit_records
      WHERE ocid IN (${ocidPlaceholders}) AND cycle = 'monthly' AND defeated_on IS NOT NULL`,
    [...ocids],
  )

  return (values ?? [])
    .map((row) => (row as Record<string, unknown>).defeated_on)
    .filter((date): date is string => typeof date === 'string')
}

/** `boss_profit_records` 한 행을 식별하는 키(금액·파티원 수 없음). */
export interface BossProfitRecordKey {
  ocid: string
  bossKey: string
  difficulty: string
  periodKey: string
}

/**
 * 이 캐릭터들의 전 기간 수익 기록 키.
 *
 * 드롭 히스토리는 "그 난이도에서 획득 불가한 기록"을 표시 단계에서 거르는데, **처치 난이도가 확정된
 * 조합에만** 걸어야 한다. 확정 전 행에 걸면 익스트림으로 등록해두고 하드를 잡은 경우처럼 나중에
 * 이관되어 살아남을 기록을 미리 숨긴다. 이 테이블에 행이 있다는 것이 곧 그
 * 확정이므로(자동 기록은 완료 행만 만든다) 키만 알면 된다.
 */
export async function getAllBossProfitRecordKeys(ocids: string[]): Promise<BossProfitRecordKey[]> {
  if (ocids.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT ocid, boss_key, difficulty, period_key FROM boss_profit_records WHERE ocid IN (${ocidPlaceholders})`,
    [...ocids],
  )

  return (values ?? []).map((row) => ({
    ocid: (row as Record<string, unknown>).ocid as string,
    bossKey: (row as Record<string, unknown>).boss_key as string,
    difficulty: (row as Record<string, unknown>).difficulty as string,
    periodKey: (row as Record<string, unknown>).period_key as string,
  }))
}

/**
 * 날짜가 붙은 수익 기록. **가계부 캘린더가 읽는 모양**.
 *
 * `BossProfitRecord` 를 안 쓰는 이유는 필요한 칸이 다르기 때문이다. 캘린더는 누가 · 무엇을 ·
 * 며칟날 · 얼마 만 쓰고 파티원 수·정가·월드는 안 본다. 그리고 `defeated_on IS NOT NULL` 로 걸러
 * 읽으므로 **여기서 그 칸은 nullable 이 아니다**. 화면이 모름 분기를 들 필요가 없다.
 */
export interface DatedBossProfitRecord {
  ocid: string
  bossKey: string
  /** 기록할 때의 보스 이름. */
  boss: string
  difficulty: string
  periodKey: string
  payoutMeso: number
  defeatedOn: string
}

/**
 * 이 날짜 범위(**두 끝 포함**)에 잡은 것으로 **밝혀진** 기록.
 *
 * 날짜를 모르는 기록(`defeated_on IS NULL`)은 **안 나온다.** 그것을 어느 칸에 얹으면 그 순간
 * 거짓 날짜가 되기 때문이다. 주간 보기에서는 `period_key` 로 제자리에 서므로
 * 잃는 것은 월간 칸뿐이다.
 */

export async function getDatedBossProfitRecords(
  ocids: string[],
  fromDateKey: string,
  toDateKey: string,
): Promise<DatedBossProfitRecord[]> {
  if (ocids.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT ocid, boss_key, boss, difficulty, period_key, payout_meso, defeated_on
       FROM boss_profit_records
      WHERE ocid IN (${ocidPlaceholders})
        AND defeated_on IS NOT NULL
        AND defeated_on BETWEEN ? AND ?`,
    [...ocids, fromDateKey, toDateKey],
  )

  return (values ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      ocid: record.ocid as string,
      bossKey: record.boss_key as string,
      boss: record.boss as string,
      difficulty: record.difficulty as string,
      periodKey: record.period_key as string,
      payoutMeso: record.payout_meso as number,
      defeatedOn: record.defeated_on as string,
    }
  })
}

/** 아직 날짜를 모르는 기록. **캐낼 대상**이다. */
export interface UndatedBossProfitRecord {
  ocid: string
  bossKey: string
  boss: string
  difficulty: string
  cycle: BossCycle
  periodKey: string
}

/**
 * 이 기간들 안에서 아직 날짜를 모르는 기록.
 *
 * **기간을 반드시 받는다.** 걸지 않으면 영영 캘 수 없는 옛 기록 까지 끌어와 매번 훑게 되는데,
 * 캘 수 있는 범위는 조회 창(오늘−13)이 이미 정한다. 호출부가 그 창에서 기간을
 * 만들어 넘긴다.
 */
export async function getUndatedBossProfitRecords(
  ocids: string[],
  periodKeys: string[],
): Promise<UndatedBossProfitRecord[]> {
  if (ocids.length === 0 || periodKeys.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const periodKeyPlaceholders = periodKeys.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT ocid, boss_key, boss, difficulty, cycle, period_key
       FROM boss_profit_records
      WHERE ocid IN (${ocidPlaceholders})
        AND period_key IN (${periodKeyPlaceholders})
        AND defeated_on IS NULL`,
    [...ocids, ...periodKeys],
  )

  return (values ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      ocid: record.ocid as string,
      bossKey: record.boss_key as string,
      boss: record.boss as string,
      difficulty: record.difficulty as string,
      cycle: record.cycle as BossCycle,
      periodKey: record.period_key as string,
    }
  })
}

/**
 * 이 ocid 의 **주기별 가장 이른 기간 키**. 기록이 없는 주기는 안 든다.
 *
 * 월드 리프로 새로 생긴 ocid 는 리프 전 날짜를 못 불러 그 앞 기간 기록을 가질 수 없다. 그래서 이
 * 값이 리프한 주와 그 달이다. 주간 `YYYY-MM-DD` · 월간 `YYYY-MM` 은 문자열 순서가 날짜 순서다.
 */
export async function getEarliestBossProfitPeriodKeys(
  ocid: string,
): Promise<Partial<Record<BossCycle, string>>> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT cycle, MIN(period_key) AS period_key FROM boss_profit_records WHERE ocid = ? GROUP BY cycle`,
    [ocid],
  )
  const earliest: Partial<Record<BossCycle, string>> = {}
  for (const row of values ?? []) {
    earliest[row.cycle as BossCycle] = row.period_key as string
  }
  return earliest
}

/** 기록 한 행을 지운다. 짝인 드롭은 안 건드리므로 부르는 쪽이 먼저 옮기거나 지운다. */
export async function deleteBossProfitRecord(key: BossProfitRecordKey): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(
    `DELETE FROM boss_profit_records WHERE ocid = ? AND boss_key = ? AND difficulty = ? AND period_key = ?`,
    [key.ocid, key.bossKey, key.difficulty, key.periodKey],
  )
  bumpRecordsRevision()
}

/**
 * 캐낸 날짜를 박는 쓰기. **upsert 를 안 탄다**.
 *
 * `upsertBossProfitRecord` 는 이 칸을 아예 안 적는다(INSERT 목록에도 `DO UPDATE SET` 에도 없다).
 * 그래서 자동 기록이 몇 번을 다시 돌아도 캐 놓은 날짜를 지우지 못한다. `world` 가 `COALESCE` 로
 * 지키는 것과 같은 보호를, 여기서는 **적지 않는 것**으로 얻는다.
 */
export async function setBossProfitDefeatedOn(
  key: BossProfitRecordKey,
  defeatedOn: string,
): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(
    `UPDATE boss_profit_records SET defeated_on = ?
      WHERE ocid = ? AND boss_key = ? AND difficulty = ? AND period_key = ?`,
    [defeatedOn, key.ocid, key.bossKey, key.difficulty, key.periodKey],
  )
  bumpRecordsRevision()
}


/**
 * 사용자가 적은 완료를 **동기화가 쓴 것으로 내린다**. 표식만 걷고 값은 한 칸도 안 건드린다.
 *
 * 넥슨이 같은 난이도 완료를 뒤늦게 주면 그 기록은 더 이상 **사용자만 아는 것** 이 아니다. 날짜 ·
 * 파티 인원 · 금액을 그대로 두는 것은 사용자가 적은 값이 더 정확하기 때문이다(사용자 지정).
 *
 * 이미 `auto` 인 행에는 아무 일도 안 일어난다(`WHERE source = 'manual'`).
 */
export async function markBossProfitRecordAuto(key: BossProfitRecordKey): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(
    `UPDATE boss_profit_records SET source = 'auto'
      WHERE ocid = ? AND boss_key = ? AND difficulty = ? AND period_key = ? AND source = 'manual'`,
    [key.ocid, key.bossKey, key.difficulty, key.periodKey],
  )
  // 바꾼 행이 없어도 판을 올린다. 포트의 `run` 이 바뀐 행 수를 안 돌려줘 물어볼 길이 없고, 판의
  // 뜻은 **이 표가 바뀌었을 수 있다** 라 한 번 더 읽는 쪽이 안전하다.
  bumpRecordsRevision()
}

/**
 * 이 (캐릭터, 보스, 기간)에 **난이도를 안 가리고** 기록이 있나.
 *
 * 한 주에 한 보스를 두 난이도로 잡을 수 없다는 게임 규칙이라(사용자 확인) 난이도가 다른 기록이
 * 한 줄 더 써지면 같은 처치를 두 번 세게 된다. 기록을 쓰는 두 자리가 이것을 먼저 묻는다.
 */
export async function hasBossProfitRecordInPeriod(
  ocid: string,
  bossKey: string,
  periodKey: string,
): Promise<boolean> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT 1 FROM boss_profit_records
      WHERE ocid = ? AND boss_key = ? AND period_key = ? LIMIT 1`,
    [ocid, bossKey, periodKey],
  )
  return (values ?? []).length > 0
}

/** 직접 적은 완료 한 줄의 신원. 표시 판정이 `bossKey|difficulty` 로 접어 쓴다. */
export interface ManualBossProfitRecordKey {
  ocid: string
  bossKey: string
  difficulty: string
  periodKey: string
}

/**
 * 사용자가 직접 적은 완료의 키만 읽는다. **금액·파티원 수는 안 읽는다.**
 *
 * 스케줄러 화면과 today 는 완료 여부만 알면 되고, 그 둘이 기록 전체를 들면 화면이 안 쓰는 값을
 * 기간마다 나른다. 보스 수익은 어차피 기록 전체를 따로 읽는다.
 */
export async function getManualBossProfitRecordKeys(
  ocids: string[],
  periodKeys: string[],
): Promise<ManualBossProfitRecordKey[]> {
  if (ocids.length === 0 || periodKeys.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const periodPlaceholders = periodKeys.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT ocid, boss_key, difficulty, period_key FROM boss_profit_records
      WHERE ocid IN (${ocidPlaceholders}) AND period_key IN (${periodPlaceholders}) AND source = 'manual'`,
    [...ocids, ...periodKeys],
  )

  return (values ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      ocid: record.ocid as string,
      bossKey: record.boss_key as string,
      difficulty: record.difficulty as string,
      periodKey: record.period_key as string,
    }
  })
}
