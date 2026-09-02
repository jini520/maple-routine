/**
 * 화면 상단 헤더 셸. 스케줄러 계열 화면이 글자까지 같은 마크업을 복붙하던 자리를 하나로 모은 것.
 *
 * 상단 안전영역을 먹는 쪽이 이 헤더다. `ScreenScroll` 은 헤더가 있으면 그 위쪽을 안 건드린다.
 * 값은 `insets.top` 이 아니라 `useTopSafeAreaPx()` 로 받는다. 안드로이드 하한이 그 안에 있어야
 * 헤더 여백과 `safe-area-fade.ts` 의 페이드 길이가 같은 값을 본다.
 *
 * 경계 페이드와 상수 여백은 두지 않는다. 헤더가 함께 스크롤돼 덮어 줄 경계가 없다.
 */
import { View } from 'react-native'

import { useTopSafeAreaPx } from '../../../lib/safe-area'

export interface PageHeaderProps {
  /** 헤더 내용. 안에서 `gap-4` 로 세로 간격이 잡힌다. */
  children: React.ReactNode
  /**
   * 헤더 바로 아래 띠(`top-full`)에 겹쳐 그릴 것. 당겨서 새로고침 인디케이터가 이 자리를 쓴다.
   * `children` 에 섞으면 `gap-4` 흐름 자식이 되어 위치가 달라진다.
   */
  below?: React.ReactNode
}

export function PageHeader(props: PageHeaderProps): React.JSX.Element {
  const topSafeAreaPx = useTopSafeAreaPx()

  return (
    <View testID="page-header" className="z-10 px-4 pb-2" style={{ paddingTop: topSafeAreaPx }}>

      <View className="gap-4">{props.children}</View>

      {props.below}
    </View>
  )
}
