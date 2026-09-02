// 층 안의 탭 내비게이터 셋이 공유하는 props.
//
// **파일이 따로인 이유는 벽지다.** 이 상수가 `screenLayout` 을 들어야 하는데(아래), 그것을
// `Main.tsx` 에 두면 **컴포넌트만 내보내는 파일** 규칙이 깨져 fast refresh 가 죽는다. 값이 한 곳에
// 있어야 셋이 갈라지지 않으므로 파일을 가른다.
import type { ReactNode } from 'react'

import { ScreenBackdrop } from '../components/templates/ThemeBackdrop/ScreenBackdrop'

/**
 * `backBehavior="none"` 은 가 정한 그대로다. `"history"` 는 **모든 탭 전환**을 쌓아서
 * 결정 4 가 배제한 동작을 만든다. 층을 오르내리는 일은 바깥 스택이 진다.
 * 바는 이 내비게이터들이 그리지 않는다(`tabBar` 가 아무것도 안 낸다). 층 스택의 `layout` 이 한 벌만 그린다.
 *
 * ## `screenLayout` 이 **여기** 있어야 하는 이유
 *
 * 안드로이드는 화면을 **불투명**하게 칠하고(전환 중 아래 화면이 비치는 것을 막으려고) 벽지를
 * 화면마다 들려 보낸다. 그런데 그 불투명 배경은 `NavigationContainer` 테마라
 * **모든** 내비게이터에 걸리고, 벽지는 `screenLayout` 을 준 내비게이터에만 걸린다.
 *
 *  이 탭 위에 층 스택을 끼우면서 `screenLayout` 을 **그 스택에만** 뒀고, 이 탭들이 자기
 * 화면을 칠하면서 층이 깐 벽지를 **덮었다**. 1.0.7 에서 테마 배경이 안드로이드에서만 사라진 것이
 * 그것이다. 벽지는 **가장 안쪽 불투명 화면**이 들어야 한다.
 *
 * iOS 에서는 `ScreenBackdrop` 이 자식을 그대로 통과시켜 뷰가 안 는다.
 */
export const TAB_LAYER_PROPS = {
  backBehavior: 'none',
  tabBar: () => null,
  screenOptions: { headerShown: false },
  screenLayout: ({ children }: { children: ReactNode }) => <ScreenBackdrop>{children}</ScreenBackdrop>,
} as const
