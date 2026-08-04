// **주간** 컨텐츠 카드(ADR-094 결정 7로 화면에서 분리) — 에픽 던전·지역 주간 퀘스트·
// 메이플 유니온·길드 3종([[ADR-021]]).
//
// 카드마다 배경 일러스트와 배지 구성이 다르고, 어느 것을 그릴지는 `renderWeeklyContentCard` 가
// 이름으로 가른다. 전부 자기 카드 안에서 끝나 화면의 sticky 헤더와 무관하다.

import { Badge } from '../../components/atoms/Badge/Badge'
import { Card } from '../../components/atoms/Card/Card'
import { ProgressBar } from '../../components/atoms/ProgressBar/ProgressBar'
import { getBossPortraitCrop, getBossPortraitUrl } from '../../lib/boss-icons'
import type { BossPortraitCrop } from '../../lib/boss-icons'
import { getDailyQuestBackgroundUrl, getDailyQuestRegionCrop } from '../../lib/daily-quest-backgrounds'
import type { DailyQuestRegionCrop } from '../../lib/daily-quest-backgrounds'
import { getDailyQuestRegionIconUrl } from '../../lib/daily-quest-icons'
import { MEDIA_TEXT_SHADOW } from '../../lib/media-card'
import { matchWeeklyQuestRegionSlug, stripWeeklyQuestPrefix } from '../../lib/weekly-quest-matching'
import { matchWeeklyRegionalQuestSlug } from '../../lib/weekly-regional-quest-matching'
import type { WeeklyContent } from '../../types'
import { CategoryBadge, QuestStateBadge, renderWeeklyQuestStatus, stripGuildPrefix } from './content-badges'
import { MONSTER_PARK_BACKGROUND_SLUG } from './DailyContentCards'

export const CARD_MASK_IMAGE = 'linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)'
// 주간 탭 카테고리 분류 상수 (ADR-021)
export const EPIC_DUNGEON_PREFIX = '에픽 던전 : '
export const EPIC_DUNGEON_BACKGROUND_SLUGS: Record<string, string> = {
  하이마운틴: 'ancientGodMitra',
  '앵글러 컴퍼니': 'senya',
  악몽선경: 'baekyeon',
}
export const GUILD_MISSION_POINTS_NAME = '[길드] 주간 미션 포인트'
export const GUILD_UNDERGROUND_WATERWAY_NAME = '[길드] 지하 수로'
export const GUILD_FLAG_RACE_NAME = '[길드] 플래그 레이스'
export const GUILD_UNDERGROUND_WATERWAY_BACKGROUND_SLUG = 'arcanus'
export const GUILD_MISSION_POINTS_BACKGROUND_SLUG = 'hallOfHeroes'
export const GUILD_FLAG_RACE_BACKGROUND_SLUG = 'flagRace'
// 메이플 유니온 주간 드래곤 퇴치 — 실제로 등장하는 드래곤은 매주 바뀌지만 API가 어떤 드래곤인지
// 알려주지 않아, 에픽 던전 카드와 동일하게 대표 이미지 하나로 고정한다(ADR-021 연장, 2026-07-21).
export const MAPLE_UNION_PREFIX = '[메이플 유니온] '
export const MAPLE_UNION_DRAGON_BOSS_SLUG = 'armorDragon'
// "[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?"는 지역명이 문장 앞이 아니라 대괄호 태그로만
// 나타나 daily-quest-matching 방식의 접두어 제거 후 startsWith 매칭이 통하지 않는다. 대신
// weekly-regional-quests.json에 전체 문자열을 그대로 등록하고, 표시용으로만 이 접두어를 뗀다.
export const MONSTER_PARK_EXTREME_PREFIX = '[몬스터파크] '
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
    <Card className="media-scope relative h-20 overflow-hidden">
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
    </Card>
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
    <Card className="media-scope relative h-20 overflow-hidden">
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
    </Card>
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
    <Card className="media-scope relative h-20 overflow-hidden">
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
    </Card>
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
    <Card className="media-scope relative h-20 overflow-hidden">
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
    </Card>
  )
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
    <Card className="media-scope relative h-20 overflow-hidden">
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

        <Badge tone="third">
          {content.nowCount}점
        </Badge>
      </div>
    </Card>
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
    <Card className="media-scope relative h-28 overflow-hidden">
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

          <Badge tone="third">
            {content.nowCount}/{content.maxCount}
          </Badge>
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
    </Card>
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
    <Card className="media-scope relative h-20 overflow-hidden">
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
    </Card>
  )
}

export function renderWeeklyContentCard(content: WeeklyContent): React.JSX.Element {
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
    <Card className="p-4 space-y-2">
      <p className="text-sm text-text">
        {content.name} · {content.nowCount}/{content.maxCount}
      </p>
      {content.maxCount > 0 && (
        <ProgressBar
          percent={Math.min((content.nowCount / content.maxCount) * 100, 100)}
          aria={{ now: content.nowCount, max: content.maxCount }}
        />
      )}
    </Card>
  )
}
