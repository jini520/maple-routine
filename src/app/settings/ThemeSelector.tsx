import type { ThemeName } from '../../types/theme'

export interface ThemeSelectorProps {
  theme: ThemeName
  onSelect: (theme: ThemeName) => void
}

const THEME_OPTIONS: ThemeName[] = ['레테', '렌']

export function ThemeSelector(props: ThemeSelectorProps): React.JSX.Element {
  return (
    <div className="rounded-[14px] bg-surface border border-border p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-text">테마</h2>
        <p className="text-sm text-text-muted">원하는 테마를 선택해주세요.</p>
      </div>

      <div className="flex gap-2">
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
                  ? 'flex-1 rounded-[14px] border border-primary bg-primary/15 px-4 py-3 text-sm font-semibold text-text'
                  : 'flex-1 rounded-[14px] border border-border px-4 py-3 text-sm font-semibold text-text hover:bg-primary/15'
              }
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
