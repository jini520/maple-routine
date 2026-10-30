/**
 * 회차가 받은 스케줄로 **지금 기간의 보스 수익을 기록하는** 자리. 스케줄 회차(`runScheduleRound`)가 동기화 뒤에 부른다.
 *
 * 하는 일은 셋이다. 완료 보스를 기본 파티원 수로 자동 기록하고(`autoRecordRows`), 월드 리프로 두 ocid 에 남은 같은 처치를
 * 정리하고, 잡지 않은 보스의 드롭을 지운다. 화면은 그리지 않는다. 쓴 기록은 표의 판을 올리고, 그 표를 읽는 쿼리(보스
 * 수익 기간 · 가계부)가 무효화된다.
 *
 * 전에는 이 일이 보스 수익 스토어의 `refresh` 안에 있어 그 화면이 돌아야만 기록이 생겼다. today 를 당겨도 기록은 생기는데
 * 처치 날짜가 비어 이번 주 수입에 안 들었다. 회차 안에 두면 어느 화면이 받든 기록과 날짜가 같은 차례로 생긴다.
 */
import { getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'
import { manualCompletionKey } from '../../lib/boss/manual-completion'
import { getBossDropRecords } from '../../storage/boss-drops'
import {
  fillMissingRecordWorlds,
  getBossProfitRecords,
  getManualBossProfitRecordKeys,
  type BossProfitRecord,
} from '../../storage/boss-profit'
import { getManualTrackedContent, type ManualTrackedItem } from '../../storage/manual-tracked-content'
import { batchRecordWrites } from '../../storage/record-revision-batch'
import { getTrackingMode } from '../../storage/tracking-mode'
import { resolveDisplayProfiles } from '../character-profile/resolve'
import type { CharacterScheduleSync } from '../schedule-sync/schedule-sync'
import { useToastStore } from '../toast/store'
import { autoRecordRows, nexonCompletedKeysOf } from './auto-record'
import { sweepOrphanDrops } from './orphan-drops'
import {
  appendRecordOnlyRows,
  buildBossProfitRow,
  mergeRecordsIntoRows,
  selectProfitDisplayBosses,
  type BossProfitRow,
  type CharacterProfileInfo,
} from './rows'
import { withSqliteFallback } from './sqlite-guards'
import { cleanUpWorldLeapDuplicates } from './world-leap-records'

/** 지금 주와 지금 달. 회차가 사실을 아는 기간은 이 둘뿐이다. */
export function currentPeriodKeys(now: Date): string[] {
  return [getCurrentBossProfitPeriod('weekly', now).periodKey, getCurrentBossProfitPeriod('monthly', now).periodKey]
}

/**
 * 사용자가 직접 적은 완료를 캐릭터별 열쇠 집합으로. **이번 주 · 이번 달 것만** 본다. 행 고르기가 이 값을 봐야
 * 스케줄러 카드와 보스 수익이 같은 처치 수를 말한다. 읽기가 실패하면 빈 표라 그 회차는 넥슨이 준 것만 본다.
 */
export async function readManualCompletedKeys(ocids: readonly string[], now: Date): Promise<Map<string, Set<string>>> {
  const byOcid = new Map<string, Set<string>>()
  if (ocids.length === 0) return byOcid
  const records = await withSqliteFallback(getManualBossProfitRecordKeys([...ocids], currentPeriodKeys(now)), [])
  for (const record of records) {
    const keys = byOcid.get(record.ocid) ?? new Set<string>()
    keys.add(manualCompletionKey(record.bossKey, record.difficulty))
    byOcid.set(record.ocid, keys)
  }
  return byOcid
}

/** 수동 모드의 캐릭터별 수동 추적 목록. 자동 모드는 빈 표다. 자동 동작은 추적과 독립이다. */
export async function readManualItems(ocids: readonly string[], mode: 'auto' | 'manual'): Promise<Map<string, ManualTrackedItem[]>> {
  const byOcid = new Map<string, ManualTrackedItem[]>()
  if (mode !== 'manual') return byOcid
  await Promise.all(
    ocids.map(async (ocid) => {
      byOcid.set(ocid, await getManualTrackedContent(ocid))
    }),
  )
  return byOcid
}

/** 정리 결과 안내. 조용히 지우지 않는다. 지운 것이 없으면 말할 것도 없다. */
function notifyOrphanDropCleanup(removedDrops: number): void {
  if (removedDrops === 0) return
  useToastStore.getState().showInfo(`잡지 않은 보스의 아이템 기록 ${removedDrops}건을 정리했어요`)
}

export async function recordBossProfitFromRound(
  ocids: readonly string[],
  results: readonly CharacterScheduleSync[],
  now: Date,
): Promise<void> {
  if (ocids.length === 0 || results.length === 0) return

  const [profiles, trackingMode, manualCompletedKeys] = await Promise.all([
    resolveDisplayProfiles(ocids),
    getTrackingMode(),
    readManualCompletedKeys(ocids, now),
  ])
  const mode = trackingMode ?? 'auto'
  const manualItemsByOcid = await readManualItems(ocids, mode)

  // `world` 칸이 없던 때의 기록에 지금 아는 월드를 채운다. `world IS NULL` 조건이라 다시 돌아도 과거 값을 안 덮는다.
  const knownWorlds = new Map<string, { world: string; worldKey: string | null }>()
  for (const [ocid, profile] of profiles) {
    if (profile.world !== null) knownWorlds.set(ocid, { world: profile.world, worldKey: profile.worldKey })
  }
  await withSqliteFallback(fillMissingRecordWorlds(knownWorlds), undefined)

  const characterProfiles = new Map<string, CharacterProfileInfo>()
  for (const [ocid, profile] of profiles) {
    characterProfiles.set(ocid, { characterName: profile.name, imageUrl: profile.imageUrl, world: profile.world, worldKey: profile.worldKey })
  }

  const rows: BossProfitRow[] = []
  // 동기화가 실패한 캐릭터. 그 결과의 `state` 는 캐시의 옛 값이라 지금의 사실이 아니다. 기록 · 정리에서 뺀다.
  const staleOcids = new Set<string>()
  const nexonCompleted = new Set<string>()
  const weeklyPeriodKey = getCurrentBossProfitPeriod('weekly', now).periodKey

  for (const result of results) {
    const known = profiles.get(result.ocid)
    const profile: CharacterProfileInfo = {
      characterName: result.characterName,
      imageUrl: known?.imageUrl ?? null,
      world: known?.world ?? null,
      worldKey: known?.worldKey ?? null,
    }
    characterProfiles.set(result.ocid, profile)
    if (result.isStale) staleOcids.add(result.ocid)
    for (const key of nexonCompletedKeysOf(result.ocid, result.state?.bossContents ?? [])) nexonCompleted.add(key)

    const bosses = selectProfitDisplayBosses(
      result.state?.bossContents ?? [],
      mode,
      manualItemsByOcid.get(result.ocid) ?? [],
      profile.worldKey,
      manualCompletedKeys.get(result.ocid),
      { periodKey: weeklyPeriodKey, now },
    )
    for (const boss of bosses) rows.push(buildBossProfitRow(result.ocid, profile, boss, now))
  }

  // 행에서 나온 기간에 지금 주 · 달을 더한다. 행이 없는 기간의 기록을 조회조차 안 하면 되살릴 재료가 없다.
  const periodKeys = [...new Set([...rows.map((row) => row.periodKey), ...currentPeriodKeys(now)])]
  // 폴백을 `[]` 가 아니라 `null` 로 둬 조회 실패와 기록 없음을 가른다. 실패를 없음으로 읽으면 자동 기록이 사용자가 저장한
  // 파티원 수를 1 로 덮는다.
  const records = await withSqliteFallback<BossProfitRecord[] | null>(getBossProfitRecords([...ocids], periodKeys), null)
  const dropRecords = records === null ? [] : await withSqliteFallback(getBossDropRecords([...ocids], periodKeys), [])

  // 한 회차의 쓰기 전부를 한 묶음으로. 판 알림은 끝날 때 한 번이다.
  await batchRecordWrites(async () => {
    const recordedRows = await autoRecordRows({
      rows: mergeRecordsIntoRows(rows, records ?? []),
      records,
      dropRecords,
      now,
      isSourceCurrent: (row) => !staleOcids.has(row.ocid),
      nexonCompleted,
    })

    // 리프 중복 정리는 방금 쓴 새 기록의 짝을 봐야 해서 자동 기록 뒤다. 지운 것이 있으면 기록을 다시 읽어 고아 정리가
    // 지운 기록의 행을 안 본다.
    let settledRecords = records
    if (records !== null && (await withSqliteFallback(cleanUpWorldLeapDuplicates(now), 0)) > 0) {
      settledRecords = await withSqliteFallback(getBossProfitRecords([...ocids], periodKeys), records)
    }
    if (settledRecords === null) return

    const unionRows = appendRecordOnlyRows(
      settledRecords === records ? recordedRows : mergeRecordsIntoRows(recordedRows, settledRecords),
      settledRecords,
      characterProfiles,
      now,
    )
    // 잡지 않은 보스의 드롭을 지운다. 동기화 대상만 넘긴다. 해제한 캐릭터를 넣으면 믿을 수 있는 캐릭터에 영영 못 들어
    // 그들의 드롭이 고아로 읽힌다.
    const removed = await sweepOrphanDrops({
      ocids: [...ocids],
      rows: unionRows,
      trustedOcids: new Set(ocids.filter((ocid) => !staleOcids.has(ocid))),
      knownPeriodKeys: new Set(currentPeriodKeys(now)),
      now,
    })
    notifyOrphanDropCleanup(removed)
  })
}
