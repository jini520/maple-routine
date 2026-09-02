import type { ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { vars } from 'nativewind'
import { View } from 'react-native'

import { getThemeAppearance, subscribeThemeAppearance } from './appearance-store'
import { ThemeContext } from './context'
import { buildThemeVariables } from './theme-vars'

/**
 * 고른 테마의 38토큰을 화면 전체에 내려보낸다 — **웹의 `:root` 에 해당하는 자리**(3단계).
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
 * ## 이 View 가 **앱의 바탕을 칠한다**
 *
 * 웹에서 이 자리(`:root`/`body`)는 늘 `bg-bg` 로 칠해져 있었다. RN 으로 옮기며 그 한 줄이 빠졌고,
 * 앱에서 바탕을 칠하는 것이 **내비게이터의 화면들뿐**이 됐다. 화면이 뷰포트를 꽉 채우니 평소에는
 * 아무 일도 없지만, **화면 밖이 드러나는 순간**(하위 페이지로 미끄러져 들어갈 때 iOS 가 화면
 * 모서리를 둥글게 깎는다 — 나가는 화면의 오른쪽 위와 들어오는 화면의 왼쪽 위 곡선 사이) 그 틈으로
 * **RN 루트 뷰의 흰색**이 보인다. 다크 테마에서 흰 쐐기라 눈에 띈다.
 *
 * 시뮬레이터 실측: 내비게이션 두 층(루트 스택 `contentStyle` · 탭 `sceneStyle`)을 투명하게 두면
 * 화면의 **89.8%가 흰색**이었다 — 그 아래에 아무것도 없다는 뜻이다.
 *
 * ** 와 어긋나지 않는다.** 그 결정(*"앱 루트의 `bg-bg` 를 빼라"*)은 웹에서 벽지가
 * `z-index: -1` 로 루트 **뒤**에 있었기 때문이고, 루트를 칠하면 벽지가 통째로 가려졌다. RN 의 벽지
 * (`ThemeBackdrop`)는 이 View 의 **자식**이라 위에 그려진다 — 가릴 수 없다.
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
      <View
        className="flex-1"
        // 색을 `className`(`bg-bg`)이 아니라 값으로 주는 이유는 이 View 가 **변수를 얹는 바로 그
        // 자리**이기 때문이다 — 자기가 정의하는 변수를 자기 클래스가 다시 읽는 모양이 된다.
        style={[{ backgroundColor: appearance.definition.bg }, vars(buildThemeVariables(appearance.definition))]}
      >
        {props.children}
      </View>
    </ThemeContext.Provider>
  )
}
