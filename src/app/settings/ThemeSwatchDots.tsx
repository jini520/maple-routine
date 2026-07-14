import jobThemesData from '../../data/job-themes.json'
import type { JobThemes, ThemeName } from '../../types/theme'

const JOB_THEMES = jobThemesData as JobThemes

export interface ThemeSwatchDotsProps {
  theme: ThemeName
}

// 테마 미리보기용 대표 컬러 3개(primary/secondary/third) — 실제 CSS 커스텀 프로퍼티는
// 현재 활성 테마 값만 노출하므로, 비활성 테마 옵션까지 미리 보여주려면 job-themes.json을
// 직접 읽어야 한다.
export function ThemeSwatchDots(props: ThemeSwatchDotsProps): React.JSX.Element {
  const tokens = JOB_THEMES[props.theme]
  const colors = [tokens.primary, tokens.secondary, tokens.third]

  return (
    <span className="flex items-center -space-x-1">
      {colors.map((color, index) => (
        <span
          key={index}
          data-testid="theme-swatch-dot"
          style={{ backgroundColor: color }}
          className="h-4 w-4 rounded-full border border-surface"
        />
      ))}
    </span>
  )
}
