// **주간** 컨텐츠 카드(로 화면에서 분리). 에픽 던전·지역 주간 퀘스트·
// 메이플 유니온·길드 3종.
//
// 카드마다 배경 일러스트와 배지 구성이 다르고, 어느 것을 그릴지는 `renderWeeklyContentCard` 가
// 이름으로 가른다. 전부 자기 카드 안에서 끝나 화면의 고정 헤더와 무관하다.
//
// RN 으로 갈린 것은 일간 카드와 **같은 넷**이라 그쪽 파일 머리에 한 번만 적는다
// (`DailyContentCards.tsx`). bleed 는 `FadedIllustration`, 껍데기는 `IllustratedCard`, `flex-row` 명시,
// `<img>`/`<span>`/`text-shadow` 의 짝.
import { isContentBlocked } from '../../lib/scheduler/required-level'
import {
  getBossPortraitCrop,
  getBossPortraitUrl,
  getDailyQuestBackgroundUrl,
  getDailyQuestRegionCrop,
  getDailyQuestRegionIconUrl,
} from '../../lib/assets/asset-lookup'
import type { ImageCrop } from '../../lib/image-crop'
import {
  matchWeeklyQuestRegionSlug,
  matchWeeklyRegionalQuestSlug,
  stripWeeklyQuestPrefix,
} from '../../lib/scheduler/quest-region-matching'
import type { WeeklyContent } from '../../types'
import { Image, View } from 'react-native'

import { Badge, Card, ProgressBar, Text } from '../../components/atoms'
import { ILLUSTRATION_TEXT_SHADOW_STYLE } from '../../constants/style/text-styles'
import {
  QUEST_STATE_LABELS,
  QUEST_STATE_VARIANT,
  renderWeeklyQuestStatus,
  stripGuildPrefix,
} from './content-badges'
import { MONSTER_PARK_BACKGROUND_SLUG } from './DailyContentCards'
import { IllustratedCard, FadedIllustration } from '../../components/molecules/FadedIllustration/FadedIllustration'

// 주간 탭 카테고리 분류 상수
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
// 메이플 유니온 주간 드래곤 퇴치. 실제로 등장하는 드래곤은 매주 바뀌지만 API가 어떤 드래곤인지
// 알려주지 않아, 에픽 던전 카드와 동일하게 대표 이미지 하나로 고정한다(연장, 2026-07-21).
export const MAPLE_UNION_PREFIX = '[메이플 유니온] '
export const MAPLE_UNION_DRAGON_BOSS_SLUG = 'armorDragon'
// "[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?"는 지역명이 문장 앞이 아니라 대괄호 태그로만
// 나타나 daily-quest-matching 방식의 접두어 제거 후 startsWith 매칭이 통하지 않는다. 대신
// weekly-regional-quests.json에 전체 문자열을 그대로 등록하고, 표시용으로만 이 접두어를 뗀다.
export const MONSTER_PARK_EXTREME_PREFIX = '[몬스터파크] '

