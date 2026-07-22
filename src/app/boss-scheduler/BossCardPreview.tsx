import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ZoomIn, ZoomOut } from 'lucide-react'
import weeklyBossesData from '../../data/weekly-bosses.json'
import type { BossCycle, BossDifficulty } from '../../types'
import type { MatchedBoss } from '../../lib/boss-matching'
import { getBossPortraitCrop } from '../../lib/boss-icons'
import { BossCard } from './BossScreen'

// weekly-bosses.json에는 없지만(등록된 보스 랭킹 콘텐츠가 아니라 아직 용도가 정해지지 않은
// 신규 이미지) 위치 조정이 필요한 단발 슬러그 — ContentScreen.tsx의 메이플 유니온 드래곤
// 카드에서 이미 쓰는 5종 + 아직 어디서도 안 쓰는 무공(2026-07-21).
const NEW_BOSS_PREVIEW_SLUGS = ['mugong', 'stunDragon', 'sparkyDragon', 'armorDragon', 'firehornDragon', 'hammerDragon']

function buildNewBossPreviewEntries(): MatchedBoss[] {
  return NEW_BOSS_PREVIEW_SLUGS.map((slug) => ({
    apiName: slug,
    difficulty: '노멀' as BossDifficulty,
    cycle: 'weekly' as BossCycle,
    isRegistered: true,
    isComplete: false,
    ownComplete: false,
    matchedBossName: slug,
    portraitSlug: slug,
    isSeasonBoss: false,
  }))
}

// 임시 디버그 화면 — src/data/boss-portrait-crops.json 값을 보스별로 눈으로 맞춰볼 수 있도록
// 캐릭터/Nexon API 데이터 없이 weekly-bosses.json에 있는 모든 보스 카드를 한 번에 보여주고,
// 방향키/줌 버튼으로 미세 조정한 뒤 그 결과 값을 그대로 복사해 JSON에 반영할 수 있게 한다.
// 크롭 조정이 끝나면 이 파일과 App.tsx의 /debug/boss-cards 라우트, BossScreen.tsx의
// BossCard export를 삭제해도 된다.

const POSITION_STEP = 5
const SCALE_STEP = 10

interface WeeklyBossEntry {
  boss: string
  difficulties: string[]
  portraitSlug?: string
}

function buildAllBosses(): MatchedBoss[] {
  const sections: WeeklyBossEntry[] = [
    ...(weeklyBossesData.weekly as WeeklyBossEntry[]),
    ...(weeklyBossesData.eventWeekly as WeeklyBossEntry[]),
    ...(weeklyBossesData.monthly as WeeklyBossEntry[]),
  ]

  return sections.map((entry, index) => ({
    apiName: entry.boss,
    difficulty: entry.difficulties[0] as BossDifficulty,
    cycle: 'weekly' as BossCycle,
    isRegistered: true,
    isComplete: index % 2 === 0,
    ownComplete: index % 2 === 0,
    matchedBossName: entry.boss,
    portraitSlug: entry.portraitSlug ?? null,
    isSeasonBoss: false,
  }))
}

const ALL_BOSSES = buildAllBosses()
const NEW_BOSS_PREVIEW_ENTRIES = buildNewBossPreviewEntries()

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

function BossCropAdjuster(props: { boss: MatchedBoss }): React.JSX.Element {
  const { boss } = props
  const bossName = boss.matchedBossName ?? boss.apiName
  const initialCrop = getBossPortraitCrop(boss.portraitSlug)
  const [scale, setScale] = useState(() => parseScale(initialCrop.size))
  const [pos, setPos] = useState(() => parsePosition(initialCrop.position))

  const size = `${scale}% auto`
  const position = `${pos.x}% ${pos.y}%`
  const valueText = `"${boss.portraitSlug}": { "size": "${size}", "position": "${position}" }`

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
      <BossCard boss={boss} crop={{ size, position }} />

      <div className="flex items-center gap-3 rounded-[10px] bg-surface p-2">
        <div className="grid grid-cols-3 gap-1">
          <span />
          <button
            type="button"
            onClick={() => nudge(0, -POSITION_STEP)}
            aria-label={`${bossName} 위로 이동`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <span />
          <button
            type="button"
            onClick={() => nudge(-POSITION_STEP, 0)}
            aria-label={`${bossName} 왼쪽으로 이동`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span />
          <button
            type="button"
            onClick={() => nudge(POSITION_STEP, 0)}
            aria-label={`${bossName} 오른쪽으로 이동`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span />
          <button
            type="button"
            onClick={() => nudge(0, POSITION_STEP)}
            aria-label={`${bossName} 아래로 이동`}
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
            aria-label={`${bossName} 확대`}
            className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => zoom(-SCALE_STEP)}
            aria-label={`${bossName} 축소`}
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

export function BossCardPreview(): React.JSX.Element {
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-semibold text-text">보스 카드 프리뷰 (임시 — 크롭 조정용)</h1>
      {NEW_BOSS_PREVIEW_ENTRIES.map((boss) => (
        <BossCropAdjuster key={boss.apiName} boss={boss} />
      ))}
      {ALL_BOSSES.map((boss) => (
        <BossCropAdjuster key={boss.apiName} boss={boss} />
      ))}
    </div>
  )
}
