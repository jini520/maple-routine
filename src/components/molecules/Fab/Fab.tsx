/**
 * 떠 있는 ＋ 의 원. 지름 · 테마색 · 그림자 · 누를 때의 촉각을 쥐는 부품.
 *
 * 그림자는 원을 감싼 바깥 뷰가 든다. 원에 `overflow-hidden` 을 주면 같은 뷰의 그림자가 잘리기 때문.
 * 지름은 `FAB_DIAMETER_PX` 와 같아야 한다. 화면이 그 값만큼 콘텐츠 끝을 비운다.
 *
 * @example
 * <BottomBarOverlay>
 *   <FabAnchor>
 *     <Fab label="아이템 넣기" onPress={open}>
 *       <PlusIcon className="h-6 w-6 text-on-primary" strokeWidth={2.2} aria-hidden />
 *     </Fab>
 *   </FabAnchor>
 * </BottomBarOverlay>
 */
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import { FAB_SHADOW, useFabPlacement } from '../../../lib/fab-metrics'
import { boxShadowOf } from '../../../lib/shadow'
import { tapFeedback } from '../../../native/haptics'
import { useThemeAppearance } from '../../../theme/context'

export interface FabProps {
  /** 스크린리더가 읽는 이름. 원 안에 글자가 없어 무엇이 열리는지 말하는 곳은 여기뿐이다 */
  label: string
  onPress: () => void
  /** 원 안의 그림 */
  children: ReactNode
  testID?: string
  /** 그림자를 드는 바깥 뷰의 testID */
  elevationTestID?: string
}

export function Fab(props: FabProps): React.JSX.Element {
  const { definition } = useThemeAppearance()
  return (
    <View
      testID={props.elevationTestID}
      // 모양은 `borderRadius` 에서 나온다. 없으면 둥근 원 뒤에 네모난 그림자가 깔린다.
      style={{ borderRadius: 999, boxShadow: boxShadowOf(definition.shadowColor, FAB_SHADOW) }}
    >
      <Pressable
        testID={props.testID}
        role="button"
        aria-label={props.label}
        onPress={() => {
          tapFeedback()
          props.onPress()
        }}
        className="h-14 w-14 items-center justify-center rounded-full bg-primary"
      >
        {props.children}
      </Pressable>
    </View>
  )
}

/**
 * 홀로 뜨는 ＋ 의 위치 상자. 화면 아래 · 오른쪽에서 `useFabPlacement` 만큼 떨어진 자리.
 *
 * 하단바 위 슬롯(`BottomBarOverlay`)은 부르는 쪽이 감싼다. 화면 안에서 그리면 떠 있는 하단바 아래로 가기 때문.
 */
export function FabAnchor(props: { children: ReactNode; testID?: string }): React.JSX.Element {
  const fab = useFabPlacement()
  return (
    <View
      testID={props.testID}
      // 오른쪽 여백도 이 상자의 넓이라, 상자가 터치를 받으면 버튼 옆의 목록 줄이 안 눌린다.
      pointerEvents="box-none"
      style={{ bottom: fab.bottomPx, right: fab.rightPx }}
      className="absolute"
    >
      {props.children}
    </View>
  )
}
