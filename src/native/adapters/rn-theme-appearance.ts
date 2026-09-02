import type { ThemeAppearancePort } from '../ports'

import { setThemeAppearance } from '../../theme/appearance-store'

/**
 * `ThemeAppearancePort` 의 RN 구현(— 밖으로 나가는 시그니처는 Capacitor 구현과
 * 한 글자도 다르지 않다).
 *
 * ## 웹뷰 구현이 하던 넷 중 무엇이 여기 남는가
 *
 * | 웹뷰 | RN |
 * |---|---|
 * | 38토큰을 `buildThemeCss` 로 `<style>` 에 주입 | `vars()` 로 렌더 트리에 내려보낸다. 그래서 **값을 넘기는 것**이 일이다 |
 * | `data-theme`(눈으로 확인용) | 없다. `theme` 은 값으로 흐르므로 표식을 따로 붙일 자리가 없다 |
 * | `data-mode` | `definition.mode` 로 파생 토큰을 만든다(`theme-vars.ts`). 선택자가 없으니 값으로 푼다 |
 * | `color-scheme`·`scrollbar-color` | 스크롤 인디케이터는 RN 에서 **프롭**이라 뷰가 정한다(`useScrollIndicatorStyle`) |
 *
 * 그래서 이 어댑터는 한 줄이다. **DOM 작업이 사라진 자리에 남는 것은 "값을 어디에 놓는가" 하나**다.
 * 상태바·내비바 명암은 포트 주석대로 여기가 아니라 호출부(`features/theme/store.ts`)가 계속 맡는다.
 *
 * 놓는 자리와 읽는 쪽이 갈리는 이유는 `appearance-store.ts` 에 있다(값이 흐르는 방향이 웹뷰와 반대다).
 */
export const rnThemeAppearancePort: ThemeAppearancePort = {
  apply: (theme, definition) => {
    setThemeAppearance(theme, definition)
  },
}
