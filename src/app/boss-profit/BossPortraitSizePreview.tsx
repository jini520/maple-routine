import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ZoomIn, ZoomOut } from 'lucide-react'
import weeklyBossesData from '../../data/weekly-bosses.json'
import { BossPortrait } from '../../components/BossPortrait/BossPortrait'
import { getBossPortraitIconCrop } from '../../lib/boss-icons'

// 임시 디버그 화면 — src/data/boss-portrait-icon-crops.json 값을 보스별로 눈으로 맞춰볼 수 있도록
// weekly-bosses.json에 있는 모든 보스 초상화를 한 번에 보여주고, 원(circle) 크기는 상단에서
// 전체 공통으로, 확대·위치는 보스별로 버튼으로 미세 조정한 뒤 그 결과 값을 그대로 복사해
// JSON에 반영할 수 있게 한다(/debug/boss-cards·/debug/quest-cards와 동일한 패턴).
// 조정이 끝나면 이 파일과 App.tsx의 /debug/boss-portrait-size 라우트를 삭제하고, 확정된 크기는
// BossProfitScreen.tsx의 BOSS_PORTRAIT_SIZE 상수에 반영할 것.

const SIZE_STEP = 2
const MIN_SIZE = 24
const MAX_SIZE = 64
const INITIAL_SIZE = 40 // BossProfitScreen.tsx의 BOSS_PORTRAIT_SIZE 현재 값과 동일

const POSITION_STEP = 5
const SCALE_STEP = 10

interface BossReferenceEntry {
  boss: string
  portraitSlug?: string
}

const ALL_BOSSES: BossReferenceEntry[] = [
  ...(weeklyBossesData.weekly as BossReferenceEntry[]),
  ...(weeklyBossesData.eventWeekly as BossReferenceEntry[]),
  ...(weeklyBossesData.monthly as BossReferenceEntry[]),
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

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

function BossPortraitCropAdjuster(props: { entry: BossReferenceEntry; circleSize: number }): React.JSX.Element {
  const { entry, circleSize } = props
  const portraitSlug = entry.portraitSlug ?? null
  const initialCrop = getBossPortraitIconCrop(portraitSlug)
  const [scale, setScale] = useState(() => parseScale(initialCrop.size))
  const [pos, setPos] = useState(() => parsePosition(initialCrop.position))

  const size = `${scale}% auto`
  const position = `${pos.x}% ${pos.y}%`
  const valueText = `"${portraitSlug}": { "size": "${size}", "position": "${position}" }`

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
    <li className="flex items-center gap-3 rounded-[14px] bg-surface border border-border p-4">
      <BossPortrait portraitSlug={portraitSlug} label={entry.boss} size={circleSize} crop={{ size, position }} />

      <span className="w-24 shrink-0 truncate text-sm text-text">{entry.boss}</span>

      <div className="grid grid-cols-3 gap-1">
        <span />
        <button
          type="button"
          onClick={() => nudge(0, -POSITION_STEP)}
          aria-label={`${entry.boss} 위로 이동`}
          className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <span />
        <button
          type="button"
          onClick={() => nudge(-POSITION_STEP, 0)}
          aria-label={`${entry.boss} 왼쪽으로 이동`}
          className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span />
        <button
          type="button"
          onClick={() => nudge(POSITION_STEP, 0)}
          aria-label={`${entry.boss} 오른쪽으로 이동`}
          className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span />
        <button
          type="button"
          onClick={() => nudge(0, POSITION_STEP)}
          aria-label={`${entry.boss} 아래로 이동`}
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
          aria-label={`${entry.boss} 확대`}
          className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => zoom(-SCALE_STEP)}
          aria-label={`${entry.boss} 축소`}
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
    </li>
  )
}

export function BossPortraitSizePreview(): React.JSX.Element {
  const [circleSize, setCircleSize] = useState(INITIAL_SIZE)

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-semibold text-text">보스 초상화 프리뷰 (임시 — 크기·확대·위치 조정용)</h1>

      <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-3">
        <button
          type="button"
          onClick={() => setCircleSize((prev) => clamp(prev - SIZE_STEP, MIN_SIZE, MAX_SIZE))}
          aria-label="원 크기 축소"
          className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="w-12 text-center text-sm font-semibold text-text tabular-nums">{circleSize}px</span>
        <button
          type="button"
          onClick={() => setCircleSize((prev) => clamp(prev + SIZE_STEP, MIN_SIZE, MAX_SIZE))}
          aria-label="원 크기 확대"
          className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <code className="block break-all text-xs text-text-muted">{`BOSS_PORTRAIT_SIZE = ${circleSize}`}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(String(circleSize))
            }}
            className="text-xs font-medium text-primary-text hover:text-primary-hover"
          >
            복사
          </button>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        위 컨트롤은 원(circle) 크기 하나만 화면 전체에 적용된다. 아래 각 보스 행의 화살표·줌
        버튼은 그 보스의 확대·위치만 개별 조정하며, 결과 값을 boss-portrait-icon-crops.json에
        보스별로 복사해 넣는다.
      </p>

      <ul className="space-y-2">
        {ALL_BOSSES.map((entry) => (
          <BossPortraitCropAdjuster key={entry.boss} entry={entry} circleSize={circleSize} />
        ))}
      </ul>
    </div>
  )
}
