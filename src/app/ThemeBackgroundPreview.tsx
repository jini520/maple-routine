import { useEffect, useState } from 'react'
import { useThemeStore } from '../features/theme/store'
import { THEME_NAMES, getThemeDefinition } from '../lib/theme-registry'
import type { ThemeBackground, ThemeName } from '../types/theme'

// 임시 디버그 화면 — 테마 배경 이미지(ADR-088)의 크기·위치·어둡기·상단 페이드를 눈으로 맞춘다.
// 이 값들은 수치로 고를 수 없고(어느 크롭에서 수정·달이 보이는지는 뷰포트 비율까지 걸린다) 보고
// 정하는 값이라, /debug/boss-cards·/debug/quest-cards·/debug/boss-portrait-size와 같은 패턴의
// 도구를 둔다. 조정이 끝나면 이 파일과 App.tsx의 /debug/theme-background 라우트를 삭제하고,
// 확정 값은 src/data/job-themes.json의 해당 테마 background 블록에 반영할 것.
//
// 슬라이더는 별도 프리뷰 상자가 아니라 **진짜 백드롭·헤더 조각의 커스텀 프로퍼티**를 바꾼다.
// cover는 뷰포트 상자 기준으로 계산되므로 작은 상자에 재현하면 실제와 어긋난다 — 화면이 곧 프리뷰다.

const PROPERTY_BY_FIELD = {
  size: '--theme-bg-size',
  position: '--theme-bg-position',
  dim: '--theme-bg-dim',
  fadeTop: '--theme-bg-fade-top',
} as const

const SIZE_PRESETS = ['cover', 'contain'] as const

function parsePositionPart(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  if (value === 'center') return 50
  if (value === 'left' || value === 'top') return 0
  if (value === 'right' || value === 'bottom') return 100
  const match = /^(-?\d+(?:\.\d+)?)%$/.exec(value)
  return match ? Number(match[1]) : fallback
}

function parsePosition(position: string): { x: number; y: number } {
  const [x, y] = position.trim().split(/\s+/)
  // "center" 한 값만 적힌 경우 세로도 center다.
  return { x: parsePositionPart(x, 50), y: parsePositionPart(y ?? x, 50) }
}

/** `120% auto` 형태의 확대 배율. 프리셋(cover/contain)일 땐 배율 개념이 없어 100을 준다. */
function parseZoom(size: string): number {
  const match = /^(\d+(?:\.\d+)?)%/.exec(size)
  return match ? Number(match[1]) : 100
}

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-text">{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
        className="min-w-0 flex-1 accent-[var(--color-primary)]"
      />
      <span className="w-20 shrink-0 text-right text-sm font-semibold text-text tabular-nums">
        {props.value}
        {props.suffix}
      </span>
    </label>
  )
}

