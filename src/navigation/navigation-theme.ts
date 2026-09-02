/**
 * react-navigation 이 **자기가 칠하는 자리**에 쓸 색. 화면 배경·카드·구분선 같은 것들.
 *
 * `className` 으로 접히지 않는 자리라 컨텍스트에서 값을 읽는다(`useScrollIndicatorStyle` 과 같은
 * 부류다. `src/theme/context.ts` 가 그 판단을 적어 두었다).
 *
 * **없으면 흰색으로 칠한다.** 라이브러리 기본 테마의 `background` 는 흰색이고, 다크 테마에서 화면
 * 전환이 시작되는 프레임에 그 흰 바탕이 드러난다. 웹뷰에서는 `body` 가 같은 값으로 칠해져 있어
 * 생기지 않던 종류의 결함이다.
 */

import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native'

import { useThemeAppearance } from '../theme/context'
import { SCREENS_CARRY_BACKDROP } from '../theme/screen-backdrop-policy'

export function useNavigationTheme(): Theme {
  const { definition } = useThemeAppearance()
  const isDark = definition.mode === 'dark'

  // 폰트는 라이브러리 기본을 그대로 물려받는다. 이 앱은 커스텀 폰트를 쓰지 않고, 여기서 새로
  // 정하면 타이포 규칙의 진실이 `design-system.md` 밖에 하나 더 생긴다.
  const base = isDark ? DarkTheme : DefaultTheme

  // **배경 이미지가 있는 테마에서 화면 배경을 비울지**.
  //
  // 웹에서 그 결정은 *"앱 루트의 `bg-bg` 를 빼라"* 였다. 안 빼면 벽지가 **통째로 사라진다**
  // (2026-08-03 브라우저 확인: 어둡게 깔린 게 아니라 아예 안 보였다). RN 에서 같은 자리가 여기다:
  // 벽지는 셸의 첫 자식으로 뒤에 깔리는데, 내비게이터가 자기 화면을 `definition.bg` 로 불투명하게
  // 칠하면 그 위를 덮는다. `transparent` 로 두면 뒤의 벽지가 그대로 보인다.
  //
  // **안드로이드에서는 그 비움 을 쓰지 않는다**(정정 5). 투명한 화면은 벽지만 비추는 것이 아니라
  // **그 아래 화면까지** 비춰, 전환 중 두 화면의 글자가 포개져 읽힌다(실기기 관측). 대신 화면을
  // 불투명하게 두고 벽지를 **화면마다** 들려 보낸다(`ScreenBackdrop`). 그 짝이 깨지면 벽지가
  // 사라지므로 판정은 `screen-backdrop-policy.ts` 한 곳에 있다.
  //
  // 배경이 없는 테마는 **그대로 칠한다**. 라이브러리 기본 테마의 흰 배경이 다크 테마 화면 전환
  // 프레임에 드러나는 것을 막는 것이 이 값의 원래 목적이고(파일 머리), 그 목적은 여전히 유효하다.
  const emptyScreenBackground = definition.background !== undefined && !SCREENS_CARRY_BACKDROP

  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: definition.primaryInk,
      background: emptyScreenBackground ? 'transparent' : definition.bg,
      card: definition.surface,
      text: definition.text,
      border: definition.border,
      notification: definition.error,
    },
  }
}
