import type {
  BossContent,
  BossCycle,
  DailyContent,
  SchedulerCharacterState,
  SharedProgressEntry,
  WeeklyContent,
} from '../../types'
import { getCurrentBossProfitPeriod } from '../boss/boss-profit-period'
import { findContent } from './contents'
import { getCurrentKstDateKey } from './reset-clock'
import {
  getContentCatalogEntries,
  getMaxCountOverride,
  getShareScope,
  trustsRegistrationFlag,
} from './scheduler-content-scope'

export interface MergeInput {
  previous: SchedulerCharacterState | null
  fresh: SchedulerCharacterState
  worldLedger: Record<string, SharedProgressEntry>
  accountLedger: Record<string, SharedProgressEntry>
  now: Date
}

export interface MergeOutput {
  characterState: SchedulerCharacterState
  worldLedgerUpdates: Record<string, SharedProgressEntry>
  accountLedgerUpdates: Record<string, SharedProgressEntry>
}

type ContentItem = DailyContent | WeeklyContent

function withMaxCountOverride<T extends ContentItem>(item: T): T {
  const override = getMaxCountOverride(item.contentKey)
  return override === null ? item : { ...item, maxCount: override }
}

/** 병합의 항목 신원. 컨텐츠 key 이고, 컨텐츠 표에 없는 항목은 API 원문이다. 두 모양이 겹치지 않게 앞에 표지를 붙인다. */
function contentMergeKey(item: ContentItem): string {
  return item.contentKey !== null ? `key:${item.contentKey}` : `api:${item.apiName}`
}

/** 원장에서 되살린 줄의 API 이름. 표의 `content_name` 이다. */
function contentApiNameOf(contentKey: string): string {
  return findContent(contentKey)?.content_name ?? contentKey
}

function resetProgress<T extends ContentItem>(item: T): T {
  return { ...item, nowCount: 0, questState: item.questState === null ? null : 0 }
}

interface SectionResult {
  items: ContentItem[]
  worldUpdates: Record<string, SharedProgressEntry>
  accountUpdates: Record<string, SharedProgressEntry>
}

// 병합 알고리즘 (daily/weekly 공통):
// 1. fresh 섹션이면 character 범위 항목은 그대로 쓰고, world/account 범위 항목은 개별 응답의
//  registration_flag를 무시(마지막 활성 캐릭터 오염)하고 원장의 active를 ratchet(한번
//    true면 계속 true)한 뒤 값을 갱신한다. 카탈로그가 trustRegistrationFlag 로 지목한 항목(유니온 둘)만
//    ratchet 없이 이번 응답의 등록 값을 쓴다.
// 2. stale 섹션이면 character 범위 항목만 이전 캐시에서 이름/등록을 유지하고 진행값만 리셋한다.
// 3. 두 경우 모두, 이 섹션 소속 world/account 카탈로그 항목 중 아직 결과에 없는 것을 원장에서
//  복원한다(캐릭터 자신의 응답에 그 항목이 없어도. 개별 항목 누락 오염). 원장 자체가
//    리셋 경계를 넘겼는데 아무도 안 갱신했으면 진행값만 리셋한다. 등록 여부는 원장의 active 그대로라
//    active 가 거짓인 칸도 채운다. 건너뛰면 등록 안 한 에픽 던전의 완료가 주간 한도에서 빠진다.
function mergeSection(
  section: 'daily' | 'weekly',
  freshItems: ContentItem[],
  freshIsStale: boolean,
  previousItems: ContentItem[],
  worldLedger: Record<string, SharedProgressEntry>,
  accountLedger: Record<string, SharedProgressEntry>,
  bucket: string,
): SectionResult {
  const worldUpdates: Record<string, SharedProgressEntry> = {}
  const accountUpdates: Record<string, SharedProgressEntry> = {}
  const items: ContentItem[] = []
  const seen = new Set<string>()

  // character 범위: stale 여부와 무관하게 항상 항목(이름) 단위로 병합한다(정정).
  // fresh에 있으면 그대로 쓰고, fresh에 없는데 previous에 있으면 진행값을 리셋해 복원한다.
  // Nexon 응답이 섹션을 통째로 비우는 대신 개별 항목만 누락시키는 경우가 확인돼
  // (2026-07-23), "섹션이 stale이 아니면 fresh만 신뢰"하던 이전 방식으로는 그 누락을 못 잡았다.
  for (const item of freshItems) {
    if (getShareScope(item.contentKey) === 'character') {
      items.push(withMaxCountOverride(item))
      seen.add(contentMergeKey(item))
    }
  }
  for (const item of previousItems) {
    if (getShareScope(item.contentKey) !== 'character' || seen.has(contentMergeKey(item))) {
      continue
    }
    items.push(withMaxCountOverride(resetProgress(item)))
    seen.add(contentMergeKey(item))
  }

  // world/account 범위: "마지막 활성 캐릭터" API 오염 때문에 previous가 아니라
  // 원장을 신뢰해야 해서 위 정정의 범위 밖이다. 기존처럼 fresh가 stale이 아닐 때만 처리한다.
  if (!freshIsStale) {
    for (const item of freshItems) {
      const scope = getShareScope(item.contentKey)
      // 공유 범위는 컨텐츠 표에 있는 항목만 갖는다. 원장 열쇠는 컨텐츠 key 다.
      if (scope === 'character' || item.contentKey === null) {
        continue
      }

      const ledger = scope === 'world' ? worldLedger : accountLedger
      const wasActive = ledger[item.contentKey]?.active === true
      const active = trustsRegistrationFlag(item.contentKey) ? item.isRegistered : wasActive || item.isRegistered
      const entry: SharedProgressEntry = {
        active,
        kind: item.kind,
        nowCount: item.nowCount,
        maxCount: item.maxCount,
        questState: item.questState,
        lastUpdatedBucket: bucket,
      }

      if (scope === 'world') {
        worldUpdates[item.contentKey] = entry
      } else {
        accountUpdates[item.contentKey] = entry
      }

      // 값(now_count)은 active 여부와 무관하게 항상 실효 상태에 담고, 노출 여부는 isRegistered로만
      // 제어한다: auto 모드는 isRegistered로 걸러 미등록 항목을 숨기고(등록 전엔 안 보임, 설계 유지),
      // 수동 모드는 isRegistered를 무시하므로 API가 준 값을 그대로 표시한다. 몬스터파크처럼 now_count가
      // 월드 총합이라 registration_flag가 false여도 값이 오는 경우, 값을 버리지 않아야 수동 모드가
      // 0 대신 실값을 보여줄 수 있다.
      items.push(withMaxCountOverride({ ...item, isRegistered: active }))
      seen.add(contentMergeKey(item))
    }
  }

  for (const catalogEntry of getContentCatalogEntries(section)) {
    if (seen.has(`key:${catalogEntry.contentKey}`)) {
      continue
    }

    const ledger = catalogEntry.scope === 'world' ? worldLedger : accountLedger
    const ledgerEntry = ledger[catalogEntry.contentKey]
    if (ledgerEntry === undefined) {
      continue
    }

    const isLedgerStale = ledgerEntry.lastUpdatedBucket !== bucket
    items.push(
      withMaxCountOverride({
        contentKey: catalogEntry.contentKey,
        apiName: contentApiNameOf(catalogEntry.contentKey),
        kind: ledgerEntry.kind,
        isRegistered: ledgerEntry.active,
        nowCount: isLedgerStale ? 0 : ledgerEntry.nowCount,
        maxCount: ledgerEntry.maxCount,
        questState: isLedgerStale ? (ledgerEntry.questState === null ? null : 0) : ledgerEntry.questState,
      }),
    )
    seen.add(`key:${catalogEntry.contentKey}`)
  }

  return { items, worldUpdates, accountUpdates }
}

