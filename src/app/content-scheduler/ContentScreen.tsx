import type { CharacterPickerEntry, DailyContent, WeeklyContent } from '../../types'
import { formatSyncedAt } from '../../features/schedule-sync/format'
import { useScheduleSyncErrorToast } from '../../features/schedule-sync/use-sync-error-toast'
import { getBossPortraitCrop, getBossPortraitUrl } from '../../lib/boss-icons'
import { getDailyQuestBackgroundUrl, getDailyQuestRegionCrop } from '../../lib/daily-quest-backgrounds'
import { matchDailyQuestRegionSlug, stripDailyQuestPrefix } from '../../lib/daily-quest-matching'
import { matchWeeklyQuestRegionSlug, stripWeeklyQuestPrefix } from '../../lib/weekly-quest-matching'
import { useEffect, useState } from 'react'

import type { BossPortraitCrop } from '../../lib/boss-icons'
import { CharacterSelectDropdown } from '../../components/CharacterSelectDropdown/CharacterSelectDropdown'
import { CharacterTrackingPicker } from '../../components/CharacterTrackingPicker/CharacterTrackingPicker'
import type { DailyQuestRegionCrop } from '../../lib/daily-quest-backgrounds'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import { ProgressModal } from '../../components/ProgressModal/ProgressModal'
import { PullToRefreshIndicator } from '../../components/PullToRefreshIndicator/PullToRefreshIndicator'
import { PULL_SETTLE_TRANSITION, resolveContentOffsetPx } from '../../lib/pull-to-refresh'
import { usePullToRefresh } from '../../lib/use-pull-to-refresh'
import { ListChecks, RefreshCw } from 'lucide-react'
import { getCharacterPickerRoster, toScheduleSyncError } from '../../features/schedule-sync/schedule-sync'
import type { ScheduleSyncError } from '../../features/schedule-sync/schedule-sync'
import { useNavigate } from 'react-router-dom'
import { getDailyQuestRegionIconUrl } from '../../lib/daily-quest-icons'
import { matchWeeklyRegionalQuestSlug } from '../../lib/weekly-regional-quest-matching'
import { mergeManualContentList, orderContentsByTemplate } from '../../lib/manual-content-merge'
import { CONTENT_TEMPLATE } from '../../lib/scheduler-content-template'
import { categorizeContentEntries, WEEKLY_CATEGORY_ORDER } from '../../lib/content-category'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { MEDIA_TEXT_SHADOW } from '../../lib/media-card'
import { ThemeHeaderBackdrop } from '../../components/ThemeHeaderBackdrop/ThemeHeaderBackdrop'
import { ProgressBar } from '../../components/ProgressBar/ProgressBar'

type ContentTab = 'daily' | 'weekly'

// ADR-035 결정 20: 수동 모드 표시 순서를 컨텐츠 관리 페이지와 동일하게 고정하려고, 템플릿을
// 관리 페이지와 같은 categorizeContentEntries 평탄화 순서로 미리 정렬해 mergeManualContentList에
// 넘긴다(일간은 첫 등장 순서, 주간은 WEEKLY_CATEGORY_ORDER). 캐릭터 무관 상수라 모듈 레벨에서 1회 계산.
const ORDERED_DAILY_TEMPLATE = categorizeContentEntries(CONTENT_TEMPLATE.daily).flatMap((group) =>
  group.items.map((item) => item.entry),
)
const ORDERED_WEEKLY_TEMPLATE = categorizeContentEntries(CONTENT_TEMPLATE.weekly, WEEKLY_CATEGORY_ORDER).flatMap(
  (group) => group.items.map((item) => item.entry),
)

// "몬스터파크"만 배경+아이콘 카드로 확장한다 — 다른 kind: 'contents' 항목이 생기면 그때
// 매핑 테이블로 일반화할지 재검토한다(현재는 인스턴스가 하나뿐이라 과설계 방지, ADR-020).
const MONSTER_PARK_NAME = '몬스터파크'
const MONSTER_PARK_BACKGROUND_SLUG = 'monsterPark'

// 주간 탭 카테고리 분류 상수 (ADR-021)
const EPIC_DUNGEON_PREFIX = '에픽 던전 : '
const EPIC_DUNGEON_BACKGROUND_SLUGS: Record<string, string> = {
  하이마운틴: 'ancientGodMitra',
  '앵글러 컴퍼니': 'senya',
  악몽선경: 'baekyeon',
}

const GUILD_PREFIX = '[길드] '
const GUILD_MISSION_POINTS_NAME = '[길드] 주간 미션 포인트'
const GUILD_UNDERGROUND_WATERWAY_NAME = '[길드] 지하 수로'
const GUILD_FLAG_RACE_NAME = '[길드] 플래그 레이스'
const GUILD_UNDERGROUND_WATERWAY_BACKGROUND_SLUG = 'arcanus'
const GUILD_MISSION_POINTS_BACKGROUND_SLUG = 'hallOfHeroes'
const GUILD_FLAG_RACE_BACKGROUND_SLUG = 'flagRace'

