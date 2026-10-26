/**
 * 보스 기록 세 표가 같이 쓰는 조합 행 · 기간 행 도우미. `storage/` 안에서만 쓴다.
 *
 * 처치 · 그 기간 값 · 드롭 · 보스 관리 설정은 모두 (캐릭터, 보스, 난이도) 조합 행과 그 기간 행에 매달린다.
 * 행이 없으면 만들고 있으면 그것을 쓴다. 두 쓰기가 겹쳐도 `UNIQUE` 가 행을 하나로 지킨다.
 */
import type { SqliteDbConnection } from './ports'
import { NEW_UUID_SQL } from './sqlite/uuid'

/** 한 기간 행을 가리키는 값 넷. */
export interface BossPeriodKey {
  ocid: string
  bossKey: string
  difficulty: string
  periodKey: string
}

/** 기간 행과 조합 행을 잇는 FROM 절. 별칭은 `pe`(기간) · `pa`(조합)다. */
export const PERIODS_JOIN = 'boss_party_periods pe JOIN boss_parties pa ON pa.id = pe.party_id'

/** `PERIODS_JOIN` 위에서 키 넷으로 한 행을 고르는 조건. 값은 `periodKeyValues` 차례다. */
export const PERIOD_KEY_WHERE = 'pa.ocid = ? AND pa.boss_key = ? AND pa.difficulty = ? AND pe.period_key = ?'

export function periodKeyValues(key: BossPeriodKey): string[] {
  return [key.ocid, key.bossKey, key.difficulty, key.periodKey]
}

/** 키 넷으로 그 기간 행의 id 를 고르는 하위 질의. `UPDATE ... WHERE id = (…)` 에 쓴다. */
export const PERIOD_ID_OF_KEY = `(SELECT pe.id FROM ${PERIODS_JOIN} WHERE ${PERIOD_KEY_WHERE})`

/** 기간 key 의 주기. 주간은 `YYYY-MM-DD`, 월간은 `YYYY-MM` 이다. */
export function cycleOfPeriodKey(periodKey: string): 'weekly' | 'monthly' {
  return periodKey.length === 7 ? 'monthly' : 'weekly'
}

/** 조합 행의 id. 없으면 분배 칸이 빈(보스 관리에서 정한 적 없는) 행을 만든다. */
export async function ensurePartyId(
  db: SqliteDbConnection,
  ocid: string,
  bossKey: string,
  difficulty: string,
  at: string,
): Promise<string> {
  await db.run(
    `INSERT INTO boss_parties (id, ocid, boss_key, difficulty, created_at, updated_at)
     VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?)
     ON CONFLICT (ocid, boss_key, difficulty) DO NOTHING`,
    [ocid, bossKey, difficulty, at, at],
  )
  const { values } = await db.query(
    'SELECT id FROM boss_parties WHERE ocid = ? AND boss_key = ? AND difficulty = ?',
    [ocid, bossKey, difficulty],
  )
  return (values ?? [])[0]!.id as string
}

/** 기간 행의 id. 없으면 분배 칸이 빈 'open' 행을 만든다. */
export async function ensurePeriodId(db: SqliteDbConnection, key: BossPeriodKey, at: string): Promise<string> {
  const partyId = await ensurePartyId(db, key.ocid, key.bossKey, key.difficulty, at)
  await db.run(
    `INSERT INTO boss_party_periods (id, party_id, period_key, cycle, clear_status, created_at, updated_at)
     VALUES (${NEW_UUID_SQL}, ?, ?, ?, 'open', ?, ?)
     ON CONFLICT (party_id, period_key) DO NOTHING`,
    [partyId, key.periodKey, cycleOfPeriodKey(key.periodKey), at, at],
  )
  const { values } = await db.query('SELECT id FROM boss_party_periods WHERE party_id = ? AND period_key = ?', [
    partyId,
    key.periodKey,
  ])
  return (values ?? [])[0]!.id as string
}

/**
 * 처치도 그 기간 값도 드롭도 없는 기간 행을 지운다. 남기면 행이 있는 것만으로 기간을 세는 자리가 헛걸린다.
 */
export async function deletePeriodIfEmpty(db: SqliteDbConnection, periodId: string): Promise<void> {
  await db.run(
    `DELETE FROM boss_party_periods
      WHERE id = ? AND clear_status = 'open' AND split_mode IS NULL
        AND NOT EXISTS (SELECT 1 FROM boss_drops WHERE period_id = boss_party_periods.id)`,
    [periodId],
  )
}

/** 분배 칸을 저장 값으로. 결정석 비율이 비면 균등이다. */
export function crystalSplitValues(share: {
  partySize: number
  crystalMyShare: number | null
  crystalSharesTotal: number | null
  splitFeePercent: number | null
  splitFeeAuto?: boolean
}): [string, number, number | null, number | null, number | null, number | null] {
  const ratio = share.crystalMyShare != null && share.crystalSharesTotal != null
  return [
    ratio ? 'ratio' : 'even',
    share.partySize,
    ratio ? share.crystalMyShare : null,
    ratio ? share.crystalSharesTotal : null,
    share.splitFeePercent ?? null,
    share.splitFeeAuto === true ? 1 : null,
  ]
}

/** 분배 칸 여섯의 이름. `crystalSplitValues` 와 같은 차례다. */
export const SPLIT_COLUMN_NAMES = ['split_mode', 'party_size', 'my_share', 'shares_total', 'split_fee_percent', 'split_fee_auto'] as const

/** 저장된 칸을 정수로. 비었으면 `null`. */
export function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}
