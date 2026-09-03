/**
 * 층 안의 탭 내비게이터 셋이 공유하는 props.
 *
 * 파일이 따로인 이유는 벽지다. 이 상수가 `screenLayout` 을 들어야 하는데 그것을 `LayerStack.tsx` 에
 * 두면 컴포넌트만 내보내는 파일 규칙이 깨져 fast refresh 가 죽는다. 값이 한 곳에 있어야 셋이
 * 갈라지지 않으므로 파일을 가른다.
 */
import type { ReactNode } from 'react'

import { ScreenBackdrop } from '../components/templates/ThemeBackdrop/ScreenBackdrop'

/**
 * `backBehavior="none"` 이다. `"history"` 는 모든 탭 전환을 쌓는다. 층을 오르내리는 일은 바깥
 * 스택이 진다. 바는 이 내비게이터들이 그리지 않는다(`tabBar` 가 아무것도 안 낸다).
 *
 * `screenLayout` 이 여기 있어야 하는 이유는 벽지가 가장 안쪽 불투명 화면에 붙어야 하기
 * 때문이다. 안드로이드는 화면을 불투명하게 칠하고 벽지를 화면마다 들려 보내는데, 그 불투명
 * 배경은 `NavigationContainer` 테마라 모든 내비게이터에 걸리고 벽지는 `screenLayout` 을 준
 * 내비게이터에만 걸린다. 층 스택에만 두면 이 탭들이 자기 화면을 칠하면서 그 벽지를 덮는다.
 *
 * iOS 에서는 `ScreenBackdrop` 이 자식을 그대로 통과시켜 뷰가 안 는다.
 */
export const TAB_LAYER_PROPS = {
  backBehavior: 'none',
  tabBar: () => null,
  screenOptions: { headerShown: false },
  screenLayout: ({ children }: { children: ReactNode }) => <ScreenBackdrop>{children}</ScreenBackdrop>,
} as const
