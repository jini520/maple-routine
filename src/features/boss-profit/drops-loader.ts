/**
 * 보스 행별 **드롭 기록 로드와 처치 난이도로 모으기**(store.ts 에서 분리).
 *
 * 기록은 처치 난이도가 확정되기 전에도 남을 수 있어, 확정된 뒤 다른 난이도 수익 건의 드롭을 처치한 수익 건으로
 * 옮기는 이관이 함께 산다. 그 둘은 같은 문제의 앞뒤라 한 모듈이다.
 */

import { bossDifficultyIdOf } from '../../lib/boss/bosses'
import { planClearedDrops } from '../../lib/boss/drop-item-ids'
import { getBossDropRecords, settleClearedBossDrops } from '../../storage/boss-drops'
import { batchRecordWrites } from '../../storage/record-revision-batch'
import type { BossDropRecord } from '../../storage/boss-drops'
import type { RecordedDrop } from '../../types/drops'
import { dropRowKey, toRecordedDrop } from './rows'
import { withSqliteFallback } from './sqlite-guards'
import type { BossProfitRow } from './rows'

/**
 * 처치 난이도가 확정된 순간 같은 캐릭터 · 보스 · 기간의 다른 난이도 수익 건에 남은 드롭을 처치한 수익 건으로 옮기는 이관.
 * 처치 기록을 적은 뒤에 불러야 그 쓰기가 대기 표에 들어가지 않음(서버가 같은 규칙으로 옮김)
 *
 * @param dropRecords 호출 측이 이미 읽어 둔 드롭. 다른 난이도의 드롭이 없으면 쓰지 않음
 */
export async function migrateDropsToConfirmedDifficulty(
  row: Pick<BossProfitRow, 'ocid' | 'bossKey' | 'difficulty' | 'periodKey'>,
  dropRecords: BossDropRecord[],
  now: Date,
): Promise<void> {
  const stale = dropRecords.some(
    (record) =>
      record.ocid === row.ocid &&
      record.bossKey === row.bossKey &&
      record.periodKey === row.periodKey &&
      record.difficulty !== row.difficulty,
  )
  if (!stale) return
  await withSqliteFallback(settleClearedBossDrops(row, 'group', now.toISOString()), false)
}

/** 드롭 기록을 dropRowKey → RecordedDrop[] 로 묶는다. getBossDropRecords 는 수익 건 안에서 드롭 표의 차례로 늘어놓는다. */
function groupByRowKey(records: readonly BossDropRecord[]): Record<string, RecordedDrop[]> {
  const map: Record<string, RecordedDrop[]> = {}
  for (const record of records) {
    const key = dropRowKey(record.ocid, record.bossKey, record.difficulty, record.periodKey)
    if (map[key] === undefined) map[key] = []
    // 변환은 `toRecordedDrop` 하나에 맡긴다. 여기서 손으로 필드를 옮겨 적으면 읽을 때마다 가격
    // 세 필드가 떨어져 나가, 시트에서 넣은 직후에는 보이다가 기간을 왕복하면 사라진다.
    map[key].push(toRecordedDrop(record))
  }
  return map
}

/** 완료 행의 수익 건에 처치 난이도로 가리면 바뀌는 드롭이 있는지 */
function needsSettling(row: BossProfitRow, records: readonly BossDropRecord[]): boolean {
  const drops = records.filter(
    (record) =>
      record.ocid === row.ocid &&
      record.bossKey === row.bossKey &&
      record.difficulty === row.difficulty &&
      record.periodKey === row.periodKey,
  )
  const bossDifficultyId = bossDifficultyIdOf(row.bossKey, row.difficulty)
  if (drops.length === 0 || bossDifficultyId === null) return false
  const plan = planClearedDrops(
    bossDifficultyId,
    row.periodKey,
    drops.map((drop) => ({ id: drop.dropRecordId, itemId: drop.itemId, category: drop.category, bossDifficultyId })),
  )
  if (plan === null) return false
  const itemIdOf = new Map(drops.map((drop) => [drop.dropRecordId, drop.itemId]))
  return plan.remove.length > 0 || plan.keep.some((kept) => itemIdOf.get(kept.id) !== kept.itemId)
}

// rows에 등장하는 periodKey들의 드롭 기록을 dropRowKey → RecordedDrop[]로 묶어 반환한다.
export async function loadDropsByRowKey(
  ocids: string[],
  rows: BossProfitRow[],
  now: Date,
): Promise<Record<string, RecordedDrop[]>> {
  const periodKeys = Array.from(new Set(rows.map((row) => row.periodKey)))
  if (ocids.length === 0 || periodKeys.length === 0) return {}

  const records = await withSqliteFallback(getBossDropRecords(ocids, periodKeys), [])

  // 처치 난이도가 확정된(완료) 행에 한해 그 수익 건의 드롭을 처치 난이도로 가린다. 미완료 시트의 표시용 난이도 토글로 다른
  // 난이도 전용 아이템이 행 난이도 키에 섞여 저장될 수 있기 때문이다. 바뀐 것이 있으면 DB 에 쓰고 다시 읽는다(멱등). 미완료 행은
  // 아직 처치 난이도가 없어 건드리지 않는다. 판정은 그 행의 기간으로 한다. 패치로 빠진 아이템의 패치 전 기록이 지워지면 안 된다.
  // 다른 난이도 수익 건의 드롭은 옮기지 않는다. 이 행은 낡은 캐시에서 나왔을 수 있다.
  // 행마다 다시 쓸 수 있다. 판 알림은 반복이 끝날 때 한 번이다.
  const settled = await batchRecordWrites(async () => {
    let changed = false
    for (const row of rows) {
      if (!row.isComplete || !needsSettling(row, records)) continue
      if (await withSqliteFallback(settleClearedBossDrops(row, 'entry', now.toISOString()), false)) changed = true
    }
    return changed
  })
  if (!settled) return groupByRowKey(records)
  return groupByRowKey(await withSqliteFallback(getBossDropRecords(ocids, periodKeys), []))
}
