import type { ThemeAppearancePort } from '../ports'

import { setThemeAppearance } from '../../theme/appearance-store'

/**
 * `ThemeAppearancePort` 의 RN 구현.
 *
 * 토큰은 `vars()` 로 렌더 트리에 내려보낸다. 그래서 이 어댑터가 하는 일은 값을 어디에 놓는가
 * 하나다. 모드 파생 토큰은 `definition.mode` 로 `theme-vars.ts` 가 만들고, 스크롤 인디케이터는
 * RN 에서 프롭이라 뷰가 정한다(`useScrollIndicatorStyle`).
 *
 * 상태바·내비바 명암은 여기가 아니라 호출부(`features/theme/store.ts`)가 맡는다.
 */
export const rnThemeAppearancePort: ThemeAppearancePort = {
  apply: (theme, definition) => {
    setThemeAppearance(theme, definition)
  },
}