// 메이플 유니온 주간 드래곤 퇴치 — 실제로 등장하는 드래곤은 매주 바뀌지만 API가 어떤 드래곤인지
// 알려주지 않아, 에픽 던전 카드와 동일하게 대표 이미지 하나로 고정한다(ADR-021 연장, 2026-07-21).
const MAPLE_UNION_PREFIX = '[메이플 유니온] '
const MAPLE_UNION_DRAGON_BOSS_SLUG = 'armorDragon'

// "[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?"는 지역명이 문장 앞이 아니라 대괄호 태그로만
// 나타나 daily-quest-matching 방식의 접두어 제거 후 startsWith 매칭이 통하지 않는다. 대신
// weekly-regional-quests.json에 전체 문자열을 그대로 등록하고, 표시용으로만 이 접두어를 뗀다.
const MONSTER_PARK_EXTREME_PREFIX = '[몬스터파크] '

const QUEST_STATE_LABELS: Record<0 | 1 | 2, string> = {
  0: '시작 안함',
  1: '진행 중',
  2: '완료',
}

const QUEST_STATE_BADGE_CLASSES: Record<0 | 1 | 2, string> = {
  0: 'bg-surface-2 text-text-muted',
  1: 'bg-surface-2 text-text',
  2: 'bg-secondary-tint text-secondary-ink',
}

export function QuestStateBadge(props: { questState: 0 | 1 | 2 }): React.JSX.Element {
  const fontWeight = props.questState === 2 ? 'font-bold' : 'font-semibold'
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs ${fontWeight} ${QUEST_STATE_BADGE_CLASSES[props.questState]}`}
    >
      {QUEST_STATE_LABELS[props.questState]}
    </span>
  )
}

export function DailyQuestCard(props: {
  content: DailyContent
  crop?: DailyQuestRegionCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = stripDailyQuestPrefix(content.name)
  const backgroundSlug = matchDailyQuestRegionSlug(displayName)
  const backgroundUrl = getDailyQuestBackgroundUrl(backgroundSlug)
  const iconUrl = getDailyQuestRegionIconUrl(backgroundSlug)
  const crop = props.crop ?? getDailyQuestRegionCrop(backgroundSlug)
  const maskImage = 'linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)'

  // 카드 배경/보더/이름 텍스트는 BossCard와 동일하게 앱 테마와 무관하게 레테(다크) 고정 배색을
  // 쓴다 — 일러스트 bleed·페이드·text-shadow가 어두운 배경을 전제로 튜닝됐기 때문(ADR-018/020).
  return (
    <div className="media-scope relative h-20 overflow-hidden rounded-[14px] border border-border bg-surface">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            backgroundRepeat: 'no-repeat',
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage,
            WebkitMaskImage: maskImage,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          {iconUrl !== null && (
            <img src={iconUrl} alt="" className="h-6 w-6 shrink-0 object-contain" aria-hidden="true" />
          )}
          <span
            className="text-sm font-medium text-text"
            style={{ textShadow: MEDIA_TEXT_SHADOW }}
          >
            {displayName}
          </span>
        </div>

        {content.questState !== null && <QuestStateBadge questState={content.questState} />}
      </div>
    </div>
  )
}

export function MonsterParkCard(props: {
  content: DailyContent
  crop?: DailyQuestRegionCrop
}): React.JSX.Element {
  const { content } = props
  const backgroundUrl = getDailyQuestBackgroundUrl(MONSTER_PARK_BACKGROUND_SLUG)
  const iconUrl = getDailyQuestRegionIconUrl(MONSTER_PARK_BACKGROUND_SLUG)
  const crop = props.crop ?? getDailyQuestRegionCrop(MONSTER_PARK_BACKGROUND_SLUG)
  const maskImage = 'linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)'
  const progressPercent = content.maxCount > 0 ? Math.min((content.nowCount / content.maxCount) * 100, 100) : 0

  return (
    <div className="media-scope relative h-28 overflow-hidden rounded-[14px] border border-border bg-surface">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            backgroundRepeat: 'no-repeat',
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage,
            WebkitMaskImage: maskImage,
          }}
        />
      )}

      <div className="relative flex h-full flex-col">
        <div className="flex h-20 shrink-0 items-center justify-between" style={{ padding: '0 14px' }}>
          <div className="flex items-center gap-2">
            {iconUrl !== null && (
              <img src={iconUrl} alt="" className="h-6 w-6 shrink-0 object-contain" aria-hidden="true" />
            )}
            <span
              className="text-sm font-medium text-text"
              style={{ textShadow: MEDIA_TEXT_SHADOW }}
            >
              {content.name}
            </span>
          </div>

          <span className="rounded-full bg-third-tint px-2.5 py-1 text-xs font-semibold text-third-ink">
            {content.nowCount}/{content.maxCount}
          </span>
        </div>

        {content.maxCount > 0 && (
          <div className="flex flex-1 items-start px-[14px] pt-0">
            <ProgressBar
              percent={progressPercent}
              tone="third"
              aria={{ now: content.nowCount, max: content.maxCount }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// 카테고리별 배지 색(2026-07-21, 사용자 지시) — 에픽 던전은 아르카누스 배경의 푸른 전기빛과
// 맞춘 기존 색 유지, 메이플 유니온은 노란색 계열, 길드는 빨간색 계열로 구분.
const CATEGORY_BADGE_COLORS = {
  epicDungeon: 'bg-[#4DD2FF]/20 text-[#4DD2FF]',
  mapleUnion: 'bg-[#FFC93C]/20 text-[#FFC93C]',
  guild: 'bg-[#FF5C5C]/20 text-[#FF5C5C]',
} as const

function CategoryBadge(props: {
  label: string
  variant: keyof typeof CATEGORY_BADGE_COLORS
}): React.JSX.Element {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CATEGORY_BADGE_COLORS[props.variant]}`}>
      {props.label}
    </span>
  )
}

