import type { CharacterPickerEntry, DailyContent, WeeklyContent } from '../../types'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'
import { getBossPortraitCrop, getBossPortraitUrl } from '../../lib/boss-icons'
import { getDailyQuestBackgroundUrl, getDailyQuestRegionCrop } from '../../lib/daily-quest-backgrounds'
import { matchDailyQuestRegionSlug, stripDailyQuestPrefix } from '../../lib/daily-quest-matching'
import { matchWeeklyQuestRegionSlug, stripWeeklyQuestPrefix } from '../../lib/weekly-quest-matching'
import { useEffect, useState } from 'react'

import type { BossPortraitCrop } from '../../lib/boss-icons'
import { CharacterSelectDropdown } from '../../components/CharacterSelectDropdown/CharacterSelectDropdown'
import { CharacterTrackingPicker } from '../../components/CharacterTrackingPicker/CharacterTrackingPicker'
import type { DailyQuestRegionCrop } from '../../lib/daily-quest-backgrounds'
import { MAPLE_LEAF_PATH } from '../../components/mapleLeafPath'
import { ManualContentPickerModal } from './ManualContentPickerModal'
import { ProgressModal } from '../../components/ProgressModal/ProgressModal'
import { RefreshCw, X } from 'lucide-react'
import { getCharacterPickerRoster } from '../../features/schedule-sync/schedule-sync'
import { getDailyQuestRegionIconUrl } from '../../lib/daily-quest-icons'
import { matchWeeklyRegionalQuestSlug } from '../../lib/weekly-regional-quest-matching'
import { mergeManualContentList, type SchedulerContentTemplateEntry } from '../../lib/manual-content-merge'
import schedulerContentTemplate from '../../data/scheduler-content-template.json'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'

type ContentTab = 'daily' | 'weekly'

