/**
 * 보스 기록 세 표(`boss_split_settings` · `boss_profit_entries` · `boss_drops`)가 같이 쓰는 도우미. `storage/` 안에서만 쓴다.
 *
 * 표는 보스 난이도를 줄 id 로, 기간을 기간 값(`W202647`)으로 적는다. 화면과 계산은 보스 key · 난이도 · 기간 key 를 들어서,
 * 그 사이를 여기서 바꾼다. 처치 · 그 기간 값 · 드롭은 수익 건 한 줄에 매달리고, 없으면 만들고 있으면 그것을 쓴다.
 */
import { bossDifficultyIdOf, bossDifficultyOfId } from '../lib/boss/bosses'
import { periodCodeOf, periodKeyOfCode } from '../lib/boss/period-code'
import type { BossCycle } from '../types/scheduler'
import type { SqliteDbConnection } from './ports'
import { NEW_UUID_SQL } from './sqlite/uuid'

/** 수익 건 한 줄을 가리키는 값 넷. */
export interface BossPeriodKey {
  ocid: string
  bossKey: string
  difficulty: string
  periodKey: string
}

/** 수익 건을 키 셋으로 고르는 조건. 값은 `entryKeyValues` 차례다. */
export const ENTRY_KEY_WHERE = 'ocid = ? AND boss_difficulty_id = ? AND period_code = ?'

/** 키 셋으로 수익 건의 id 를 고르는 하위 질의. `UPDATE ... WHERE id = (…)` 에 쓴다. */
export const ENTRY_ID_OF_KEY = `(SELECT id FROM boss_profit_entries WHERE ${ENTRY_KEY_WHERE})`

/** 보스 난이도의 줄 id. 게임 데이터에 없는 보스 · 난이도는 적을 수 없어 던진다. */
export function bossDifficultyIdFor(bossKey: string, difficulty: string): string {
  const id = bossDifficultyIdOf(bossKey, difficulty)
  if (id === null) throw new Error(`게임 데이터에 없는 보스 난이도다: ${bossKey} ${difficulty}`)
  return id
}

/** 기간 key 의 기간 값. 꼴이 다른 key 는 적을 수 없어 던진다. */
export function periodCodeFor(periodKey: string): string {
  const code = periodCodeOf(periodKey)
  if (code === null) throw new Error(`기간 key 의 꼴이 다르다: ${periodKey}`)
  return code
}

export function entryKeyValues(key: BossPeriodKey): string[] {
  return [key.ocid, bossDifficultyIdFor(key.bossKey, key.difficulty), periodCodeFor(key.periodKey)]
}

/** 기간 key 들의 기간 값. 꼴이 다른 key 는 빠진다. */
export function periodCodesOf(periodKeys: readonly string[]): string[] {
  return periodKeys.flatMap((key) => periodCodeOf(key) ?? [])
}

/** 줄의 보스 · 난이도 · 기간을 화면이 드는 모양으로. 게임 데이터에 없는 난이도 줄이면 `null` 이다. */
export function entryKeyOf(row: Record<string, unknown>): {
  bossKey: string
  difficulty: string
  periodKey: string
  cycle: BossCycle
} | null {
  const owner = bossDifficultyOfId(row.boss_difficulty_id as string)
  const code = row.period_code as string
  const periodKey = periodKeyOfCode(code)
  if (owner === null || periodKey === null) return null
  return { bossKey: owner.bossKey, difficulty: owner.difficulty, periodKey, cycle: code.startsWith('M') ? 'monthly' : 'weekly' }
}

/** 수익 건의 id. 없으면 처치 전이고 분배를 고르지 않은 줄을 만든다. */
export async function ensureEntryId(db: SqliteDbConnection, key: BossPeriodKey, at: string): Promise<string> {
  const values = entryKeyValues(key)
  await db.run(
    `INSERT INTO boss_profit_entries (id, ocid, boss_difficulty_id, period_code, split_fee_follows_mvp_grade, created_at, updated_at)
     VALUES (${NEW_UUID_SQL}, ?, ?, ?, 1, ?, ?)
     ON CONFLICT (ocid, boss_difficulty_id, period_code) DO NOTHING`,
    [...values, at, at],
  )
  const { values: rows } = await db.query(`SELECT id FROM boss_profit_entries WHERE ${ENTRY_KEY_WHERE}`, values)
  return (rows ?? [])[0]!.id as string
}

