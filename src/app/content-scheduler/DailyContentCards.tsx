// **일간** 컨텐츠 카드(ADR-094 결정 7로 화면에서 분리) — 일일 퀘스트와 몬스터파크.
//
// 일일 퀘스트는 지역 배경 일러스트를 bleed 로 깔고([[ADR-020]]), 몬스터파크는 진행 카운트를
// 진행률 바로 보여준다. 어느 카드를 그릴지는 `renderDailyContentCard` 가 종류로 가른다.

import { Badge } from '../../components/atoms/Badge/Badge'
import { Card } from '../../components/atoms/Card/Card'
import { ProgressBar } from '../../components/atoms/ProgressBar/ProgressBar'
import { getDailyQuestBackgroundUrl, getDailyQuestRegionCrop } from '../../lib/daily-quest-backgrounds'
import type { DailyQuestRegionCrop } from '../../lib/daily-quest-backgrounds'
import { getDailyQuestRegionIconUrl } from '../../lib/daily-quest-icons'
import { matchDailyQuestRegionSlug, stripDailyQuestPrefix } from '../../lib/daily-quest-matching'
import { MEDIA_TEXT_SHADOW } from '../../lib/media-card'
import type { DailyContent } from '../../types'
import { QuestStateBadge } from './content-badges'

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
  const maskImage = 'linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)'

  // 카드 배경/보더/이름 텍스트는 BossCard와 동일하게 앱 테마와 무관하게 레테(다크) 고정 배색을
  // 쓴다 — 일러스트 bleed·페이드·text-shadow가 어두운 배경을 전제로 튜닝됐기 때문(ADR-018/020).
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
    </Card>
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

// 카드 종류 분기를 한 곳으로 모은다. 카드 컴포넌트 자체는 그대로 재사용한다.
export function renderDailyContentCard(content: DailyContent): React.JSX.Element {
  if (content.kind === 'quest') {
    return <DailyQuestCard content={content} />
  }

  if (content.name === MONSTER_PARK_NAME) {
    return <MonsterParkCard content={content} />
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