const contentTemplate = schedulerContentTemplate as {
  daily: SchedulerContentTemplateEntry[]
  weekly: SchedulerContentTemplateEntry[]
}

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
  0: 'bg-white/10 text-[#E8DFEC]/70',
  1: 'bg-white/20 text-[#E8DFEC]',
  2: 'bg-secondary text-bg',
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
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
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
            className="text-sm font-medium text-[#E8DFEC]"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6)' }}
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
    <div className="relative h-28 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
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
              className="text-sm font-medium text-[#E8DFEC]"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6)' }}
            >
              {content.name}
            </span>
          </div>

          <span className="rounded-full bg-third/20 px-2.5 py-1 text-xs font-semibold text-third">
            {content.nowCount}/{content.maxCount}
          </span>
        </div>

        {content.maxCount > 0 && (
          <div className="flex flex-1 items-start px-[14px] pt-0">
            <div
              role="progressbar"
              aria-valuenow={content.nowCount}
              aria-valuemin={0}
              aria-valuemax={content.maxCount}
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/15"
            >
              <div className="h-1.5 rounded-full bg-third" style={{ width: `${progressPercent}%` }} />
            </div>
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
const CARD_NAME_TEXT_SHADOW = '0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6)'

// 진행 중(1) 뱃지와 같은 톤의 중립 라벨 — "N층"·"N회 완료"처럼 0/1/2 상태가 아닌 진행 수치를
// 보여줘야 하는 카드에서 QuestStateBadge 대신 쓴다(2026-07-21, 사용자 지시).
function CountLabelBadge(props: { label: string }): React.JSX.Element {
  return <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-[#E8DFEC]">{props.label}</span>
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
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
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
          <span className="text-sm font-medium text-[#E8DFEC]" style={{ textShadow: CARD_NAME_TEXT_SHADOW }}>
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
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
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
          <span className="text-sm font-medium text-[#E8DFEC]" style={{ textShadow: CARD_NAME_TEXT_SHADOW }}>
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
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
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
          <span className="text-sm font-medium text-[#E8DFEC]" style={{ textShadow: CARD_NAME_TEXT_SHADOW }}>
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
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
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
          <span className="text-sm font-medium text-[#E8DFEC]" style={{ textShadow: CARD_NAME_TEXT_SHADOW }}>
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
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
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
          <span className="text-sm font-medium text-[#E8DFEC]" style={{ textShadow: CARD_NAME_TEXT_SHADOW }}>
            {displayName}
          </span>
        </div>

        <span className="rounded-full bg-third/20 px-2.5 py-1 text-xs font-semibold text-third">
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
    <div className="relative h-28 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
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
            <span className="text-sm font-medium text-[#E8DFEC]" style={{ textShadow: CARD_NAME_TEXT_SHADOW }}>
              {displayName}
            </span>
          </div>

          <span className="rounded-full bg-third/20 px-2.5 py-1 text-xs font-semibold text-third">
            {content.nowCount}/{content.maxCount}
          </span>
        </div>

        {content.maxCount > 0 && (
          <div className="flex flex-1 items-start px-[14px] pt-0">
            <div
              role="progressbar"
              aria-valuenow={content.nowCount}
              aria-valuemin={0}
              aria-valuemax={content.maxCount}
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/15"
            >
              <div className="h-1.5 rounded-full bg-third" style={{ width: `${progressPercent}%` }} />
            </div>
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
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
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
          <span className="text-sm font-medium text-[#E8DFEC]" style={{ textShadow: CARD_NAME_TEXT_SHADOW }}>
            {displayName}
          </span>
        </div>

        <QuestStateBadge questState={questState} />
      </div>
    </div>
  )
}

// 카드 종류 분기를 한 곳으로 모아, 리스트가 각 카드를 <li> 하나로 감싸(수동 모드 삭제 버튼을
// 얹을 자리) 렌더링할 수 있게 한다. 카드 컴포넌트 자체는 그대로 재사용한다.
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
        <div
          role="progressbar"
          aria-valuenow={content.nowCount}
          aria-valuemin={0}
          aria-valuemax={content.maxCount}
          className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden"
        >
          <div
            className="h-1.5 rounded-full bg-primary"
            style={{ width: `${Math.min((content.nowCount / content.maxCount) * 100, 100)}%` }}
          />
        </div>
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
        <div
          role="progressbar"
          aria-valuenow={content.nowCount}
          aria-valuemin={0}
          aria-valuemax={content.maxCount}
          className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden"
        >
          <div
            className="h-1.5 rounded-full bg-primary"
            style={{ width: `${Math.min((content.nowCount / content.maxCount) * 100, 100)}%` }}
          />
        </div>
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
    addManualContent,
    removeManualContent,
  } = useContentSchedulerStore()
  const { mode } = useTrackingModeStore()
  const [activeTab, setActiveTab] = useState<ContentTab>('daily')
  const [roster, setRoster] = useState<CharacterPickerEntry[]>([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [manualPickerTab, setManualPickerTab] = useState<ContentTab | null>(null)
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
  useEffect(() => {
    if (!isPickerOpen) return
    let cancelled = false
    getCharacterPickerRoster((entries) => {
      if (!cancelled) setRoster(entries)
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isPickerOpen])

  const isEmpty = trackedOcids === null || trackedOcids.length === 0

  const effectiveSelectedOcid =
    selectedOcid !== null && characters.some((character) => character.ocid === selectedOcid)
      ? selectedOcid
      : (characters[0]?.ocid ?? null)

  const selected = characters.find((character) => character.ocid === effectiveSelectedOcid) ?? null

  // ADR-035 결정 3·6: 수동 모드에서는 게임 등록 여부(isRegistered)가 아니라 사용자가 앱에서
  // 관리하는 멤버십(manualTrackedContent)으로 표시 목록을 결정하고, 실제 값은 동기화 결과 또는
  // 템플릿에서 즉석 조회한다(mergeManualContentList). auto 모드는 기존대로 등록 항목만 표시한다.
  const manualContentItems =
    selected !== null
      ? (manualTrackedByOcid?.[selected.ocid] ?? []).filter((item) => item.kind === 'content')
      : []

  const displayDailyContents: DailyContent[] =
    selected === null
      ? []
      : mode === 'manual'
        ? mergeManualContentList(manualContentItems, selected.dailyContents, contentTemplate.daily)
        : selected.dailyContents.filter((content) => content.isRegistered)

  const displayWeeklyContents: WeeklyContent[] =
    selected === null
      ? []
      : mode === 'manual'
        ? (mergeManualContentList(manualContentItems, selected.weeklyContents, contentTemplate.weekly) as WeeklyContent[])
        : selected.weeklyContents.filter((content) => content.isRegistered)

  function handleAddManualContent(contentName: string): void {
    if (selected !== null) void addManualContent(selected.ocid, contentName)
  }

  function handleRemoveManualContent(contentName: string): void {
    if (selected !== null) void removeManualContent(selected.ocid, contentName)
  }

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

  const characterManageButton = (
    <button
      type="button"
      onClick={() => setIsPickerOpen(true)}
      className="text-sm font-medium text-text-muted hover:text-text"
    >
      캐릭터 관리
    </button>
  )

  const trackingPicker = isPickerOpen && (
    <CharacterTrackingPicker
      entries={roster}
      trackedOcids={trackedOcids ?? []}
      onSave={handleSaveTracking}
      onClose={() => setIsPickerOpen(false)}
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

        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-primary/15">
            <svg width="42" height="43" viewBox="0 0 127 130" className="fill-primary" aria-hidden="true">
              <path d={MAPLE_LEAF_PATH} />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-text">표시할 캐릭터가 없습니다</p>
            <p className="max-w-[220px] text-sm text-text-muted">
              캐릭터를 선택하면 일간·주간 컨텐츠를 확인할 수 있습니다
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-bg hover:bg-primary-hover"
          >
            캐릭터 선택하기
          </button>
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text">컨텐츠 스케줄러</h1>
            {characterManageButton}
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
                  className="p-2 text-primary-text hover:text-primary-hover"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {selected !== null && selected.isStale && (
              <p className="text-sm text-error">
                {selected.error !== null ? formatScheduleSyncError(selected.error) : ''}
              </p>
            )}
          </div>

          {status === 'error' && (
            <p className="text-sm text-error">
              {error !== null ? formatScheduleSyncError(error) : '오류가 발생했습니다'}
            </p>
          )}

          {/* ADR-016: 캐시된 characters가 있으면 재검증(status: 'loading') 중에도 계속 보여준다 —
              "불러오는 중"은 보여줄 데이터가 아예 없을 때만 표시한다. */}
          {(status === 'idle' || status === 'loading') && characters.length === 0 && (
            <p className="text-sm text-text-muted">불러오는 중...</p>
          )}

          {characters.length > 0 && selected !== null && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('daily')}
                className={
                  activeTab === 'daily'
                    ? 'rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary'
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
                    ? 'rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary'
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
      </div>

      {characters.length > 0 && selected !== null && (
        <div className="space-y-4 px-4 pb-4">
          {activeTab === 'daily' && (
            <>
              {displayDailyContents.length === 0 && (mode === 'manual' || !selected.isStale) && (
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  {mode === 'manual'
                    ? '추적할 항목이 없습니다 — "항목 추가"로 추가해주세요'
                    : '표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요'}
                </div>
              )}

              {displayDailyContents.length > 0 && (
                <ul className="space-y-2">
                  {displayDailyContents.map((content) => (
                    <li key={content.name} className="relative">
                      {renderDailyContentCard(content)}
                      {mode === 'manual' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveManualContent(content.name)}
                          aria-label={`${content.name} 삭제`}
                          className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-text-muted hover:text-text"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {mode === 'manual' && (
                <button
                  type="button"
                  onClick={() => setManualPickerTab('daily')}
                  className="w-full rounded-[14px] border border-dashed border-border py-3 text-sm font-medium text-text-muted hover:text-text"
                >
                  + 항목 추가
                </button>
              )}
            </>
          )}

          {activeTab === 'weekly' && (
            <>
              {displayWeeklyContents.length === 0 && (mode === 'manual' || !selected.isStale) && (
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  {mode === 'manual'
                    ? '추적할 항목이 없습니다 — "항목 추가"로 추가해주세요'
                    : '표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요'}
                </div>
              )}

              {displayWeeklyContents.length > 0 && (
                <ul className="space-y-2">
                  {displayWeeklyContents.map((content) => (
                    <li key={content.name} className="relative">
                      {renderWeeklyContentCard(content)}
                      {mode === 'manual' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveManualContent(content.name)}
                          aria-label={`${content.name} 삭제`}
                          className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-text-muted hover:text-text"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {mode === 'manual' && (
                <button
                  type="button"
                  onClick={() => setManualPickerTab('weekly')}
                  className="w-full rounded-[14px] border border-dashed border-border py-3 text-sm font-medium text-text-muted hover:text-text"
                >
                  + 항목 추가
                </button>
              )}
            </>
          )}
        </div>
      )}

      {manualPickerTab !== null && selected !== null && (
        <ManualContentPickerModal
          tab={manualPickerTab}
          alreadyTracked={manualContentItems.map((item) => item.contentName)}
          onAdd={handleAddManualContent}
          onClose={() => setManualPickerTab(null)}
        />
      )}

      {trackingModals}
    </div>
  )
}
