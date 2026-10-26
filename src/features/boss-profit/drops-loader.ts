/**
 * 보스 행별 **드롭 기록 로드와 난이도 보정**(store.ts 에서 분리).
 *
 * 기록은 처치 난이도가 확정되기 전에도 남을 수 있어, 확정된 뒤 옛 키의 드롭을 옮겨 붙이는
 * 마이그레이션이 함께 산다. 그 둘은 같은 문제의 앞뒤라 한 모듈이다.
 */

import { planConfirmedDifficultyDropMigration, pruneUnobtainableDrops } from '../../lib/boss/boss-drops'
import { NO_WORLD, getBossDropRecords, replaceBossDropRecords } from '../../storage/boss-drops'
import { batchRecordWrites } from '../../storage/record-revision-batch'
import type { BossDropRecord } from '../../storage/boss-drops'
import type { RecordedDrop } from '../../types/drops'
import { reportDropPrice, reportDropRemoved } from '../server-sync/drop-price-sync'
import { dropRowKey, toRecordedDrop } from './rows'
import { withSqliteFallback } from './sqlite-guards'
import type { BossProfitRow } from './rows'
/**
 * 처치 난이도가 확정된 순간 옛 난이도 키에 남은 드롭을 옮기는 이관.
 * 계산은 `planConfirmedDifficultyDropMigration` 이 하고 여기서는 쓰기만 한다.
 *
 * `dropRecords` 는 호출 측이 이미 읽어둔 것을 그대로 받는다. 행마다 새로 조회하지 않기 위함이다.
 * 옮길 것이 없으면 계획이 `null` 이라 쓰기도 없다(멱등).
 *
 * **확정 키를 먼저 쓰고 옛 키를 비운다.** 순서를 뒤집으면 중간에 앱이 죽었을 때 기록이 사라지는데,
 * 이 순서면 최악이 "아무도 읽지 않는 옛 키에 사본이 남는다"(=이관 전과 같은 고아)로 끝난다.
 *
 * **옮긴 드롭은 서버에 다시 보낸다.** 전송값이 난이도를 싣는데 서버 줄은 옛 난이도를 가리키고
 * 있어서다. 기록 id 가 같아 서버가 값을 덮는다. 확정 키에 이미 있던 드롭은 안 보낸다. **걷힌 드롭은
 * 지우기를 보낸다.** 기기에서 기록이 사라졌으니 서버 줄도 deleted 가 되어야 한다.
 */
export async function migrateDropsToConfirmedDifficulty(
  row: Pick<BossProfitRow, 'ocid' | 'bossKey' | 'difficulty' | 'periodKey'>,
  dropRecords: BossDropRecord[],
  now: Date,
): Promise<void> {
  const plan = planConfirmedDifficultyDropMigration(
    row.bossKey,
    row.difficulty,
    row.periodKey,
    dropRecords
      .filter(
        (record) =>
          record.ocid === row.ocid && record.bossKey === row.bossKey && record.periodKey === row.periodKey,
      )
      .map((record) => ({
        ...toRecordedDrop(record),
        difficulty: record.difficulty,
        dropIndex: record.dropIndex,
      })),
  )
  if (plan === null) return

  const recordedAt = now.toISOString()
  if (plan.drops.length > 0) {
    await withSqliteFallback(
      // 난이도 확정 이관이다. 옮기는 드롭이 자기 식별자를 들고 오고(`dropRecordId`), 월드도 그
      // 행의 값이라 여기서 새로 정하지 않는다.
      replaceBossDropRecords(row.ocid, row.bossKey, row.difficulty, row.periodKey, plan.drops, recordedAt, NO_WORLD),
      undefined,
    )
  }
  for (const staleDifficulty of plan.staleDifficulties) {
    await withSqliteFallback(
      replaceBossDropRecords(row.ocid, row.bossKey, staleDifficulty, row.periodKey, [], recordedAt, NO_WORLD),
      undefined,
    )
  }

  const staleIds = new Set(
    dropRecords
      .filter(
        (record) =>
          record.ocid === row.ocid &&
          record.bossKey === row.bossKey &&
          record.periodKey === row.periodKey &&
          record.difficulty !== row.difficulty,
      )
      .map((record) => record.dropRecordId),
  )
  for (const drop of plan.drops) {
    if (drop.dropRecordId === null || !staleIds.has(drop.dropRecordId)) continue
    staleIds.delete(drop.dropRecordId)
    void reportDropPrice(drop.dropRecordId, now)
  }
  // 남은 것은 확정 난이도에서 못 얻거나 같은 타일이 이미 있어 걷힌 드롭이다.
  for (const removedId of staleIds) {
    void reportDropRemoved(removedId, now)
  }
}