const CARD_MASK_IMAGE = 'linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)'

// 진행 중(1) 뱃지와 같은 톤의 중립 라벨 — "N층"·"N회 완료"처럼 0/1/2 상태가 아닌 진행 수치를
// 보여줘야 하는 카드에서 QuestStateBadge 대신 쓴다(2026-07-21, 사용자 지시).
function CountLabelBadge(props: { label: string }): React.JSX.Element {
  return <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text">{props.label}</span>
}

// 무릉도장은 quest_state가 아니라 참여 시 도달한 층수(1~100+)가 now_count에 그대로 기록된다.
// 성실한 조사에 대한 보답은 quest_state=1일 때 now_count/max_count(0~2)로 완료 횟수를 따로
// 세므로, quest_state 뱃지 대신 "N회 완료"를 보여주다가 now_count===max_count에서 완료로
// 전환한다(2026-07-21, 사용자 지시 — 두 항목 모두 weekly-quest-regions.json의 backgroundSlug로 구분).
const MU_LUNG_DOJO_BACKGROUND_SLUG = 'muruengRaid'
const FAITHFUL_INVESTIGATION_BACKGROUND_SLUG = 'roadOfVanishing'

function renderWeeklyQuestStatus(content: WeeklyContent, backgroundSlug: string | null): React.ReactNode {
  if (backgroundSlug === MU_LUNG_DOJO_BACKGROUND_SLUG) {
    return content.nowCount > 0 ? <CountLabelBadge label={`${content.nowCount}층`} /> : <QuestStateBadge questState={0} />
  }

  if (backgroundSlug === FAITHFUL_INVESTIGATION_BACKGROUND_SLUG) {
    if (content.nowCount === content.maxCount && content.maxCount > 0) {
      return <QuestStateBadge questState={2} />
    }
    if (content.questState === 1) {
      return <CountLabelBadge label={`${content.nowCount}회 완료`} />
    }
  }

  return content.questState !== null ? <QuestStateBadge questState={content.questState} /> : null
}

