import { useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import weeklyBossesData from '../../data/weekly-bosses.json'
import { BossPortrait } from '../../components/BossPortrait/BossPortrait'

// 임시 디버그 화면 — BossPortrait의 size(px)를 보스 수익 화면 보스 행에 적용하기 전에 여러 보스
// 초상화를 한 번에 눈으로 비교하며 조정할 수 있게 한다. boss-portrait-crops.json처럼 보스별 개별
// 값이 아니라 화면 전체에 적용되는 단일 크기 값이라 조정 컨트롤도 하나만 둔다. 크기 조정이
// 끝나면 이 파일과 App.tsx의 /debug/boss-portrait-size 라우트를 삭제하고, 확정된 값을
// BossProfitScreen.tsx의 BOSS_PORTRAIT_SIZE 상수에 반영할 것.

const SIZE_STEP = 2
const MIN_SIZE = 24
const MAX_SIZE = 64
const INITIAL_SIZE = 40 // BossProfitScreen.tsx의 BOSS_PORTRAIT_SIZE 현재 값과 동일

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

export function BossPortraitSizePreview(): React.JSX.Element {
  const [size, setSize] = useState(INITIAL_SIZE)

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-semibold text-text">보스 초상화 크기 프리뷰 (임시 — 크기 조정용)</h1>

      <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-3">
        <button
          type="button"
          onClick={() => setSize((prev) => clamp(prev - SIZE_STEP, MIN_SIZE, MAX_SIZE))}
          aria-label="보스 초상화 축소"
          className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="w-12 text-center text-sm font-semibold text-text tabular-nums">{size}px</span>
        <button
          type="button"
          onClick={() => setSize((prev) => clamp(prev + SIZE_STEP, MIN_SIZE, MAX_SIZE))}
          aria-label="보스 초상화 확대"
          className="rounded-[8px] border border-border p-1 text-text-muted hover:text-text"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          <code className="block break-all text-xs text-text-muted">{`BOSS_PORTRAIT_SIZE = ${size}`}</code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(String(size))
            }}
            className="text-xs font-medium text-primary-text hover:text-primary-hover"
          >
            복사
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {ALL_BOSSES.map((entry) => (
          <li
            key={entry.boss}
            className="flex items-center gap-3 rounded-[14px] bg-surface border border-border p-4"
          >
            <BossPortrait portraitSlug={entry.portraitSlug ?? null} label={entry.boss} size={size} />
            <span className="text-sm text-text">{entry.boss}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
