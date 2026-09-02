import { getBossProfitDb } from './sqlite/db'
import type { BossCycle } from '../types/scheduler'

export interface BossProfitRecord {
  ocid: string
  boss: string
  difficulty: string
  cycle: BossCycle
  periodKey: string
  partySize: number
  priceMeso: number
  payoutMeso: number
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
}

const UPSERT_SQL = `
  INSERT INTO boss_profit_records
    (ocid, boss, difficulty, cycle, period_key, party_size, price_meso, payout_meso, recorded_at, world)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(ocid, boss, difficulty, period_key) DO UPDATE SET
    cycle = excluded.cycle,
    party_size = excluded.party_size,
    price_meso = excluded.price_meso,
    payout_meso = excluded.payout_meso,
    recorded_at = excluded.recorded_at,
    -- 월드는 아는 값이 있을 때만 덮어쓴다. 파티원 수 수정처럼 월드를 모르는 경로에서 upsert가
    -- 일어나도(그때 world를 null로 넘긴다) 이미 박아둔 스냅샷을 지우지 않는다.
    world = COALESCE(excluded.world, boss_profit_records.world)
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

export function getBossProfitRecordsRevision(): number {
  return recordsRevision
}

/** 테스트 전용. 모듈 수준 상태라 테스트끼리 오염된다. 프로덕션에서 부르지 말 것. */
export function resetBossProfitRecordsRevisionForTests(): void {
  recordsRevision = 0
}

export async function upsertBossProfitRecord(record: BossProfitRecord): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(UPSERT_SQL, [
    record.ocid,
    record.boss,
    record.difficulty,
    record.cycle,
    record.periodKey,
    record.partySize,
    record.priceMeso,
    record.payoutMeso,
    record.recordedAt,
    record.world,
  ])
  // **쓰기가 끝난 뒤**에 올린다. 중간에 던지면 표가 안 바뀐 것이라, 그때 올리면 읽는 쪽이 헛일한다.
  recordsRevision += 1
}

const FILL_MISSING_WORLD_SQL = `
  UPDATE boss_profit_records SET world = ? WHERE ocid = ? AND world IS NULL
`

/**
 * `world` 가 비어 있는 기존 기록을 **지금 아는 월드**로 채운다.
 *
 * 컬럼을 새로 더했으므로 그전 기록에는 월드가 없다. `NULL` 로 두면 안전하지만 기존 사용자의 과거 주
 * 결정석 칩이 통째로 사라지고, 현재 월드로 채우면 **이미 리프한 캐릭터의 과거만** 잘못 고정된다.
 * 아직 실사용자가 없어(사용자 확인 2026-07-31) 후자를 택했다. **배포 후에는 할 수 없는 선택이므로
 * 지금 하지 않으면 비용이 커진다.**
 *
 * `world IS NULL` 조건이 멱등성을 보장한다. 한 번 채워진 기록은 이후 호출에 걸리지 않으므로 리프
 * 후에 다시 실행돼도 과거 스냅샷을 덮어쓰지 않는다.
 */
export async function fillMissingRecordWorlds(worldByOcid: Map<string, string>): Promise<void> {
  if (worldByOcid.size === 0) {
    return
  }
  const db = await getBossProfitDb()
  for (const [ocid, world] of worldByOcid) {
    await db.run(FILL_MISSING_WORLD_SQL, [world, ocid])
  }
  recordsRevision += 1
}

function rowToRecord(row: Record<string, unknown>): BossProfitRecord {
  return {
    ocid: row.ocid as string,
    boss: row.boss as string,
    difficulty: row.difficulty as string,
    cycle: row.cycle as BossCycle,
    periodKey: row.period_key as string,
    partySize: row.party_size as number,
    priceMeso: row.price_meso as number,
    payoutMeso: row.payout_meso as number,
    recordedAt: row.recorded_at as string,
    // 컬럼을 더하기 전 기록에는 없다. undefined도 null로 정규화해 호출부가 한 형태만 다루게 한다.
    world: (row.world as string | null | undefined) ?? null,
  }
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
 * 이 기간 **또는 그보다 과거**에 기록이 하나라도 있는지 확인한다.
 *
 * 이전 기간 게이트(`canReachPreviousPeriod`)가 **바로 이전 한 칸만** 봐서, 기록이 없는 기간이 벽이
 * 되어 그 뒤의 기록 전체가 화면에서 사라졌다. 3·4주차에 접속하지 않은 캐릭터는 1·2주차 기록이
 * DB에 남아 있어도 도달할 수 없었다(이슈 #78). 키 목록을 열거하는 `getBossProfitRecords` 로는 답할
 * 수 없어(그 목록이 무한히 길어진다) 부등호 비교를 SQL에 맡긴다.
 *
 * `tab` 이 기준을 정한다. 주간 탭은 weekly 기록만 보고, 월간 탭은 그 달의 monthly 기록과 **그 달에
 * 속한 weekly 기록**을 함께 본다(화면이 둘을 함께 그리므로, `hasCachedRecordsForPeriod` 와 같은 규약).
 * weekly `period_key` 는 `YYYY-MM-DD` 라 앞 7자가 그 달이다.
 */
export async function hasBossProfitRecordsAtOrBefore(
  ocids: string[],
  tab: BossCycle,
  periodKey: string,
): Promise<boolean> {
  if (ocids.length === 0) {
    return false
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const condition =
    tab === 'monthly'
      ? `((cycle = 'monthly' AND period_key <= ?) OR (cycle = 'weekly' AND substr(period_key, 1, 7) <= ?))`
      : `(cycle = 'weekly' AND period_key <= ?)`
  const parameters = tab === 'monthly' ? [...ocids, periodKey, periodKey] : [...ocids, periodKey]

  const { values } = await db.query(
    `SELECT 1 FROM boss_profit_records WHERE ocid IN (${ocidPlaceholders}) AND ${condition} LIMIT 1`,
    parameters,
  )

  return (values?.length ?? 0) > 0
}

/** `boss_profit_records` 한 행을 식별하는 키(금액·파티원 수 없음). */
export interface BossProfitRecordKey {
  ocid: string
  boss: string
  difficulty: string
  periodKey: string
}

/**
 * 이 캐릭터들의 **전 기간** 수익 기록 키만 읽는다.
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
    `SELECT ocid, boss, difficulty, period_key FROM boss_profit_records WHERE ocid IN (${ocidPlaceholders})`,
    [...ocids],
  )

  return (values ?? []).map((row) => ({
    ocid: (row as Record<string, unknown>).ocid as string,
    boss: (row as Record<string, unknown>).boss as string,
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
    `SELECT ocid, boss, difficulty, period_key, payout_meso, defeated_on
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
    `SELECT ocid, boss, difficulty, cycle, period_key
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
      boss: record.boss as string,
      difficulty: record.difficulty as string,
      cycle: record.cycle as BossCycle,
      periodKey: record.period_key as string,
    }
  })
}

/**
 * 캐낸 날짜를 박는다. **upsert 를 안 탄다**.
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
      WHERE ocid = ? AND boss = ? AND difficulty = ? AND period_key = ?`,
    [defeatedOn, key.ocid, key.boss, key.difficulty, key.periodKey],
  )
  recordsRevision += 1
}
