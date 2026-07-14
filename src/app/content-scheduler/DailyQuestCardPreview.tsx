import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ZoomIn, ZoomOut } from 'lucide-react'
import dailyQuestRegionsData from '../../data/daily-quest-regions.json'
import type { DailyContent, WeeklyContent } from '../../types'
import { getDailyQuestRegionCrop } from '../../lib/daily-quest-backgrounds'
import { matchDailyQuestRegionSlug, stripDailyQuestPrefix } from '../../lib/daily-quest-matching'
import { getBossPortraitCrop } from '../../lib/boss-icons'
import type { BossPortraitCrop } from '../../lib/boss-icons'
import type { DailyQuestRegionCrop } from '../../lib/daily-quest-backgrounds'
import {
  DailyQuestCard,
  EpicDungeonCard,
  GuildFlagRaceCard,
  GuildMissionPointsCard,
  GuildUndergroundWaterwayCard,
  MonsterParkCard,
} from './ContentScreen'

const MONSTER_PARK_BACKGROUND_SLUG = 'monsterPark'
const MONSTER_PARK_CONTENT: DailyContent = {
  name: '몬스터파크',
  kind: 'contents',
  isRegistered: true,
  nowCount: 7,
  maxCount: 14,
  questState: null,
}

function weeklyContent(name: string, overrides: Partial<WeeklyContent> = {}): WeeklyContent {
  return { name, kind: 'contents', isRegistered: true, nowCount: 0, maxCount: 0, ...overrides }
}

const EPIC_DUNGEON_PREVIEW_ENTRIES = [
  { label: '하이마운틴', slug: 'ancientGodMitra', content: weeklyContent('에픽 던전 : 하이마운틴') },
  { label: '앵글러 컴퍼니', slug: 'senya', content: weeklyContent('에픽 던전 : 앵글러 컴퍼니', { nowCount: 5 }) },
  { label: '악몽선경', slug: 'baekyeon', content: weeklyContent('에픽 던전 : 악몽선경', { nowCount: 5 }) },
]

const GUILD_PREVIEW_UNDERGROUND_WATERWAY = weeklyContent('[길드] 지하 수로', { nowCount: 13416 })
const GUILD_PREVIEW_MISSION_POINTS = weeklyContent('[길드] 주간 미션 포인트', { nowCount: 10, maxCount: 10 })
const GUILD_PREVIEW_FLAG_RACE = weeklyContent('[길드] 플래그 레이스')

// 임시 디버그 화면 — src/data/daily-quest-region-crops.json 값을 지역별로 눈으로 맞춰볼 수 있도록
// 캐릭터/Nexon API 데이터 없이 daily-quest-regions.json에 있는 모든 지역 카드를 한 번에 보여주고,
// 방향키/줌 버튼으로 미세 조정한 뒤 그 결과 값을 그대로 복사해 JSON에 반영할 수 있게 한다.
// 크롭 조정이 끝나면 이 파일과 App.tsx의 /debug/quest-cards 라우트, ContentScreen.tsx의
// DailyQuestCard export를 삭제해도 된다.

const POSITION_STEP = 1
const SCALE_STEP = 10

interface DailyQuestRegionEntry {
  region: string
  backgroundSlug: string
}

function buildAllQuests(): DailyContent[] {
  const entries = dailyQuestRegionsData as DailyQuestRegionEntry[]

  return entries.map((entry, index) => ({
    name: `[일일 퀘스트] ${entry.region}`,
    kind: 'quest' as const,
    isRegistered: true,
    nowCount: 0,
    maxCount: 0,
    questState: (index % 3) as 0 | 1 | 2,
  }))
}

const ALL_QUESTS = buildAllQuests()

function parseScale(size: string): number {
  const match = /^(\d+(?:\.\d+)?)%/.exec(size)
  return match ? Number(match[1]) : 100
}

function parsePositionPart(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  if (value === 'center') return 50
  if (value === 'left' || value === 'top') return 0
  if (value === 'right' || value === 'bottom') return 100
  const match = /^(\d+(?:\.\d+)?)%$/.exec(value)
  return match ? Number(match[1]) : fallback
}

