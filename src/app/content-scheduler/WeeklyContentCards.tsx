// **주간** 컨텐츠 카드([[ADR-094]] 결정 7로 화면에서 분리) — 에픽 던전·지역 주간 퀘스트·
// 메이플 유니온·길드 3종([[ADR-021]]).
//
// 카드마다 배경 일러스트와 배지 구성이 다르고, 어느 것을 그릴지는 `renderWeeklyContentCard` 가
// 이름으로 가른다. 전부 자기 카드 안에서 끝나 화면의 고정 헤더와 무관하다.
//
// RN 으로 갈린 것은 일간 카드와 **같은 넷**이라 그쪽 파일 머리에 한 번만 적는다
// (`DailyContentCards.tsx`) — bleed 는 `MediaCardArt`, 껍데기는 `MediaCard`, `flex-row` 명시,
// `<img>`/`<span>`/`text-shadow` 의 짝.
import { getBossPortraitCrop, getBossPortraitUrl } from '@core/lib/boss-icons'
import type { BossPortraitCrop } from '@core/lib/boss-icons'
import { getDailyQuestBackgroundUrl, getDailyQuestRegionCrop } from '@core/lib/daily-quest-backgrounds'
import type { DailyQuestRegionCrop } from '@core/lib/daily-quest-backgrounds'
import { getDailyQuestRegionIconUrl } from '@core/lib/daily-quest-icons'
import { matchWeeklyQuestRegionSlug, stripWeeklyQuestPrefix } from '@core/lib/weekly-quest-matching'
import { matchWeeklyRegionalQuestSlug } from '@core/lib/weekly-regional-quest-matching'
import type { WeeklyContent } from '@core/types'
import { Image, View } from 'react-native'

import { Badge } from '../../components/atoms/Badge/Badge'
import { Card } from '../../components/atoms/Card/Card'
import { ProgressBar } from '../../components/atoms/ProgressBar/ProgressBar'
import { Text } from '../../components/atoms/Text/Text'
import { MEDIA_TEXT_SHADOW_STYLE } from '../../lib/text-styles'
import { CategoryBadge, QuestStateBadge, renderWeeklyQuestStatus, stripGuildPrefix } from './content-badges'
import { MONSTER_PARK_BACKGROUND_SLUG } from './DailyContentCards'
import { MediaCard, MediaCardArt } from '../../components/molecules/MediaCardArt/MediaCardArt'

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
    <MediaCard className="h-20 overflow-hidden">
      <MediaCardArt source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          <CategoryBadge label="에픽 던전" variant="epicDungeon" />
          <Text className="text-sm font-medium text-text" style={MEDIA_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        <QuestStateBadge questState={questState} />
      </View>
    </MediaCard>
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
    <MediaCard className="h-20 overflow-hidden">
      <MediaCardArt source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          {iconUrl !== null && (
            <Image source={iconUrl} aria-hidden resizeMode="contain" className="h-6 w-6 shrink-0" />
          )}
          <Text className="text-sm font-medium text-text" style={MEDIA_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        {questState !== null && <QuestStateBadge questState={questState} />}
      </View>
    </MediaCard>
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
    <MediaCard className="h-20 overflow-hidden">
      <MediaCardArt source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          {iconUrl !== null && (
            <Image source={iconUrl} aria-hidden resizeMode="contain" className="h-6 w-6 shrink-0" />
          )}
          <Text className="text-sm font-medium text-text" style={MEDIA_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        {renderWeeklyQuestStatus(content, backgroundSlug)}
      </View>
    </MediaCard>
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
    <MediaCard className="h-20 overflow-hidden">
      <MediaCardArt source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          <CategoryBadge label="유니온" variant="mapleUnion" />
          <Text className="text-sm font-medium text-text" style={MEDIA_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        {content.questState !== null && <QuestStateBadge questState={content.questState} />}
      </View>
    </MediaCard>
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
    <MediaCard className="h-20 overflow-hidden">
      <MediaCardArt source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          <CategoryBadge label="길드" variant="guild" />
          <Text className="text-sm font-medium text-text" style={MEDIA_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        <Badge tone="third">{content.nowCount}점</Badge>
      </View>
    </MediaCard>
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
    <MediaCard className="h-28 overflow-hidden">
      <MediaCardArt source={backgroundUrl} crop={crop} />

      <View className="h-full flex-col">
        <View className="h-20 shrink-0 flex-row items-center justify-between px-[14px]">
          <View className="flex-row items-center gap-2">
            <CategoryBadge label="길드" variant="guild" />
            <Text className="text-sm font-medium text-text" style={MEDIA_TEXT_SHADOW_STYLE}>
              {displayName}
            </Text>
          </View>

          <Badge tone="third">
            {content.nowCount}/{content.maxCount}
          </Badge>
        </View>

        {content.maxCount > 0 && (
          <View className="flex-1 px-[14px]">
            <ProgressBar
              percent={progressPercent}
              tone="third"
              aria={{ now: content.nowCount, max: content.maxCount }}
            />
          </View>
        )}
      </View>
    </MediaCard>
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
    <MediaCard className="h-20 overflow-hidden">
      <MediaCardArt source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          <CategoryBadge label="길드" variant="guild" />
          <Text className="text-sm font-medium text-text" style={MEDIA_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        <QuestStateBadge questState={questState} />
      </View>
    </MediaCard>
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
    <Card className="gap-2 p-4">
      <Text className="text-sm text-text">
        {content.name} · {content.nowCount}/{content.maxCount}
      </Text>
      {content.maxCount > 0 && (
        <ProgressBar
          percent={Math.min((content.nowCount / content.maxCount) * 100, 100)}
          aria={{ now: content.nowCount, max: content.maxCount }}
        />
      )}
    </Card>
  )
}