function Controls(props: { theme: ThemeName; background: ThemeBackground }): React.JSX.Element {
  const { theme, background } = props

  const [sizeMode, setSizeMode] = useState<'cover' | 'contain' | 'zoom'>(() =>
    SIZE_PRESETS.includes(background.size as (typeof SIZE_PRESETS)[number])
      ? (background.size as 'cover' | 'contain')
      : 'zoom',
  )
  const [zoom, setZoom] = useState(() => parseZoom(background.size))
  const [pos, setPos] = useState(() => parsePosition(background.position))
  const [dim, setDim] = useState(background.dim)
  const [fadeTop, setFadeTop] = useState(() => Number.parseInt(background.fadeTop, 10) || 0)

  const size = sizeMode === 'zoom' ? `${zoom}% auto` : sizeMode
  const position = `${pos.x}% ${pos.y}%`
  const draft: ThemeBackground = { ...background, size, position, dim, fadeTop: `${fadeTop}px` }

  // 조정 중인 값을 :root 인라인 스타일로 덮는다 — 테마 <style> 규칙보다 우선하므로 실제 백드롭과
  // 모든 헤더 조각이 즉시 따라온다. 화면을 떠나면 걷어 커밋된 값으로 돌아간다.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty(PROPERTY_BY_FIELD.size, size)
    root.style.setProperty(PROPERTY_BY_FIELD.position, position)
    root.style.setProperty(PROPERTY_BY_FIELD.dim, String(dim))
    root.style.setProperty(PROPERTY_BY_FIELD.fadeTop, `${fadeTop}px`)

    return () => {
      for (const property of Object.values(PROPERTY_BY_FIELD)) {
        root.style.removeProperty(property)
      }
    }
  }, [size, position, dim, fadeTop])

  const json = `"background": ${JSON.stringify(draft, null, 2)}`

  return (
    <>
      <div className="space-y-3 rounded-[14px] border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-sm text-text">크기</span>
          {(['cover', 'contain', 'zoom'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSizeMode(mode)}
              className={
                mode === sizeMode
                  ? 'rounded-full bg-primary-tint px-3 py-1 text-xs font-semibold text-primary-ink'
                  : 'rounded-full px-3 py-1 text-xs font-medium text-text-muted hover:text-text'
              }
            >
              {mode === 'zoom' ? '확대 %' : mode}
            </button>
          ))}
        </div>

        {sizeMode === 'zoom' && (
          <Slider label="확대" value={zoom} min={50} max={400} step={5} suffix="%" onChange={setZoom} />
        )}

        <Slider
          label="가로 위치"
          value={pos.x}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(x) => setPos((prev) => ({ ...prev, x }))}
        />
        <Slider
          label="세로 위치"
          value={pos.y}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(y) => setPos((prev) => ({ ...prev, y }))}
        />
        <Slider label="어둡기" value={dim} min={0} max={1} step={0.02} suffix="" onChange={setDim} />
        <Slider label="상단 페이드" value={fadeTop} min={0} max={600} step={10} suffix="px" onChange={setFadeTop} />

        <p className="text-xs text-text-muted">
          세로 위치는 이미지가 뷰포트보다 세로로 길 때만 움직인다 — `cover`가 세로를 꽉 채우면
          잘려나가는 쪽은 가로뿐이다.
        </p>
      </div>

      <div className="space-y-2 rounded-[14px] border border-border bg-surface p-4">
        <p className="text-sm text-text">
          {theme} 의 <code className="text-primary-ink">background</code> 블록 — job-themes.json 에 붙여넣는다
        </p>
        <pre className="overflow-x-auto rounded-[10px] bg-surface-2 p-3 text-xs text-text">{json}</pre>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(json)
          }}
          className="text-xs font-medium text-primary-ink hover:text-primary-hover"
        >
          복사
        </button>
      </div>
    </>
  )
}

export function ThemeBackgroundPreview(): React.JSX.Element {
  const { theme, selectTheme } = useThemeStore()
  const background = getThemeDefinition(theme).background

  const themesWithBackground = THEME_NAMES.filter(
    (name) => getThemeDefinition(name).background !== undefined,
  )

  return (
    <div className="pb-16">
      {/* 실제 화면들과 같은 클래스의 sticky 헤더 — 헤더 조각(ThemeHeaderBackdrop) 정렬과 스크롤
          가림을 이 자리에서 확인한다. 조각은 배경 있는 테마에서만 그려지므로 직접 넣는다. */}
      <div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
        <div className="theme-header-backdrop" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-text">테마 배경 프리뷰 (임시 — 위치·크기 조정용)</h1>
        <p className="text-xs text-text-muted">
          이 헤더가 실제 헤더와 같은 구조다. 아래 카드를 스크롤해 헤더 밑으로 넣어 가림·정렬을 본다.
        </p>
      </div>

      <div className="space-y-3 px-4 pt-3">
        {background === undefined ? (
          <div className="space-y-3 rounded-[14px] border border-border bg-surface p-4">
            <p className="text-sm text-text">
              지금 테마({theme})는 배경 이미지가 없어 조절할 대상이 없다. 배경을 가진 테마로 전환해야
              한다.
            </p>
            <div className="flex flex-wrap gap-2">
              {themesWithBackground.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    void selectTheme(name)
                  }}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover"
                >
                  {name} 로 전환
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Controls key={theme} theme={theme} background={background} />
        )}

        {/* 스크롤용 채움 — 헤더 밑으로 지나가는 불투명 카드가 조각에 비치지 않아야 한다. */}
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="flex h-24 items-center justify-between rounded-[14px] border border-border bg-surface px-4"
          >
            <span className="text-sm font-medium text-text">스크롤 확인용 카드 {index + 1}</span>
            <span className="rounded-full bg-secondary-tint px-2.5 py-1 text-xs font-bold text-secondary-ink">
              완료
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