export function EpicDungeonCard(props: {
  content: WeeklyContent
  crop?: ImageCrop
  /** 요구 레벨 미달. 상태 배지를 진행 불가 로 대체한다. */
  isBlocked?: boolean
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
    <IllustratedCard className="h-20 overflow-hidden">
      <FadedIllustration source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          <Badge variant="epicDungeon">에픽 던전</Badge>
          <Text className="text-sm font-medium text-text" style={ILLUSTRATION_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        {/*. 진행 불가면 상태 배지를 **대체**한다(늘리지 않는다). */}
        {props.isBlocked === true ? (
          <Badge variant="muted" fixed className="shrink-0">진행 불가</Badge>
        ) : (
          <Badge variant={QUEST_STATE_VARIANT[questState]}>
            {QUEST_STATE_LABELS[questState]}
          </Badge>
        )}
      </View>
    </IllustratedCard>
  )
}

export function WeeklyRegionalContentCard(props: {
  content: WeeklyContent
  crop?: ImageCrop
  /** 요구 레벨 미달. 상태 배지를 진행 불가 로 대체한다. */
  isBlocked?: boolean
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
    <IllustratedCard className="h-20 overflow-hidden">
      <FadedIllustration source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          {iconUrl !== null && (
            <Image source={iconUrl} aria-hidden resizeMode="contain" className="h-6 w-6 shrink-0" />
          )}
          <Text className="text-sm font-medium text-text" style={ILLUSTRATION_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        {/*. 진행 불가면 상태 배지를 **대체**한다(늘리지 않는다). */}
        {props.isBlocked === true ? (
          <Badge variant="muted" fixed className="shrink-0">진행 불가</Badge>
        ) : (
          questState !== null && (
            <Badge variant={QUEST_STATE_VARIANT[questState]}>
              {QUEST_STATE_LABELS[questState]}
            </Badge>
          )
        )}
      </View>
    </IllustratedCard>
  )
}

export function WeeklyQuestCard(props: {
  content: WeeklyContent
  crop?: ImageCrop
  /** 요구 레벨 미달. 상태 배지를 진행 불가 로 대체한다. */
  isBlocked?: boolean
}): React.JSX.Element {
  const { content } = props
  const displayName = stripWeeklyQuestPrefix(content.name)
  const backgroundSlug = matchWeeklyQuestRegionSlug(displayName)
  const backgroundUrl = getDailyQuestBackgroundUrl(backgroundSlug)
  const iconUrl = getDailyQuestRegionIconUrl(backgroundSlug)
  const crop = props.crop ?? getDailyQuestRegionCrop(backgroundSlug)

  return (
    <IllustratedCard className="h-20 overflow-hidden">
      <FadedIllustration source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          {iconUrl !== null && (
            <Image source={iconUrl} aria-hidden resizeMode="contain" className="h-6 w-6 shrink-0" />
          )}
          <Text className="text-sm font-medium text-text" style={ILLUSTRATION_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        {/*. 진행 불가면 상태 배지를 **대체**한다(늘리지 않는다). */}
        {props.isBlocked === true ? (
          <Badge variant="muted" fixed className="shrink-0">진행 불가</Badge>
        ) : (
          renderWeeklyQuestStatus(content, backgroundSlug)
        )}
      </View>
    </IllustratedCard>
  )
}

export function MapleUnionDragonCard(props: {
  content: WeeklyContent
  crop?: ImageCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = content.name.startsWith(MAPLE_UNION_PREFIX)
    ? content.name.slice(MAPLE_UNION_PREFIX.length)
    : content.name
  const backgroundUrl = getBossPortraitUrl(MAPLE_UNION_DRAGON_BOSS_SLUG)
  const crop = props.crop ?? getBossPortraitCrop(MAPLE_UNION_DRAGON_BOSS_SLUG)

  return (
    <IllustratedCard className="h-20 overflow-hidden">
      <FadedIllustration source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          <Badge variant="mapleUnion">유니온</Badge>
          <Text className="text-sm font-medium text-text" style={ILLUSTRATION_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        {content.questState !== null && (
          <Badge variant={QUEST_STATE_VARIANT[content.questState]}>
            {QUEST_STATE_LABELS[content.questState]}
          </Badge>
        )}
      </View>
    </IllustratedCard>
  )
}

export function GuildUndergroundWaterwayCard(props: {
  content: WeeklyContent
  crop?: ImageCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = stripGuildPrefix(content.name)
  const backgroundUrl = getBossPortraitUrl(GUILD_UNDERGROUND_WATERWAY_BACKGROUND_SLUG)
  const crop = props.crop ?? getBossPortraitCrop(GUILD_UNDERGROUND_WATERWAY_BACKGROUND_SLUG)

  return (
    <IllustratedCard className="h-20 overflow-hidden">
      <FadedIllustration source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          <Badge variant="guild">길드</Badge>
          <Text className="text-sm font-medium text-text" style={ILLUSTRATION_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        <Badge variant="third">{content.nowCount}점</Badge>
      </View>
    </IllustratedCard>
  )
}

export function GuildMissionPointsCard(props: {
  content: WeeklyContent
  crop?: ImageCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = stripGuildPrefix(content.name)
  const backgroundUrl = getDailyQuestBackgroundUrl(GUILD_MISSION_POINTS_BACKGROUND_SLUG)
  const crop = props.crop ?? getDailyQuestRegionCrop(GUILD_MISSION_POINTS_BACKGROUND_SLUG)
  const progressPercent = content.maxCount > 0 ? Math.min((content.nowCount / content.maxCount) * 100, 100) : 0

  return (
    <IllustratedCard className="h-28 overflow-hidden">
      <FadedIllustration source={backgroundUrl} crop={crop} />

      <View className="h-full flex-col">
        <View className="h-20 shrink-0 flex-row items-center justify-between px-[14px]">
          <View className="flex-row items-center gap-2">
            <Badge variant="guild">길드</Badge>
            <Text className="text-sm font-medium text-text" style={ILLUSTRATION_TEXT_SHADOW_STYLE}>
              {displayName}
            </Text>
          </View>

          <Badge variant="third">
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
    </IllustratedCard>
  )
}

export function GuildFlagRaceCard(props: {
  content: WeeklyContent
  crop?: ImageCrop
}): React.JSX.Element {
  const { content } = props
  const displayName = stripGuildPrefix(content.name)
  const backgroundUrl = getDailyQuestBackgroundUrl(GUILD_FLAG_RACE_BACKGROUND_SLUG)
  const crop = props.crop ?? getDailyQuestRegionCrop(GUILD_FLAG_RACE_BACKGROUND_SLUG)
  const questState: 0 | 2 = content.nowCount > 0 ? 2 : 0

  return (
    <IllustratedCard className="h-20 overflow-hidden">
      <FadedIllustration source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          <Badge variant="guild">길드</Badge>
          <Text className="text-sm font-medium text-text" style={ILLUSTRATION_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        <Badge variant={QUEST_STATE_VARIANT[questState]}>
            {QUEST_STATE_LABELS[questState]}
          </Badge>
      </View>
    </IllustratedCard>
  )
}

export function renderWeeklyContentCard(
  content: WeeklyContent,
  /** 이 카드를 보는 캐릭터의 레벨. 판정은 `lib/scheduler/required-level` 한 곳이 한다. */
  characterLevel: number | null,
): React.JSX.Element {
  // 길드 셋과 유니온 둘은 참조표에 요구 레벨이 **없다**. 어떤 레벨에서도 진행 가능이라
  // 그 카드들에는 이 프롭을 넘기지 않는다(`대가`).
  const isBlocked = isContentBlocked(characterLevel, content.name)

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
    return <EpicDungeonCard content={content} isBlocked={isBlocked} />
  }

  if (matchWeeklyRegionalQuestSlug(content.name) !== null) {
    return <WeeklyRegionalContentCard content={content} isBlocked={isBlocked} />
  }

  if (content.name.startsWith(MAPLE_UNION_PREFIX)) {
    return <MapleUnionDragonCard content={content} />
  }

  if (matchWeeklyQuestRegionSlug(stripWeeklyQuestPrefix(content.name)) !== null) {
    return <WeeklyQuestCard content={content} isBlocked={isBlocked} />
  }

  return (
    <Card className="gap-2 p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="shrink text-sm text-text">
          {content.name} · {content.nowCount}/{content.maxCount}
        </Text>
        {isBlocked && <Badge variant="muted" fixed className="shrink-0">진행 불가</Badge>}
      </View>
      {!isBlocked && content.maxCount > 0 && (
        <ProgressBar
          percent={Math.min((content.nowCount / content.maxCount) * 100, 100)}
          aria={{ now: content.nowCount, max: content.maxCount }}
        />
      )}
    </Card>
  )
}
