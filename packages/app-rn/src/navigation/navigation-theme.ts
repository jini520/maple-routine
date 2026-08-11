/**
 * react-navigation 이 **자기가 칠하는 자리**에 쓸 색 — 화면 배경·카드·구분선 같은 것들.
 *
 * `className` 으로 접히지 않는 자리라 컨텍스트에서 값을 읽는다(`useScrollIndicatorStyle` 과 같은
 * 부류다 — `src/theme/context.ts` 가 그 판단을 적어 두었다).
 *
 * **없으면 흰색으로 칠한다.** 라이브러리 기본 테마의 `background` 는 흰색이고, 다크 테마에서 화면
 * 전환이 시작되는 프레임에 그 흰 바탕이 드러난다. 웹뷰에서는 `body` 가 같은 값으로 칠해져 있어
 * 생기지 않던 종류의 결함이다.
 */

import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native'

import { useThemeAppearance } from '../theme/context'

export function useNavigationTheme(): Theme {
  const { definition } = useThemeAppearance()
  const isDark = definition.mode === 'dark'

  // 폰트는 라이브러리 기본을 그대로 물려받는다 — 이 앱은 커스텀 폰트를 쓰지 않고, 여기서 새로
  // 정하면 타이포 규칙의 진실이 `design-system.md` 밖에 하나 더 생긴다.
  const base = isDark ? DarkTheme : DefaultTheme

  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: definition.primaryInk,
      background: definition.bg,
      card: definition.surface,
      text: definition.text,
      border: definition.border,
      notification: definition.error,
    },
  }
}
