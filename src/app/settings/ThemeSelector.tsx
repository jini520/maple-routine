import { useState } from 'react'
import { Check, Moon, Sun } from 'lucide-react'
import { THEME_NAMES, getThemeDefinition, groupThemesByCategory } from '../../lib/theme-registry'
import type { ThemeName } from '../../types/theme'

export interface ThemeSelectorProps {
  theme: ThemeName
  onSelect: (theme: ThemeName) => void
}

/**
 * 라이트·다크 필터 ([[ADR-104]] 결정 3).
 *
 * 카테고리와 모드는 **직교하는 축**이라 둘 다 섹션 제목이 될 수 없다. 카테고리가 제목을 갖고
 * 모드는 필터가 된다. 상태를 저장하지 않는 것도 결정의 일부다 — 모달을 다시 열면 전체로 돌아온다.
 */
const MODE_FILTERS = ['전체', '라이트', '다크'] as const
type ModeFilter = (typeof MODE_FILTERS)[number]

const FILTERED_MODE: Record<ModeFilter, 'light' | 'dark' | null> = {
  전체: null,
  라이트: 'light',
  다크: 'dark',
}

// 탭 토글 모양은 design-system 「탭 토글」([[ADR-018]])을 그대로 쓴다 — 새 스타일을 만들지 않는다.
const CHIP_CLASS = 'rounded-full px-3 py-[5px] text-sm'
const CHIP_ACTIVE = `${CHIP_CLASS} bg-primary-tint font-semibold text-primary-ink`
const CHIP_IDLE = `${CHIP_CLASS} font-medium text-text-muted`

// ThemeModal 안에 들어가는 선택 목록 — 모달 자체가 카드 역할을 하므로 여기서는
// 카드 테두리를 다시 두르지 않는다.
export function ThemeSelector(props: ThemeSelectorProps): React.JSX.Element {
  const [filter, setFilter] = useState<ModeFilter>('전체')

  const mode = FILTERED_MODE[filter]
  const visible = THEME_NAMES.filter(
    (name) => mode === null || getThemeDefinition(name).mode === mode,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {MODE_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
            className={filter === option ? CHIP_ACTIVE : CHIP_IDLE}
          >
            {option}
          </button>
        ))}
      </div>

      {groupThemesByCategory(visible).map((group) => (
        <section key={group.category} className="space-y-2">
          <h3
            data-testid="theme-category-heading"
            className="text-xs font-semibold tracking-wide text-text-muted"
          >
            {group.category}
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            {group.themes.map((name) => (
              <ThemeTile
                key={name}
                name={name}
                isSelected={props.theme === name}
                onSelect={props.onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

interface ThemeTileProps {
  name: ThemeName
  isSelected: boolean
  onSelect: (theme: ThemeName) => void
}

/**
 * 그 테마의 화면을 축소해 보여주는 타일 ([[ADR-104]] 결정 2).
 *
 * 색은 **활성 테마의 CSS 커스텀 프로퍼티가 아니라 레지스트리에서 직접** 읽는다 — 비활성 테마의
 * 색을 미리 보여주는 것이 이 컴포넌트의 일이라 `var(--color-*)` 로는 낼 수 없다([[ADR-064]] 결정 10).
 * 선택 링·체크도 모달 테마가 아니라 **그 타일의 primary** 를 쓴다(타일 안은 그 테마의 세계다).
 *
 * 배경 이미지를 가진 테마도 여기서는 색만 쓴다([[ADR-104]] 결정 4).
 */
function ThemeTile(props: ThemeTileProps): React.JSX.Element {
  const tokens = getThemeDefinition(props.name)
  const ModeIcon = tokens.mode === 'dark' ? Moon : Sun

  return (
    <button
      type="button"
      aria-pressed={props.isSelected}
      onClick={() => props.onSelect(props.name)}
      style={{
        backgroundColor: tokens.bg,
        borderColor: props.isSelected ? tokens.primary : tokens.border,
        boxShadow: props.isSelected ? `inset 0 0 0 1px ${tokens.primary}` : undefined,
      }}
      className="relative flex h-[92px] flex-col gap-[7px] rounded-[12px] border p-2.5 text-left"
    >
      <span
        style={{ backgroundColor: tokens.surface, borderColor: tokens.border }}
        className="flex items-center gap-1.5 rounded-[7px] border p-1.5"
      >
        <span
          style={{ backgroundColor: tokens.surface2 }}
          className="h-[5px] flex-1 rounded-full"
        />
        <span style={{ backgroundColor: tokens.primary }} className="h-3.5 w-8 rounded-full" />
      </span>

      <span
        style={{ color: tokens.text }}
        className="flex items-center gap-1 text-xs font-bold leading-tight"
      >
        {props.name}
        <ModeIcon aria-hidden="true" className="h-2.5 w-2.5 shrink-0 opacity-70" strokeWidth={2} />
      </span>

      {props.isSelected && (
        <span
          aria-hidden="true"
          style={{ backgroundColor: tokens.primary, color: tokens.onPrimary }}
          className="absolute right-1.5 top-1.5 grid h-[17px] w-[17px] place-items-center rounded-full"
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}
