/**
 * 하위 페이지 아래에 고정하는 버튼 바. 캐릭터 관리의 `저장` · 테마와 글자 크기의 `적용` 이 쓴다.
 *
 * 스크롤 뷰의 형제이자 절대 배치라 굴러가지 않는다. 불투명해야 하는 것은 콘텐츠가 이 아래를 지나가기 때문이고,
 * 색은 카드가 아니라 페이지 바닥이라 `bg-bg` 다. 하단 안전영역은 이 바가 먹는다.
 *
 * @example <SettingsActionBar testID="theme-action-bar" onHeight={setBarPx}><Button …>적용</Button></SettingsActionBar>
 */
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { useBottomSafeAreaPx } from '../../lib/safe-area'

export function SettingsActionBar(props: {
  testID: string
  /** 잰 바 높이. 그만큼 콘텐츠 아래를 비워야 마지막 행이 바 뒤에 숨지 않는다. */
  onHeight: (px: number) => void
  children: ReactNode
}): React.JSX.Element {
  const bottomSafeAreaPx = useBottomSafeAreaPx()

  return (
    <View
      testID={props.testID}
      className="absolute inset-x-0 bottom-0 bg-bg px-4 pt-3"
      style={{ paddingBottom: bottomSafeAreaPx + 12 }}
      onLayout={(event) => props.onHeight(event.nativeEvent.layout.height)}
    >
      {props.children}
    </View>
  )
}
