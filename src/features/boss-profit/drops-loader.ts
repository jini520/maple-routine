// 보스 행별 **드롭 기록 로드와 난이도 보정**(ADR-094 결정 7로 store.ts 에서 분리).
//
// 기록은 처치 난이도가 확정되기 전에도 남을 수 있어, 확정된 뒤 옛 키의 드롭을 옮겨 붙이는
// 마이그레이션이 함께 산다. 그 둘은 같은 문제의 앞뒤라 한 모듈이다.

import { planConfirmedDifficultyDropMigration, pruneUnobtainableDrops } from '../../lib/boss/boss-drops'
import { getBossDropRecords, replaceBossDropRecords } from '../../storage/boss-drops'
import type { BossDropRecord } from '../../storage/boss-drops'
import type { RecordedDrop } from '../../types/drops'
import { dropRowKey, toRecordedDrop } from './rows'
import { withSqliteFallback } from './sqlite-guards'
import type { BossProfitRow } from './rows'
/**
 * 처치 난이도가 확정된 순간, 옛 난이도 키에 남은 드롭을 확정 난이도로 이관한다.
 * 계산은 `planConfirmedDifficultyDropMigration` 이 하고 여기서는 쓰기만 한다.
 *
 * `dropRecords` 는 호출 측이 이미 읽어둔 것을 그대로 받는다. 행마다 새로 조회하지 않기 위함이다.
 * 옮길 것이 없으면 계획이 `null` 이라 쓰기도 없다(멱등).
 *
 * **확정 키를 먼저 쓰고 옛 키를 비운다.** 순서를 뒤집으면 중간에 앱이 죽었을 때 기록이 사라지는데,
 * 이 순서면 최악이 "아무도 읽지 않는 옛 키에 사본이 남는다"(=이관 전과 같은 고아)로 끝난다.
 */
export async function migrateDropsToConfirmedDifficulty(
  row: Pick<BossProfitRow, 'ocid' | 'boss' | 'difficulty' | 'periodKey'>,
  dropRecords: BossDropRecord[],
  now: Date,
): Promise<void> {
  const plan = planConfirmedDifficultyDropMigration(
    row.boss,
    row.difficulty,
    dropRecords
      .filter(
        (record) =>
          record.ocid === row.ocid && record.boss === row.boss && record.periodKey === row.periodKey,
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
      replaceBossDropRecords(row.ocid, row.boss, row.difficulty, row.periodKey, plan.drops, recordedAt),
      undefined,
    )
  }
  for (const staleDifficulty of plan.staleDifficulties) {
    await withSqliteFallback(
      replaceBossDropRecords(row.ocid, row.boss, staleDifficulty, row.periodKey, [], recordedAt),
      undefined,
    )
  }
}

// rows에 등장하는 periodKey들의 드롭 기록을 dropRowKey → RecordedDrop[]로 묶어 반환한다.
// getBossDropRecords는 ORDER BY drop_index라 추가 순서가 보존된다.
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
    const key = dropRowKey(record.ocid, record.boss, record.difficulty, record.periodKey)
    if (map[key] === undefined) map[key] = []
    // **변환은 `toRecordedDrop` 하나에 맡긴다.** 여기서 손으로 필드를 옮겨 적던 것이
    //  가격이 사라지던 원인이었다(사용자 보고 2026-08-10 — "지난주 갔다 오니
    // 아이템 수익이 사라진다"): 저장은 멀쩡한데 **읽을 때마다** 가격 세 필드가 떨어져 나갔고,
    // 시트에서 넣은 직후에는 스토어가 값을 들고 있어 보이다가 기간을 왕복하면 사라졌다.
    map[key].push(toRecordedDrop(record))
  }

  // 처치 난이도가 확정된(완료) 행에 한해, 그 난이도에서 획득 불가한 드롭을 제거한다(ADR-044 후속).
  // 미완료 시트의 표시용 난이도 토글로 다른 난이도 전용 아이템이 행 난이도 키에 섞여 저장될 수
  // 있기 때문. 변경이 있으면 DB에도 영구 반영한다(멱등 — 이미 정리됐으면 재기록 없음). 미완료
  // 행은 아직 처치 난이도가 없으므로 건드리지 않는다(scratchpad).
  for (const row of rows) {
    if (!row.isComplete) continue
    const key = dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)
    const drops = map[key]
    if (drops === undefined || drops.length === 0) continue
    const pruned = pruneUnobtainableDrops(row.boss, row.difficulty, drops)
    if (pruned.length !== drops.length) {
      map[key] = pruned
      await withSqliteFallback(
        replaceBossDropRecords(row.ocid, row.boss, row.difficulty, row.periodKey, pruned, now.toISOString()),
        undefined,
      )
    }
  }

  return map
}