export function EpicDungeonCard(props: {
  content: WeeklyContent
  crop?: BossPortraitCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = content.name.startsWith(EPIC_DUNGEON_PREFIX)
    ? content.name.slice(EPIC_DUNGEON_PREFIX.length)
    : content.name
  const backgroundSlug = EPIC_DUNGEON_BACKGROUND_SLUGS[displayName] ?? null
  const backgroundUrl = getBossPortraitUrl(backgroundSlug)
  const crop = props.crop ?? getBossPortraitCrop(backgroundSlug)
  const questState: 0 | 2 = content.nowCount > 0 ? 2 : 0

  return (
    <div className="media-scope relative h-20 overflow-hidden rounded-[14px] border border-border bg-surface">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            backgroundRepeat: 'no-repeat',
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage: CARD_MASK_IMAGE,
            WebkitMaskImage: CARD_MASK_IMAGE,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          <CategoryBadge label="에픽 던전" variant="epicDungeon" />
          <span className="text-sm font-medium text-text" style={{ textShadow: MEDIA_TEXT_SHADOW }}>
            {displayName}
          </span>
        </div>

        <QuestStateBadge questState={questState} />
      </div>
    </div>
  )
}

export function WeeklyRegionalContentCard(props: {
  content: WeeklyContent
  crop?: DailyQuestRegionCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = content.name.startsWith(MONSTER_PARK_EXTREME_PREFIX)
    ? content.name.slice(MONSTER_PARK_EXTREME_PREFIX.length)
    : content.name
  const backgroundSlug = matchWeeklyRegionalQuestSlug(content.name)
  const backgroundUrl = getDailyQuestBackgroundUrl(backgroundSlug)
  const iconUrl = getDailyQuestRegionIconUrl(backgroundSlug)
  const crop = props.crop ?? getDailyQuestRegionCrop(backgroundSlug)
  // 익스트림 몬스터파커는 다른 6개 지역 콘텐츠와 달리 now_count/max_count가 아니라 실제
  // quest_state(0/1/2)로 진행 상태를 준다(2026-07-21, 사용자 지시).
  const questState: 0 | 1 | 2 | null =
    backgroundSlug === MONSTER_PARK_BACKGROUND_SLUG
      ? content.questState
      : content.nowCount === content.maxCount && content.maxCount > 0
        ? 2
        : 0

  return (
    <div className="media-scope relative h-20 overflow-hidden rounded-[14px] border border-border bg-surface">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            backgroundRepeat: 'no-repeat',
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage: CARD_MASK_IMAGE,
            WebkitMaskImage: CARD_MASK_IMAGE,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          {iconUrl !== null && (
            <img src={iconUrl} alt="" className="h-6 w-6 shrink-0 object-contain" aria-hidden="true" />
          )}
          <span className="text-sm font-medium text-text" style={{ textShadow: MEDIA_TEXT_SHADOW }}>
            {displayName}
          </span>
        </div>

        {questState !== null && <QuestStateBadge questState={questState} />}
      </div>
    </div>
  )
}

export function WeeklyQuestCard(props: {
  content: WeeklyContent
  crop?: DailyQuestRegionCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = stripWeeklyQuestPrefix(content.name)
  const backgroundSlug = matchWeeklyQuestRegionSlug(displayName)
  const backgroundUrl = getDailyQuestBackgroundUrl(backgroundSlug)
  const iconUrl = getDailyQuestRegionIconUrl(backgroundSlug)
  const crop = props.crop ?? getDailyQuestRegionCrop(backgroundSlug)

  return (
    <div className="media-scope relative h-20 overflow-hidden rounded-[14px] border border-border bg-surface">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            backgroundRepeat: 'no-repeat',
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage: CARD_MASK_IMAGE,
            WebkitMaskImage: CARD_MASK_IMAGE,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          {iconUrl !== null && (
            <img src={iconUrl} alt="" className="h-6 w-6 shrink-0 object-contain" aria-hidden="true" />
          )}
          <span className="text-sm font-medium text-text" style={{ textShadow: MEDIA_TEXT_SHADOW }}>
            {displayName}
          </span>
        </div>

        {renderWeeklyQuestStatus(content, backgroundSlug)}
      </div>
    </div>
  )
}

export function MapleUnionDragonCard(props: {
  content: WeeklyContent
  crop?: BossPortraitCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = content.name.startsWith(MAPLE_UNION_PREFIX)
    ? content.name.slice(MAPLE_UNION_PREFIX.length)
    : content.name
  const backgroundUrl = getBossPortraitUrl(MAPLE_UNION_DRAGON_BOSS_SLUG)
  const crop = props.crop ?? getBossPortraitCrop(MAPLE_UNION_DRAGON_BOSS_SLUG)

  return (
    <div className="media-scope relative h-20 overflow-hidden rounded-[14px] border border-border bg-surface">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            backgroundRepeat: 'no-repeat',
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage: CARD_MASK_IMAGE,
            WebkitMaskImage: CARD_MASK_IMAGE,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          <CategoryBadge label="유니온" variant="mapleUnion" />
          <span className="text-sm font-medium text-text" style={{ textShadow: MEDIA_TEXT_SHADOW }}>
            {displayName}
          </span>
        </div>

        {content.questState !== null && <QuestStateBadge questState={content.questState} />}
      </div>
    </div>
  )
}

function stripGuildPrefix(name: string): string {
  return name.startsWith(GUILD_PREFIX) ? name.slice(GUILD_PREFIX.length) : name
}

export function GuildUndergroundWaterwayCard(props: {
  content: WeeklyContent
  crop?: BossPortraitCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = stripGuildPrefix(content.name)
  const backgroundUrl = getBossPortraitUrl(GUILD_UNDERGROUND_WATERWAY_BACKGROUND_SLUG)
  const crop = props.crop ?? getBossPortraitCrop(GUILD_UNDERGROUND_WATERWAY_BACKGROUND_SLUG)

  return (
    <div className="media-scope relative h-20 overflow-hidden rounded-[14px] border border-border bg-surface">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            backgroundRepeat: 'no-repeat',
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage: CARD_MASK_IMAGE,
            WebkitMaskImage: CARD_MASK_IMAGE,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          <CategoryBadge label="길드" variant="guild" />
          <span className="text-sm font-medium text-text" style={{ textShadow: MEDIA_TEXT_SHADOW }}>
            {displayName}
          </span>
        </div>

        <span className="rounded-full bg-third-tint px-2.5 py-1 text-xs font-semibold text-third-ink">
          {content.nowCount}점
        </span>
      </div>
    </div>
  )
}

export function GuildMissionPointsCard(props: {
  content: WeeklyContent
  crop?: DailyQuestRegionCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = stripGuildPrefix(content.name)
  const backgroundUrl = getDailyQuestBackgroundUrl(GUILD_MISSION_POINTS_BACKGROUND_SLUG)
  const crop = props.crop ?? getDailyQuestRegionCrop(GUILD_MISSION_POINTS_BACKGROUND_SLUG)
  const progressPercent = content.maxCount > 0 ? Math.min((content.nowCount / content.maxCount) * 100, 100) : 0

  return (
    <div className="media-scope relative h-28 overflow-hidden rounded-[14px] border border-border bg-surface">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            backgroundRepeat: 'no-repeat',
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage: CARD_MASK_IMAGE,
            WebkitMaskImage: CARD_MASK_IMAGE,
          }}
        />
      )}

      <div className="relative flex h-full flex-col">
        <div className="flex h-20 shrink-0 items-center justify-between" style={{ padding: '0 14px' }}>
          <div className="flex items-center gap-2">
            <CategoryBadge label="길드" variant="guild" />
            <span className="text-sm font-medium text-text" style={{ textShadow: MEDIA_TEXT_SHADOW }}>
              {displayName}
            </span>
          </div>

          <span className="rounded-full bg-third-tint px-2.5 py-1 text-xs font-semibold text-third-ink">
            {content.nowCount}/{content.maxCount}
          </span>
        </div>

        {content.maxCount > 0 && (
          <div className="flex flex-1 items-start px-[14px] pt-0">
            <ProgressBar
              percent={progressPercent}
              tone="third"
              aria={{ now: content.nowCount, max: content.maxCount }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function GuildFlagRaceCard(props: {
  content: WeeklyContent
  crop?: DailyQuestRegionCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = stripGuildPrefix(content.name)
  const backgroundUrl = getDailyQuestBackgroundUrl(GUILD_FLAG_RACE_BACKGROUND_SLUG)
  const crop = props.crop ?? getDailyQuestRegionCrop(GUILD_FLAG_RACE_BACKGROUND_SLUG)
  const questState: 0 | 2 = content.nowCount > 0 ? 2 : 0

  return (
    <div className="media-scope relative h-20 overflow-hidden rounded-[14px] border border-border bg-surface">
      {backgroundUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            backgroundRepeat: 'no-repeat',
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage: CARD_MASK_IMAGE,
            WebkitMaskImage: CARD_MASK_IMAGE,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          <CategoryBadge label="길드" variant="guild" />
          <span className="text-sm font-medium text-text" style={{ textShadow: MEDIA_TEXT_SHADOW }}>
            {displayName}
          </span>
        </div>

        <QuestStateBadge questState={questState} />
      </div>
    </div>
  )
}

// 카드 종류 분기를 한 곳으로 모은다. 카드 컴포넌트 자체는 그대로 재사용한다.
function renderDailyContentCard(content: DailyContent): React.JSX.Element {
  if (content.kind === 'quest') {
    return <DailyQuestCard content={content} />
  }

  if (content.name === MONSTER_PARK_NAME) {
    return <MonsterParkCard content={content} />
  }

  return (
    <div className="rounded-[14px] bg-surface border border-border p-4 space-y-2">
      <p className="text-sm text-text">
        {content.name} · {content.nowCount}/{content.maxCount}
      </p>
      {content.maxCount > 0 && (
        <ProgressBar
          percent={Math.min((content.nowCount / content.maxCount) * 100, 100)}
          aria={{ now: content.nowCount, max: content.maxCount }}
        />
      )}
    </div>
  )
}

function renderWeeklyContentCard(content: WeeklyContent): React.JSX.Element {
  if (content.name === GUILD_UNDERGROUND_WATERWAY_NAME) {
    return <GuildUndergroundWaterwayCard content={content} />
  }

  if (content.name === GUILD_MISSION_POINTS_NAME) {
    return <GuildMissionPointsCard content={content} />
  }

  if (content.name === GUILD_FLAG_RACE_NAME) {
    return <GuildFlagRaceCard content={content} />
  }

  if (content.name.startsWith(EPIC_DUNGEON_PREFIX)) {
    return <EpicDungeonCard content={content} />
  }

  if (matchWeeklyRegionalQuestSlug(content.name) !== null) {
    return <WeeklyRegionalContentCard content={content} />
  }

  if (content.name.startsWith(MAPLE_UNION_PREFIX)) {
    return <MapleUnionDragonCard content={content} />
  }

  if (matchWeeklyQuestRegionSlug(stripWeeklyQuestPrefix(content.name)) !== null) {
    return <WeeklyQuestCard content={content} />
  }

  return (
    <div className="rounded-[14px] bg-surface border border-border p-4 space-y-2">
      <p className="text-sm text-text">
        {content.name} · {content.nowCount}/{content.maxCount}
      </p>
      {content.maxCount > 0 && (
        <ProgressBar
          percent={Math.min((content.nowCount / content.maxCount) * 100, 100)}
          aria={{ now: content.nowCount, max: content.maxCount }}
        />
      )}
    </div>
  )
}

export function ContentScreen(): React.JSX.Element {
  const {
    status,
    characters,
    error,
    trackedOcids,
    selectedOcid,
    manualTrackedByOcid,
    loadTrackedOcids,
    saveTrackedOcids,
    refresh,
    selectCharacter,
  } = useContentSchedulerStore()
  const { mode } = useTrackingModeStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ContentTab>('daily')
  const [roster, setRoster] = useState<CharacterPickerEntry[]>([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  // ADR-063: 동기화 전체 실패는 인라인 문단이 아니라 토스트로 알린다 — 지속 상태("n분 전")는
  // 새로고침 옆 표기가 이미 담당하고, 토스트에는 원인을 푸는 액션을 붙일 수 있다.
  useScheduleSyncErrorToast(error, {
    onRetry: () => refresh(trackedOcids ?? []),
    onOpenSettings: () => navigate('/settings'),
  })

  // ADR-053 결정 3: 후보 목록 조회의 로딩·실패는 조회를 소유한 화면이 관리해 피커에 내려준다.
  // 초기값은 "마운트 직후 조회가 시작되는가"(= 피커가 이미 열려 있는가)와 같다.
  const [isRosterLoading, setIsRosterLoading] = useState(isPickerOpen)
  const [rosterError, setRosterError] = useState<ScheduleSyncError | null>(null)
  // ADR-062: 재조회 트리거. 피커를 여는 것과 재시도가 같은 초기화(reloadRoster)를 공유하고,
  // 이 값이 바뀌면 아래 조회 effect가 다시 돈다.
  const [rosterReloadNonce, setRosterReloadNonce] = useState(0)
  const [saveProgress, setSaveProgress] = useState<{ completed: number; total: number } | null>(null)

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ADR-015: 후보 목록에 이미지·access_flag가 필요해져 피커를 열 때만 조회한다
  // (마운트 시 매번 호출하면 화면에 들어오기만 해도 캐릭터 수만큼 병렬 호출이 발생함).
  // ADR-016: 캐시가 있으면 즉시 그 값으로 먼저 그리고, character/basic 응답이 하나씩
  // 도착하는 대로 patch한다(전체를 기다리지 않음).
  // ADR-017 결정 6: character/list 응답을 기다리는 동안에도 character-basic-cache에 이미
  // 있는 캐릭터(추적 여부 무관)는 즉시 먼저 보여줘, 피커를 열 때마다 짧게 비어 보이던 문제를
  // 완화한다.
  // ADR-053 결정 3: 조회 결과(Promise)를 버리지 않고 로딩·실패 상태로 남긴다 — 401/429는 reject로
  // 나오므로 finally에서 반드시 로딩을 해제해야 스피너가 영구히 걸리지 않는다. roster는 재조회
  // 시작 시에도 비우지 않는다(캐시로 보여주던 목록을 지우면 ADR-016 캐시 우선 표시가 무력화된다).
  useEffect(() => {
    if (!isPickerOpen) return
    let cancelled = false
    getCharacterPickerRoster((entries) => {
      if (!cancelled) setRoster(entries)
    })
      .catch((error: unknown) => {
        if (!cancelled) setRosterError(toScheduleSyncError(error))
      })
      .finally(() => {
        if (!cancelled) setIsRosterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isPickerOpen, rosterReloadNonce])

  const isEmpty = trackedOcids === null || trackedOcids.length === 0

  // ADR-072: 목록 최상단에서 당기면 헤더 새로고침 버튼과 같은 재조회가 돈다(제스처는 추가 수단이다).
  // 빈 상태에서는 당길 목록이 없어 끄고(결정 13), 재조회 중에는 새 당김을 시작하지 않는다(결정 12).
  // 훅 호출은 아래 빈 상태 조기 반환보다 반드시 위여야 한다 — 훅 규칙.
  const pullToRefresh = usePullToRefresh({
    enabled: !isEmpty,
    isRefreshing: status === 'loading',
    onRefresh: () => refresh(trackedOcids ?? []),
  })

  // ADR-073 결정 6: 목록이 내려가는 거리이자 인디케이터가 채우는 틈의 높이다 — 인디케이터와 같은
  // 함수·같은 인자를 쓴다. 두 벌로 계산하면 값이 어긋나는 순간 인디케이터가 카드 위에 겹치거나
  // 반대로 빈 띠가 남는다.
  const pullOffset = resolveContentOffsetPx(pullToRefresh.distance, pullToRefresh.phase)

  const effectiveSelectedOcid =
    selectedOcid !== null && characters.some((character) => character.ocid === selectedOcid)
      ? selectedOcid
      : (characters[0]?.ocid ?? null)

  const selected = characters.find((character) => character.ocid === effectiveSelectedOcid) ?? null

  // ADR-083 결정 1: 캐릭터별 실패도 인라인 문단이 아니라 토스트다(보스 스케줄러와 동일한 배선).
  // syncSchedules가 캐릭터 단위 실패를 던지지 않고 결과에 실어 반환하므로 실패의 대부분이 위의
  // 전역 error가 아니라 이 값으로 온다.
  useScheduleSyncErrorToast(selected?.error ?? null, {
    onRetry: () => refresh(trackedOcids ?? []),
    onOpenSettings: () => navigate('/settings'),
  })

  // ADR-035 결정 3·6·19: 수동 모드에서는 게임 등록 여부(isRegistered)가 아니라 사용자가 앱에서
  // 관리하는 멤버십(manualTrackedContent)으로 표시 목록을 결정하고, 실제 값은 동기화 결과 또는
  // 템플릿에서 즉석 조회한다(mergeManualContentList). 멤버십의 kind('daily'/'weekly')가 저장
  // 시점에 확정돼 있어 각 탭은 자기 kind 항목만 그린다. auto 모드는 기존대로 등록 항목만 표시한다.
  const manualItems = selected !== null ? (manualTrackedByOcid?.[selected.ocid] ?? []) : []

  const displayDailyContents: DailyContent[] =
    selected === null
      ? []
      : mode === 'manual'
        ? mergeManualContentList(
            manualItems.filter((item) => item.kind === 'daily'),
            selected.dailyContents,
            ORDERED_DAILY_TEMPLATE,
          )
        : // auto 모드도 수동 모드와 동일한 template 순서로 표시한다.
          orderContentsByTemplate(
            selected.dailyContents.filter((content) => content.isRegistered),
            ORDERED_DAILY_TEMPLATE,
          )

  const displayWeeklyContents: WeeklyContent[] =
    selected === null
      ? []
      : mode === 'manual'
        ? (mergeManualContentList(
            manualItems.filter((item) => item.kind === 'weekly'),
            selected.weeklyContents,
            ORDERED_WEEKLY_TEMPLATE,
          ) as WeeklyContent[])
        : // auto 모드도 수동 모드와 동일한 template 순서로 표시한다.
          orderContentsByTemplate(
            selected.weeklyContents.filter((content) => content.isRegistered),
            ORDERED_WEEKLY_TEMPLATE,
          )

  async function handleSaveTracking(ocids: string[]): Promise<void> {
    setSaveProgress({ completed: 0, total: ocids.length })
    // 저장이 실패해도(스토어가 처리 못한 예외 등) 진행률 모달은 항상 닫는다 — 안 그러면 모달이 멈춘다.
    try {
      await saveTrackedOcids(ocids, (completed, total) => setSaveProgress({ completed, total }))
    } finally {
      setSaveProgress(null)
      setIsPickerOpen(false)
    }
  }

  // ADR-053 결정 3: 피커를 여는 유일한 경로 — 여는 순간 로딩·실패를 초기화한다(닫았다 다시 열면
  // 아래 useEffect가 재조회하므로 직전 실패가 남아 있으면 안 된다). 초기화를 effect 본문이 아니라
  // 이 이벤트 핸들러에 두는 이유는 effect 본문의 동기 setState가 cascading render를 만들기 때문.
  // ADR-062 트레이드오프: 여는 경로와 재시도가 같은 초기화를 쓴다 — 재조회 로직을 한 곳으로 모은다.
  function reloadRoster(): void {
    setIsRosterLoading(true)
    setRosterError(null)
    setRosterReloadNonce((nonce) => nonce + 1)
  }

  function openPicker(): void {
    setIsPickerOpen(true)
    reloadRoster()
  }

  const characterManageButton = (
    <button
      type="button"
      onClick={openPicker}
      className="text-sm font-medium text-text-muted hover:text-text"
    >
      캐릭터 관리
    </button>
  )

  // ADR-035 결정 18: 수동 모드의 추적 항목 편집은 이 화면이 아니라 전용 관리 페이지에서 한다.
  const manualManageButton = mode === 'manual' && (
    <button
      type="button"
      onClick={() => navigate('/content/manage')}
      className="text-sm font-medium text-text-muted hover:text-text"
    >
      컨텐츠 관리
    </button>
  )

  // ADR-060: 빈 상태 문구는 탭(일간/주간)과 모드(수동/자동)별로 나눈다. 수동 모드만 CTA를 준다 —
  // 자동 모드가 지시하는 곳("게임에서 등록")은 앱 밖이라 데려다줄 수 없다.
  function contentEmptyProps(tab: 'daily' | 'weekly'): React.ComponentProps<typeof EmptyState> {
    const label = tab === 'daily' ? '일간' : '주간'
    if (mode === 'manual') {
      return {
        icon: ListChecks,
        title: `추적할 ${label} 컨텐츠가 없습니다`,
        description: `컨텐츠 관리에서 ${tab === 'daily' ? '매일 챙길' : '주간'} 항목을 골라주세요`,
        action: { label: '컨텐츠 관리', onClick: () => navigate('/content/manage') },
      }
    }
    return {
      icon: ListChecks,
      title: `등록된 ${label} 컨텐츠가 없습니다`,
      description: '게임 내 스케줄러에 등록하면 여기에 자동으로 표시됩니다',
    }
  }

  const trackingPicker = isPickerOpen && (
    <CharacterTrackingPicker
      entries={roster}
      trackedOcids={trackedOcids ?? []}
      isLoading={isRosterLoading}
      loadError={rosterError}
      onSave={handleSaveTracking}
      onClose={() => setIsPickerOpen(false)}
      onRetry={reloadRoster}
      onOpenSettings={() => navigate('/settings')}
    />
  )

  // 저장 중에는 캐릭터 관리 모달 위에 진행률 모달을 띄운다(완료 시 둘 다 닫힌다).
  const trackingModals = (
    <>
      {trackingPicker}
      {saveProgress !== null && (
        <ProgressModal
          message="캐릭터 정보를 저장하고 있어요"
          completed={saveProgress.completed}
          total={saveProgress.total}
        />
      )}
    </>
  )

  if (isEmpty) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--sa-top)-var(--sa-bottom)-4rem)] flex-col p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text">컨텐츠 스케줄러</h1>
          {characterManageButton}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <EmptyState
            size="page"
            icon="leaf"
            title="표시할 캐릭터가 없습니다"
            description="캐릭터를 선택하면 일간·주간 컨텐츠를 확인할 수 있습니다"
            action={{ label: '캐릭터 선택하기', onClick: openPicker }}
          />
        </div>

        {trackingModals}
      </div>
    )
  }

  return (
    <div className="-mt-[var(--sa-top)] space-y-4">
      {/* 제목~탭까지는 화면 상단에 고정하고 그 아래 컨텐츠 목록만 스크롤되게 한다 — sticky는
          페이지 스크롤 위에서 동작하므로 App.tsx의 레이아웃(높이 계산)을 건드릴 필요가 없다.
          sticky 박스는 top-0으로 화면 맨 위(노치 포함)부터 bg-bg로 덮어야 스크롤 중에도 그
          위 카드가 비치지 않는다 — top을 안전영역만큼 내리면 그 위 구간은 아무것도 덮지
          못해 스크롤되는 카드가 노치 뒤로 비쳐 보인다. 대신 padding-top에 안전영역을 더해
          텍스트만 내려 보이게 하고, 바깥 AppShell의 padding-top과 중복되지 않도록 위
          -mt-[var(--sa-top)]로 상쇄한다. z-10으로 항상 위에 그려지게 한다. */}
      <div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
        {/* ADR-088 결정 5-1: 헤더 자리의 테마 배경 조각(배경 없는 테마에선 렌더 안 됨) */}
        <ThemeHeaderBackdrop />
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text">컨텐츠 스케줄러</h1>
            <div className="flex items-center gap-4">
              {manualManageButton}
              {characterManageButton}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              {characters.length > 0 && selected !== null && (
                <CharacterSelectDropdown
                  characters={characters}
                  selectedOcid={selected.ocid}
                  onSelect={(ocid) => {
                    void selectCharacter(ocid)
                  }}
                />
              )}

              <div className="ml-auto flex shrink-0 items-center gap-2">
                <p className="text-sm text-text-muted whitespace-nowrap">
                  {status === 'loading' ? '조회 중...' : selected !== null ? formatSyncedAt(selected.syncedAt) : ''}
                </p>
                <button
                  type="button"
                  onClick={() => refresh(trackedOcids ?? [])}
                  aria-label="새로고침"
                  className="p-2 text-primary-ink hover:text-primary-hover"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

          </div>

          {/* ADR-016: 캐시된 characters가 있으면 재검증(status: 'loading') 중에도 계속 보여준다 —
              셸 승계 카드는 보여줄 데이터가 아예 없을 때만 그린다([[ADR-061]] 결정 2). */}
          {(status === 'idle' || status === 'loading') && characters.length === 0 && (
            <LoadingState size="page" message="불러오고 있어요" />
          )}

          {characters.length > 0 && selected !== null && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('daily')}
                className={
                  activeTab === 'daily'
                    ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
                    : 'px-3 text-sm font-medium text-text-muted'
                }
              >
                일간
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('weekly')}
                className={
                  activeTab === 'weekly'
                    ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
                    : 'px-3 text-sm font-medium text-text-muted'
                }
              >
                주간
              </button>
            </div>
          )}
        </div>

        {/* 헤더 아래에 살짝 겹쳐 그라데이션+블러로 항목이 잘려 보이지 않고 자연스럽게
            사라지도록 한다 — 배경(bg-bg → transparent)과 블러 강도를 같은 마스크로 함께
            줄여서, 색만 옅어지고 블러는 그대로인 부자연스러운 경계가 생기지 않게 한다. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-bg to-transparent backdrop-blur-sm"
          style={{
            maskImage: 'linear-gradient(to bottom, black, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
          }}
          aria-hidden="true"
        />

        {/* ADR-072 결정 5: 인디케이터와 위 페이드가 같은 자리(absolute top-full)를 쓰므로, z-index를 새로
            도입하는 대신 DOM 순서(페이드 "다음" 형제)로 인디케이터가 위에 오게 한다. */}
        <PullToRefreshIndicator distance={pullToRefresh.distance} phase={pullToRefresh.phase} />
      </div>

      {/* ADR-073 결정 1·2: 헤더는 sticky로 제자리에 두고 이 목록 블록만 손가락을 따라 내려간다.
          마진·높이가 아니라 transform 이라 터치 프레임마다의 리플로우가 없다. 오프셋이 0이면
          transform 을 아예 걸지 않는다(결정 3) — translateY(0px) 조차 containing block·stacking
          context를 만들어 sticky 후손(ADR-047 중첩 카드 헤더)의 기준을 바꾼다. 반면 transition 은
          어떤 컨텍스트도 만들지 않으므로 항상 걸어둔다. 그래야 오프셋이 0으로 돌아갈 때 복귀
          애니메이션이 살고(붙였다 떼면 마지막 프레임에 전환이 없어 순간이동한다), 드래그 중에만
          'none' 이다(결정 4) — 손가락이 붙어 있는데 전환이 걸리면 목록이 늘 뒤처져 그려진다. */}
      {characters.length > 0 && selected !== null && (
        <div
          data-testid="pull-content"
          className="space-y-4 px-4 pb-4"
          style={{
            transform: pullOffset > 0 ? `translateY(${pullOffset}px)` : undefined,
            transition: pullToRefresh.isDragging ? 'none' : PULL_SETTLE_TRANSITION,
          }}
        >
          {activeTab === 'daily' && (
            <>
              {displayDailyContents.length === 0 && (mode === 'manual' || !selected.isStale) && (
                <EmptyState {...contentEmptyProps('daily')} />
              )}

              {displayDailyContents.length > 0 && (
                <ul className="space-y-2">
                  {displayDailyContents.map((content) => (
                    <li key={content.name}>{renderDailyContentCard(content)}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          {activeTab === 'weekly' && (
            <>
              {displayWeeklyContents.length === 0 && (mode === 'manual' || !selected.isStale) && (
                <EmptyState {...contentEmptyProps('weekly')} />
              )}

              {displayWeeklyContents.length > 0 && (
                <ul className="space-y-2">
                  {displayWeeklyContents.map((content) => (
                    <li key={content.name}>{renderWeeklyContentCard(content)}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {trackingModals}
    </div>
  )
}
