/**
 * 아이템 넣기 시트를 여는 떠 있는 버튼. 자리와 크기가 가계부 · 파티 스케줄의 ＋ 와 같아 어디서 더하는지 새로 익힐 것이 없다.
 * 그리는 자리는 `BottomBarOverlay` 포털 안이다. 화면 안에서 그리면 떠 있는 하단바 아래로 간다.
 */
import { Pressable, View } from 'react-native'

import { PlusIcon } from '../../components/atoms'
import { BottomBarOverlay } from '../../components/organisms/BottomBar/BottomBarOverlay'
import { FAB_SHADOW, useFabBottomPx } from '../../lib/fab-metrics'
import { boxShadowOf } from '../../lib/shadow'
import { tapFeedback } from '../../native/haptics'
import { useThemeAppearance } from '../../theme/context'

export function InventoryAddFab(props: { onPress: () => void }): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const fabBottomPx = useFabBottomPx()
  return (
    <BottomBarOverlay>
      <View pointerEvents="box-none" style={{ bottom: fabBottomPx }} className="absolute right-4">
        <View style={{ borderRadius: 999, boxShadow: boxShadowOf(definition.shadowColor, FAB_SHADOW) }}>
          <Pressable
            testID="inventory-add-fab"
            role="button"
            aria-label="아이템 넣기"
            onPress={() => {
              tapFeedback()
              props.onPress()
            }}
            className="h-14 w-14 items-center justify-center rounded-full bg-primary"
          >
            <PlusIcon className="h-6 w-6 text-on-primary" strokeWidth={2.2} aria-hidden />
          </Pressable>
        </View>
      </View>
    </BottomBarOverlay>
  )
}