// rows에 등장하는 periodKey들의 드롭 기록을 dropRowKey → RecordedDrop[]로 묶어 반환한다.
// getBossDropRecords는 ORDER BY sort_order라 추가 순서가 보존된다.
export async function loadDropsByRowKey(
  ocids: string[],
  rows: BossProfitRow[],
  now: Date,
): Promise<Record<string, RecordedDrop[]>> {
  const periodKeys = Array.from(new Set(rows.map((row) => row.periodKey)))
  if (ocids.length === 0 || periodKeys.length === 0) return {}

  const records = await withSqliteFallback(getBossDropRecords(ocids, periodKeys), [])
  const map: Record<string, RecordedDrop[]> = {}
  for (const record of records) {
    const key = dropRowKey(record.ocid, record.bossKey, record.difficulty, record.periodKey)
    if (map[key] === undefined) map[key] = []
    // 변환은 `toRecordedDrop` 하나에 맡긴다. 여기서 손으로 필드를 옮겨 적으면 읽을 때마다 가격
    // 세 필드가 떨어져 나가, 시트에서 넣은 직후에는 보이다가 기간을 왕복하면 사라진다.
    map[key].push(toRecordedDrop(record))
  }

  // 처치 난이도가 확정된(완료) 행에 한해 그 난이도에서 획득 불가한 드롭을 제거한다. 미완료
  // 시트의 표시용 난이도 토글로 다른 난이도 전용 아이템이 행 난이도 키에 섞여 저장될 수 있기
  // 때문이다. 변경이 있으면 DB 에도 영구 반영한다(멱등). 미완료 행은 아직 처치 난이도가 없어
  // 건드리지 않는다. 판정은 그 행의 기간으로 한다. 패치로 빠진 아이템의 패치 전 기록이 지워지면
  // 안 된다.
  // 행마다 다시 쓸 수 있다. 판 알림은 반복이 끝날 때 한 번이다.
  await batchRecordWrites(async () => {
    for (const row of rows) {
      if (!row.isComplete) continue
      const key = dropRowKey(row.ocid, row.bossKey, row.difficulty, row.periodKey)
      const drops = map[key]
      if (drops === undefined || drops.length === 0) continue
      const pruned = pruneUnobtainableDrops(row.bossKey, row.difficulty, row.periodKey, drops)
      if (pruned.length !== drops.length) {
        map[key] = pruned
        await withSqliteFallback(
          replaceBossDropRecords(row.ocid, row.bossKey, row.difficulty, row.periodKey, pruned, now.toISOString(), {
            name: row.world,
            key: row.worldKey,
          }),
          undefined,
        )
        // 걷힌 드롭은 기기에서 기록이 사라진 것이다. 서버의 그 줄을 deleted 로 표시한다.
        const keptIds = new Set(pruned.map((drop) => drop.dropRecordId))
        for (const drop of drops) {
          if (drop.dropRecordId === null || keptIds.has(drop.dropRecordId)) continue
          void reportDropRemoved(drop.dropRecordId, now)
        }
      }
    }

  })
  return map
}
