import type { ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { vars } from 'nativewind'
import { View } from 'react-native'

import { getThemeAppearance, subscribeThemeAppearance } from './appearance-store'
import { ThemeContext } from './context'
import { buildThemeVariables } from './theme-vars'

/**
 * 고른 테마의 38토큰을 화면 전체에 내려보낸다 — **웹의 `:root` 에 해당하는 자리**([[ADR-127]] 3단계).
 *
 * 하는 일 둘:
 *   ① `vars()` 를 얹은 View 로 감싼다 → 그 아래 모든 `className`(`bg-primary` 등)이 색을 얻는다.
 *   ② 같은 값을 컨텍스트로도 준다 → `className` 으로 접히지 않는 자리(플랫폼 프롭·파생 계산)가 읽는다.
 *
 * ## 왜 View 가 하나 늘어나는가
 *
 * 웹에서는 변수가 `documentElement` 에 붙어 **레이아웃과 무관**했다. RN 에는 문서가 없어 변수를 얹을
 * 요소가 곧 레이아웃 노드가 된다 — 테마가 side-effect 에서 렌더 트리의 일부로 바뀌었다는 사실의
 * 구체적인 대가다. `flex-1` 로 부모를 그대로 채워 자식들이 보는 상자가 달라지지 않게 한다.
 *
 * ## 구독은 스토어에서, 값은 포트에서
 *
 * `features/theme/store.ts`(core)를 직접 구독하지 않는다. 그 스토어가 테마를 **적용**하는 경로는
 * `ThemeAppearancePort.apply()` 하나이고, 그것이 놓는 자리를 읽으면 *"방금 적용된 것"* 과 화면이
 * 언제나 같다 — 진실을 두 곳에서 읽어 어긋날 자리가 없다. 초기값이 기본 테마인 이유는
 * `appearance-store.ts` 에 있다(웹의 `@theme` 기본 블록과 같은 역할).
 */
export function ThemeProvider(props: { children: ReactNode }): React.JSX.Element {
  const appearance = useSyncExternalStore(subscribeThemeAppearance, getThemeAppearance)

  return (
    <ThemeContext.Provider value={appearance}>
      <View className="flex-1" style={vars(buildThemeVariables(appearance.definition))}>
        {props.children}
      </View>
    </ThemeContext.Provider>
  )
}