// 보스는 전부 character 범위(확인)라 world/account 원장 단계가 필요 없다. cycle 내에서
// 항목(보스+난이도) 단위로 병합한다(정정): fresh에 있으면 그대로 쓰고, fresh에 없는데
// previous에 있으면 isComplete·ownComplete를 false로 리셋해 복원한다. ownComplete도 함께 리셋해야
// 한다. 안 그러면 지난 리셋에서의 완료 여부가 그대로 남아있어 보스 수익 계산기
// (selectBossProfitBosses)가 이번 리셋에서 아직 처치하지 않은 보스를 "실제로 완료함"으로
// 오판한다.
/** 병합의 항목 신원. 보스 key 이고, 보스 표에 없는 보스는 API 원문이다. 두 모양이 겹치지 않게 앞에 표지를 붙인다. */
function bossMergeKey(boss: BossContent): string {
  const identity = boss.bossKey !== null ? `key:${boss.bossKey}` : `api:${boss.apiName}`
  return `${identity}:${boss.difficulty}`
}

function mergeBossCycle(cycle: BossCycle, freshBossContents: BossContent[], previousBossContents: BossContent[]): BossContent[] {
  const items: BossContent[] = []
  const seen = new Set<string>()

  for (const boss of freshBossContents) {
    if (boss.cycle !== cycle) continue
    items.push(boss)
    seen.add(bossMergeKey(boss))
  }
  for (const boss of previousBossContents) {
    if (boss.cycle !== cycle) continue
    const key = bossMergeKey(boss)
    if (seen.has(key)) continue
    items.push({ ...boss, isComplete: false, ownComplete: false })
    seen.add(key)
  }

  return items
}

export function mergeSchedulerState(input: MergeInput): MergeOutput {
  const { previous, fresh, worldLedger, accountLedger, now } = input

  const dailyBucket = getCurrentKstDateKey(now)
  const weeklyBucket = getCurrentBossProfitPeriod('weekly', now).periodKey

  const dailyResult = mergeSection(
    'daily',
    fresh.dailyContents,
    fresh.isDailyStale,
    previous?.dailyContents ?? [],
    worldLedger,
    accountLedger,
    dailyBucket,
  )
  const weeklyResult = mergeSection(
    'weekly',
    fresh.weeklyContents,
    fresh.isWeeklyStale,
    previous?.weeklyContents ?? [],
    worldLedger,
    accountLedger,
    weeklyBucket,
  )

  const weeklyBosses = mergeBossCycle('weekly', fresh.bossContents, previous?.bossContents ?? [])
  const monthlyBosses = mergeBossCycle('monthly', fresh.bossContents, previous?.bossContents ?? [])

  const characterState: SchedulerCharacterState = {
    ...fresh,
    dailyContents: dailyResult.items as DailyContent[],
    weeklyContents: weeklyResult.items as WeeklyContent[],
    bossContents: [...weeklyBosses, ...monthlyBosses],
  }

  return {
    characterState,
    worldLedgerUpdates: { ...dailyResult.worldUpdates, ...weeklyResult.worldUpdates },
    accountLedgerUpdates: { ...dailyResult.accountUpdates, ...weeklyResult.accountUpdates },
  }
}
