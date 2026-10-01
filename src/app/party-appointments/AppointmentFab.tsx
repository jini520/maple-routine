/**
 * 약속을 더하는 떠 있는 ＋. 자리와 크기가 가계부의 ＋ 와 같다(`lib/fab-metrics.ts`).
 *
 * `BottomBarOverlay` 포털 안에서 그린다. 화면 안에서 그리면 떠 있는 하단바 아래로 간다.
 */
import { Pressable, StyleSheet, View } from 'react-native'

import { PlusIcon } from '../../components/atoms'
import { BottomBarOverlay } from '../../components/organisms/BottomBar/BottomBarOverlay'
import { FAB_DARK_EDGE, FAB_SHADOW, useFabBottomPx } from '../../lib/fab-metrics'
import { boxShadowOf } from '../../lib/shadow'
import { tapFeedback } from '../../native/haptics'
import { useThemeAppearance } from '../../theme/context'

export function AppointmentFab(props: { onPress: () => void }): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const bottomPx = useFabBottomPx()

  return (
    <BottomBarOverlay>
      <View pointerEvents="box-none" style={{ bottom: bottomPx }} className="absolute right-4">
        {/* 그림자만 드는 상자. 원이 그림자를 들면 둥근 원 뒤에 네모난 그림자가 깔린다. */}
        <View style={{ borderRadius: 999, boxShadow: boxShadowOf(definition.shadowColor, FAB_SHADOW) }}>
          <Pressable
            role="button"
            aria-label="약속 추가"
            onPress={() => {
              tapFeedback()
              props.onPress()
            }}
            // 다크에서는 그림자가 거의 안 보여 테두리가 경계를 진다.
            style={
              definition.mode === 'dark'
                ? { borderWidth: StyleSheet.hairlineWidth, borderColor: FAB_DARK_EDGE }
                : undefined
            }
            className="h-14 w-14 items-center justify-center rounded-full bg-primary"
          >
            <PlusIcon className="h-6 w-6 text-on-primary" strokeWidth={2.2} aria-hidden />
          </Pressable>
        </View>
      </View>
    </BottomBarOverlay>
  )
}
