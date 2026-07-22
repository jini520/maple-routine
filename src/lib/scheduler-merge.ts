import type {
  BossContent,
  BossCycle,
  DailyContent,
  SchedulerCharacterState,
  SharedProgressEntry,
  WeeklyContent,
} from '../types'
import { getCurrentBossProfitPeriod } from './boss-profit-period'
import { getCurrentKstDateKey } from './reset-clock'
import { getContentCatalogEntries, getMaxCountOverride, getShareScope } from './scheduler-content-scope'

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
  const override = getMaxCountOverride(item.name)
  return override === null ? item : { ...item, maxCount: override }
}

function resetProgress<T extends ContentItem>(item: T): T {
  return { ...item, nowCount: 0, questState: item.questState === null ? null : 0 }
}

interface SectionResult {
  items: ContentItem[]
  worldUpdates: Record<string, SharedProgressEntry>
  accountUpdates: Record<string, SharedProgressEntry>
}

// ADR-030 병합 알고리즘 (daily/weekly 공통):
// 1. fresh 섹션이면 character 범위 항목은 그대로 쓰고, world/account 범위 항목은 개별 응답의
//    registration_flag를 무시(마지막 활성 캐릭터 오염, ADR-030)하고 원장의 active를 ratchet(한번
//    true면 계속 true)한 뒤 값을 갱신한다.
// 2. stale 섹션이면 character 범위 항목만 이전 캐시에서 이름/등록을 유지하고 진행값만 리셋한다.
// 3. 두 경우 모두, 이 섹션 소속 world/account 카탈로그 항목 중 아직 결과에 없는 것을 원장에서
//    복원한다(캐릭터 자신의 응답에 그 항목이 없어도 — 개별 항목 누락 오염, ADR-030). 원장 자체가
//    리셋 경계를 넘겼는데 아무도 안 갱신했으면 진행값만 리셋한다.
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

  if (!freshIsStale) {
    for (const item of freshItems) {
      const scope = getShareScope(item.name)
      if (scope === 'character') {
        items.push(withMaxCountOverride(item))
        seen.add(item.name)
        continue
      }

      const ledger = scope === 'world' ? worldLedger : accountLedger
      const wasActive = ledger[item.name]?.active === true
      const active = wasActive || item.isRegistered
      const entry: SharedProgressEntry = {
        active,
        kind: item.kind,
        nowCount: item.nowCount,
        maxCount: item.maxCount,
        questState: item.questState,
        lastUpdatedBucket: bucket,
      }

      if (scope === 'world') {
        worldUpdates[item.name] = entry
      } else {
        accountUpdates[item.name] = entry
      }

      if (active) {
        items.push(withMaxCountOverride({ ...item, isRegistered: true }))
        seen.add(item.name)
      }
    }
  } else {
    for (const item of previousItems) {
      if (getShareScope(item.name) !== 'character') {
        continue
      }
      items.push(withMaxCountOverride(resetProgress(item)))
      seen.add(item.name)
    }
  }

  for (const catalogEntry of getContentCatalogEntries(section)) {
    if (seen.has(catalogEntry.name)) {
      continue
    }

    const ledger = catalogEntry.scope === 'world' ? worldLedger : accountLedger
    const ledgerEntry = ledger[catalogEntry.name]
    if (ledgerEntry === undefined || !ledgerEntry.active) {
      continue
    }

    const isLedgerStale = ledgerEntry.lastUpdatedBucket !== bucket
    items.push(
      withMaxCountOverride({
        name: catalogEntry.name,
        kind: ledgerEntry.kind,
        isRegistered: true,
        nowCount: isLedgerStale ? 0 : ledgerEntry.nowCount,
        maxCount: ledgerEntry.maxCount,
        questState: isLedgerStale ? (ledgerEntry.questState === null ? null : 0) : ledgerEntry.questState,
      }),
    )
    seen.add(catalogEntry.name)
  }

  return { items, worldUpdates, accountUpdates }
}

// 보스는 전부 character 범위(2026-07-21 확인)라 world/account 원장 단계가 필요 없다 — cycle별로
// stale이면 이전 캐시에서 그 cycle의 항목만 골라 isComplete를 false로 리셋한다.
function mergeBossCycle(
  cycle: BossCycle,
  freshBossContents: BossContent[],
  freshIsStale: boolean,
  previousBossContents: BossContent[],
): BossContent[] {
  if (!freshIsStale) {
    return freshBossContents.filter((boss) => boss.cycle === cycle)
  }
  return previousBossContents.filter((boss) => boss.cycle === cycle).map((boss) => ({ ...boss, isComplete: false }))
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

  const weeklyBosses = mergeBossCycle('weekly', fresh.bossContents, fresh.isWeeklyBossStale, previous?.bossContents ?? [])
  const monthlyBosses = mergeBossCycle(
    'monthly',
    fresh.bossContents,
    fresh.isMonthlyBossStale,
    previous?.bossContents ?? [],
  )

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