/**
 * 처치도 그 기간 값도 드롭도 없는 수익 건을 지운다. 남기면 줄이 있는 것만으로 기간을 세는 자리가 헛걸린다.
 */
export async function deleteEntryIfEmpty(db: SqliteDbConnection, entryId: string): Promise<void> {
  await db.run(
    `DELETE FROM boss_profit_entries
      WHERE id = ? AND clear_recorded_by IS NULL AND split_type IS NULL
        AND NOT EXISTS (SELECT 1 FROM boss_drops WHERE profit_entry_id = boss_profit_entries.id)`,
    [entryId],
  )
}

/** 분배를 적는 칸 다섯의 이름. `splitValues` 와 같은 차례다. */
export const SPLIT_COLUMN_NAMES = [
  'split_type',
  'party_size',
  'split_share_millipercent',
  'split_fee_percent',
  'split_fee_follows_mvp_grade',
] as const

/** 분배를 고르지 않은 칸 다섯. 수수료는 등급을 따르는 것으로 둔다. */
export const NO_SPLIT_VALUES: readonly (string | number | null)[] = [null, null, null, null, 1]

/** 결정석 분배를 화면이 드는 모양. 비율이 `null` 이면 균등이다. */
export interface CrystalShare {
  partySize: number
  crystalMyShare: number | null
  crystalSharesTotal: number | null
  splitFeePercent: number | null
  splitFeeAuto?: boolean
  crystalExcluded?: boolean
}

/**
 * 결정석 분배를 칸 다섯으로. `제외` 는 인원 · 내 몫 · 요율을 비운다. 비율은 `내 비율 ÷ 비율 합` 을 % 의 1000 배로 반올림한다.
 *
 * @param keepFee 처치한 수익 건이면 참. 그 처치를 계산한 요율이라 등급을 따라도 남긴다. 설정과 처치 전 줄은 따르면 비운다
 */
export function splitValues(share: CrystalShare, keepFee: boolean): (string | number | null)[] {
  if (share.crystalExcluded === true) return ['excluded', null, null, null, 1]
  const follows = share.splitFeeAuto === true || share.splitFeePercent === null
  const fee = keepFee || !follows ? share.splitFeePercent : null
  if (share.crystalMyShare !== null && share.crystalSharesTotal !== null) {
    const millipercent = Math.round((share.crystalMyShare * 100_000) / Math.max(1, share.crystalSharesTotal))
    return ['ratio', share.partySize, Math.min(100_000, Math.max(0, millipercent)), fee, follows ? 1 : 0]
  }
  return ['even', share.partySize, null, fee, follows ? 1 : 0]
}

/**
 * 칸 다섯을 결정석 분배로. 비율의 합은 100000 이다. `제외` 는 인원이 없어 솔로(1)로 읽는다. 분배를 고르지 않은 줄은 `null`.
 */
export function shareOf(row: Record<string, unknown>): CrystalShare | null {
  const fee = numberOrNull(row.split_fee_percent)
  const splitFeeAuto = Number(row.split_fee_follows_mvp_grade) === 1
  if (row.split_type === 'excluded') {
    return { partySize: 1, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: fee, splitFeeAuto, crystalExcluded: true }
  }
  if (row.split_type !== 'even' && row.split_type !== 'ratio') return null
  const ratio = row.split_type === 'ratio'
  return {
    partySize: numberOrNull(row.party_size) ?? 1,
    crystalMyShare: ratio ? numberOrNull(row.split_share_millipercent) : null,
    crystalSharesTotal: ratio ? 100_000 : null,
    splitFeePercent: fee,
    splitFeeAuto,
    crystalExcluded: false,
  }
}

/** 저장된 칸을 정수로. 비었으면 `null`. */
export function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}
