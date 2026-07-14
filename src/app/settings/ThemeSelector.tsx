import type { ThemeName } from '../../types/theme'
import { ThemeSwatchDots } from './ThemeSwatchDots'

export interface ThemeSelectorProps {
  theme: ThemeName
  onSelect: (theme: ThemeName) => void
}

const THEME_OPTIONS: ThemeName[] = ['머쉬맘', '혼테일', '레테', '렌']

// ThemeModal 안에 들어가는 선택 목록 — 모달 자체가 카드 역할을 하므로 여기서는
// 카드 테두리를 다시 두르지 않는다.
export function ThemeSelector(props: ThemeSelectorProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      {THEME_OPTIONS.map((option) => {
        const isSelected = props.theme === option
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isSelected}
            onClick={() => props.onSelect(option)}
            className={
              isSelected
                ? 'w-full flex items-center gap-3 rounded-[10px] border border-primary bg-primary/15 px-4 py-3'
                : 'w-full flex items-center gap-3 rounded-[10px] border border-border px-4 py-3 hover:bg-primary/15'
            }
          >
            <ThemeSwatchDots theme={option} />
            <span className="text-sm font-semibold text-text">{option}</span>
          </button>
        )
      })}
    </div>
  )
}
