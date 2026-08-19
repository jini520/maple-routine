// **일간** 컨텐츠 카드([[ADR-094]] 결정 7로 화면에서 분리) — 일일 퀘스트와 몬스터파크.
//
// 일일 퀘스트는 지역 배경 일러스트를 bleed 로 깔고([[ADR-020]]), 몬스터파크는 진행 카운트를
// 진행률 바로 보여준다. 어느 카드를 그릴지는 `renderDailyContentCard` 가 종류로 가른다.
//
// ── RN 으로 옮기며 갈린 것 넷 ─────────────────────────────────────────────────────
//
// ① **bleed 네 줄(배경 이미지·크롭·필터·마스크)이 `MediaCardArt` 한 줄로 접혔다** — RN 에는 배경
//    이미지도 마스크도 없어 `<Image>` 를 손으로 앉히고 베일을 덧칠해야 한다. 기하 변환과 그것이
//    웹과 같은 색을 내는 이유는 `media-card-art.ts` 파일 머리에 있다.
// ② **카드 껍데기가 `MediaCard`** — 웹 `<Card className="media-scope …">` 의 짝이다. `.media-scope`
//    가 클래스가 아니라 변수 스코프라([[ADR-064]] 결정 5) 컴포넌트가 그 자리를 맡는다.
// ③ **`flex-row` 를 명시한다.** 웹 `flex` 의 기본 방향은 row 지만 RN 은 column 이다 — 빠뜨리면
//    에러 없이 세로로 쌓인다.
// ④ `<img>` → `<Image>`, `<span>` → `<Text>`, `text-shadow` → `MEDIA_TEXT_SHADOW_STYLE`
//    (`lib/text-styles.ts` — RN 은 그림자를 하나만 표현할 수 있어 강한 쪽을 남긴다).
import { getDailyQuestBackgroundUrl, getDailyQuestRegionCrop } from '@core/lib/daily-quest-backgrounds'
import type { DailyQuestRegionCrop } from '@core/lib/daily-quest-backgrounds'
import { getDailyQuestRegionIconUrl } from '@core/lib/daily-quest-icons'
import { matchDailyQuestRegionSlug, stripDailyQuestPrefix } from '@core/lib/daily-quest-matching'
import type { DailyContent } from '@core/types'
import { Image, View } from 'react-native'

import { Badge } from '../../components/atoms/Badge/Badge'
import { Card } from '../../components/atoms/Card/Card'
import { ProgressBar } from '../../components/atoms/ProgressBar/ProgressBar'
import { Text } from '../../components/atoms/Text/Text'
import { MEDIA_TEXT_SHADOW_STYLE } from '../../lib/text-styles'
import { QuestStateBadge } from './content-badges'
import { MediaCard, MediaCardArt } from '../../components/molecules/MediaCardArt/MediaCardArt'

// "몬스터파크"만 배경+아이콘 카드로 확장한다 — 다른 kind: 'contents' 항목이 생기면 그때
// 매핑 테이블로 일반화할지 재검토한다(현재는 인스턴스가 하나뿐이라 과설계 방지, ADR-020).
export const MONSTER_PARK_NAME = '몬스터파크'
export const MONSTER_PARK_BACKGROUND_SLUG = 'monsterPark'

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

  // 카드 배경/보더/이름 텍스트는 BossCard와 동일하게 앱 테마와 무관하게 레테(다크) 고정 배색을
  // 쓴다 — 일러스트 bleed·페이드·text-shadow가 어두운 배경을 전제로 튜닝됐기 때문(ADR-018/020).
  return (
    <MediaCard className="h-20 overflow-hidden">
      <MediaCardArt source={backgroundUrl} crop={crop} />

      <View className="h-full flex-row items-center justify-between px-[14px]">
        <View className="flex-row items-center gap-2">
          {iconUrl !== null && (
            <Image
              source={iconUrl}
              aria-hidden
              resizeMode="contain"
              className="h-6 w-6 shrink-0"
            />
          )}
          <Text className="text-sm font-medium text-text" style={MEDIA_TEXT_SHADOW_STYLE}>
            {displayName}
          </Text>
        </View>

        {content.questState !== null && <QuestStateBadge questState={content.questState} />}
      </View>
    </MediaCard>
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
  const progressPercent = content.maxCount > 0 ? Math.min((content.nowCount / content.maxCount) * 100, 100) : 0

  return (
    <MediaCard className="h-28 overflow-hidden">
      <MediaCardArt source={backgroundUrl} crop={crop} />

      <View className="h-full flex-col">
        <View className="h-20 shrink-0 flex-row items-center justify-between px-[14px]">
          <View className="flex-row items-center gap-2">
            {iconUrl !== null && (
              <Image
                source={iconUrl}
                aria-hidden
                resizeMode="contain"
                className="h-6 w-6 shrink-0"
              />
            )}
            <Text className="text-sm font-medium text-text" style={MEDIA_TEXT_SHADOW_STYLE}>
              {content.name}
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

// 카드 종류 분기를 한 곳으로 모은다. 카드 컴포넌트 자체는 그대로 재사용한다.
export function renderDailyContentCard(content: DailyContent): React.JSX.Element {
  if (content.kind === 'quest') {
    return <DailyQuestCard content={content} />
  }

  if (content.name === MONSTER_PARK_NAME) {
    return <MonsterParkCard content={content} />
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