function parsePosition(position: string): { x: number; y: number } {
  const [x, y] = position.trim().split(/\s+/)
  return { x: parsePositionPart(x, 50), y: parsePositionPart(y, 50) }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function QuestRegionCropAdjuster(props: { content: DailyContent }): React.JSX.Element {
  const { content } = props
  const displayName = stripDailyQuestPrefix(content.name)
  const backgroundSlug = matchDailyQuestRegionSlug(displayName)
  const initialCrop = getDailyQuestRegionCrop(backgroundSlug)
  const [scale, setScale] = useState(() => parseScale(initialCrop.size))
  const [pos, setPos] = useState(() => parsePosition(initialCrop.position))

  const size = `${scale}% auto`
  const position = `${pos.x}% ${pos.y}%`
  const valueText = `"${backgroundSlug}": { "size": "${size}", "position": "${position}" }`

  function nudge(dx: number, dy: number): void {
    setPos((prev) => ({
      x: clamp(prev.x + dx, 0, 100),
      y: clamp(prev.y + dy, 0, 100),
    }))
  }

  function zoom(delta: number): void {
    setScale((prev) => clamp(prev + delta, 50, 500))
  }

  return (
    <div className="space-y-2 rounded-[14px] border border-border p-2">
      <DailyQuestCard content={content} crop={{ size, position }} />

      <div className="flex items-center gap-3 rounded-[10px] bg-surface p-2">
        <div className="grid grid-cols-3 gap-1">
          <span />
          <button
            type="button"
            onClick={() => nudge(0, -POSITION_STEP)}
            aria-label={`${displayName} 위로 이동`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <span />
          <button
            type="button"
            onClick={() => nudge(-POSITION_STEP, 0)}
            aria-label={`${displayName} 왼쪽으로 이동`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span />
          <button
            type="button"
            onClick={() => nudge(POSITION_STEP, 0)}
            aria-label={`${displayName} 오른쪽으로 이동`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span />
          <button
            type="button"
            onClick={() => nudge(0, POSITION_STEP)}
            aria-label={`${displayName} 아래로 이동`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <span />
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => zoom(SCALE_STEP)}
            aria-label={`${displayName} 확대`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => zoom(-SCALE_STEP)}
            aria-label={`${displayName} 축소`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <code className="block break-all text-xs text-text-muted">{valueText}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(valueText)
            }}
            className="text-xs font-medium text-primary-text hover:text-primary-hover"
          >
            복사
          </button>
        </div>
      </div>
    </div>
  )
}

// 몬스터파크·에픽 던전 3종·길드 배경처럼 지역 목록으로 순회할 수 없는 단발 슬러그를 위한
// 범용 조정기 — 카드 렌더링만 renderCard로 주입받고 나머지(방향키/줌/복사) 로직은 공유한다.
// (ADR-021: 이 시점부터 단발 슬러그가 5개로 늘어나 QuestRegionCropAdjuster처럼 loop로 묶을 수
// 없는 케이스의 중복이 실질적으로 반복되어, 공용화가 과설계가 아니라고 판단)
function SlugCropAdjuster(props: {
  label: string
  slug: string
  initialCrop: DailyQuestRegionCrop | BossPortraitCrop
  renderCard: (crop: { size: string; position: string }) => React.ReactNode
}): React.JSX.Element {
  const { label, slug, initialCrop, renderCard } = props
  const [scale, setScale] = useState(() => parseScale(initialCrop.size))
  const [pos, setPos] = useState(() => parsePosition(initialCrop.position))

  const size = `${scale}% auto`
  const position = `${pos.x}% ${pos.y}%`
  const valueText = `"${slug}": { "size": "${size}", "position": "${position}" }`

  function nudge(dx: number, dy: number): void {
    setPos((prev) => ({
      x: clamp(prev.x + dx, 0, 100),
      y: clamp(prev.y + dy, 0, 100),
    }))
  }

  function zoom(delta: number): void {
    setScale((prev) => clamp(prev + delta, 50, 500))
  }

  return (
    <div className="space-y-2 rounded-[14px] border border-border p-2">
      {renderCard({ size, position })}

      <div className="flex items-center gap-3 rounded-[10px] bg-surface p-2">
        <div className="grid grid-cols-3 gap-1">
          <span />
          <button
            type="button"
            onClick={() => nudge(0, -POSITION_STEP)}
            aria-label={`${label} 위로 이동`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <span />
          <button
            type="button"
            onClick={() => nudge(-POSITION_STEP, 0)}
            aria-label={`${label} 왼쪽으로 이동`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span />
          <button
            type="button"
            onClick={() => nudge(POSITION_STEP, 0)}
            aria-label={`${label} 오른쪽으로 이동`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span />
          <button
            type="button"
            onClick={() => nudge(0, POSITION_STEP)}
            aria-label={`${label} 아래로 이동`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <span />
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => zoom(SCALE_STEP)}
            aria-label={`${label} 확대`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => zoom(-SCALE_STEP)}
            aria-label={`${label} 축소`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <code className="block break-all text-xs text-text-muted">{valueText}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(valueText)
            }}
            className="text-xs font-medium text-primary-text hover:text-primary-hover"
          >
            복사
          </button>
        </div>
      </div>
    </div>
  )
}

export function DailyQuestCardPreview(): React.JSX.Element {
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-semibold text-text">일일퀘스트 카드 프리뷰 (임시 — 크롭 조정용)</h1>

      <SlugCropAdjuster
        label="몬스터파크"
        slug={MONSTER_PARK_BACKGROUND_SLUG}
        initialCrop={getDailyQuestRegionCrop(MONSTER_PARK_BACKGROUND_SLUG)}
        renderCard={(crop) => <MonsterParkCard content={MONSTER_PARK_CONTENT} crop={crop} />}
      />

      {EPIC_DUNGEON_PREVIEW_ENTRIES.map((entry) => (
        <SlugCropAdjuster
          key={entry.slug}
          label={entry.label}
          slug={entry.slug}
          initialCrop={getBossPortraitCrop(entry.slug)}
          renderCard={(crop) => <EpicDungeonCard content={entry.content} crop={crop} />}
        />
      ))}

      <SlugCropAdjuster
        label="길드 지하 수로"
        slug="arcanus"
        initialCrop={getBossPortraitCrop('arcanus')}
        renderCard={(crop) => <GuildUndergroundWaterwayCard content={GUILD_PREVIEW_UNDERGROUND_WATERWAY} crop={crop} />}
      />

      <SlugCropAdjuster
        label="길드 주간 미션 포인트"
        slug="hallOfHeroes"
        initialCrop={getDailyQuestRegionCrop('hallOfHeroes')}
        renderCard={(crop) => <GuildMissionPointsCard content={GUILD_PREVIEW_MISSION_POINTS} crop={crop} />}
      />

      <SlugCropAdjuster
        label="길드 플래그 레이스"
        slug="flagRace"
        initialCrop={getDailyQuestRegionCrop('flagRace')}
        renderCard={(crop) => <GuildFlagRaceCard content={GUILD_PREVIEW_FLAG_RACE} crop={crop} />}
      />

      {ALL_QUESTS.map((content) => (
        <QuestRegionCropAdjuster key={content.name} content={content} />
      ))}
    </div>
  )
}
