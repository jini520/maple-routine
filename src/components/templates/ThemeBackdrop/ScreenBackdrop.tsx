// 화면이 들고 다니는 벽지 —. 두 내비게이터가 `screenLayout` 으로 모든 화면을
// 이것으로 감싼다(`RootNavigator`·`TabNavigator`).
//
// **불투명한 화면 «안»이라는 자리가 요점이다.** 벽지를 셸 하나에 깔면 화면이 투명해야 하고, 그
// 투명이 안드로이드 전환 중에 아래 화면까지 비춘다(`screen-backdrop-policy.ts`). 화면을 불투명하게
// 되돌리면 겹침은 사라지지만 벽지도 함께 가려지므로, 가리는 그 화면이 벽지를 **자기 안에** 들고
// 있어야 한다.
//
// 벽지는 `ScreenScroll` 의 **마스크 밖**이다 — 안이면 안전영역 페이드가 벽지까지 깎아 화면 끝에서
// 벽지가 사라진다(이 깎으려던 것은 콘텐츠뿐이다).
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { SCREENS_CARRY_BACKDROP } from '../../../theme/screen-backdrop-policy'
import { ThemeBackdrop } from './ThemeBackdrop'

export function ScreenBackdrop({ children }: { children: ReactNode }): React.JSX.Element {
  // iOS 는 셸의 벽지 한 장을 투명한 화면 너머로 그대로 본다 — 뷰를 늘리지 않는다.
  if (!SCREENS_CARRY_BACKDROP) return <>{children}</>

  return (
    <View className="flex-1">
      {/* 첫 자식이라 뒤에 깔린다(`AppShell` 이 셸에서 하는 것과 같은 이유). 배경을 선언하지 않은
          테마에서는 아무것도 그리지 않으므로, 그때는 화면의 불투명 배경색만 남는다. */}
      <ThemeBackdrop />
      {children}
    </View>
  )
}
