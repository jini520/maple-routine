/**
 * 아이템 가격 입력으로 가는 떠 있는 버튼. 보스 수익의 주간 탭에만 선다.
 *
 * 자리와 크기가 가계부의 ＋ 와 같다. 값은 `lib/fab-metrics.ts` 하나에서 오고, 그리는 자리는
 * `BottomBarOverlay` 포털 안이다. 화면 안에서 그리면 `zIndex` 를 얼마로 주든 떠 있는 하단바
 * 아래로 간다.
 *
 * 원 안에서 아이템 그림 셋이 돈다. 도는 값은 `drop-price-fab-motion.ts` 가 들고, 진행률
 * 하나에서 셋의 자리가 다 나온다.
 *
 * @see docs/features/boss-profit.md 정책
 */
import { BlurView } from 'expo-blur'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'

import { BottomBarOverlay } from '../../components/organisms/BottomBar/BottomBarOverlay'
import { getItemIconUrl } from '../../lib/assets/asset-lookup'
import { useFabBottomPx } from '../../lib/fab-metrics'
import { useLoopedValue } from '../../hooks/useLoopedValue'
import { tapFeedback } from '../../native/haptics'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { useBlurTint, useThemeAppearance } from '../../theme/context'
import { FAB_DARK_EDGE, FAB_SHADOW } from '../../lib/fab-metrics'
import { boxShadowOf } from '../../lib/shadow'
import {
  FAB_ITEM_LOOP_MS,
  FAB_ITEM_SLOTS,
  slotOpacity,
  slotPhase,
  slotTranslateY,
  veilIntensity,
} from './drop-price-fab-motion'

/**
 * 도는 아이템 셋(사용자 지정). 파일명이 아니라 **이름**이라 `item-icons.json` 의 매핑이
 * 바뀌면 이 버튼도 함께 따라간다.
 */
export const DROP_PRICE_FAB_ITEMS = ['고통의 근원', '거대한 공포', '컴플리트 언더컨트롤'] as const

/**
 * 애니메이션이 붙는 상자. `nativewind-interop` 에 등록된 `Animated.View` 를 쓰지 않는다.
 *
 * 등록된 컴포넌트에 정적 스타일과 애니메이션 스타일을 한 배열로 넘기면 정적 쪽이 사라진다.
 * 대가는 `className` 을 못 쓰는 것이라 이 파일의 애니메이션 상자는 치수까지 `style` 로 준다.
 */
const AnimatedBox = Animated.createAnimatedComponent(View)
const AnimatedVeil = Animated.createAnimatedComponent(BlurView)

/** 그림의 한 변. 원의 지름 56 안에서 좌우로 12씩 남는다. */
const ITEM_PX = 32

interface DrumItemProps {
  itemName: string
  slot: number
  progress: SharedValue<number>
}

function DrumItem(props: DrumItemProps): React.JSX.Element | null {
  const { progress, slot } = props

  const style = useAnimatedStyle(() => {
    const phase = slotPhase(progress.value, slot)
    return {
      opacity: slotOpacity(phase),
      transform: [{ translateY: slotTranslateY(phase) }],
    }
  })

  // 모르는 그림을 비슷한 것으로 때우지 않는다. 매핑이 비면 그 슬롯만 빠지고 나머지는 돈다.
  const source = getItemIconUrl(props.itemName)
  if (source === null) return null

  return (
    <AnimatedBox
      style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Image
        testID={`drop-price-fab-item-${slot}`}
        source={source}
        resizeMode="contain"
        style={{ width: ITEM_PX, height: ITEM_PX }}
      />
    </AnimatedBox>
  )
}

export function DropPriceFab(): React.JSX.Element {
  const navigation = useScreenNavigation()
  const tint = useBlurTint()
  const { definition } = useThemeAppearance()
  const fabBottomPx = useFabBottomPx()

  // 움직임 줄이기면 진행률이 0 에 머문다. 그 값에서 첫 그림 하나가 가운데 서고 나머지 둘은
  // 불투명도가 0 이라, 애니메이션을 끄는 갈래를 따로 둘 필요가 없다.
  const progress = useLoopedValue({
    from: 0,
    to: FAB_ITEM_SLOTS,
    durationMs: FAB_ITEM_LOOP_MS,
    easing: Easing.linear,
  })

  const veil = useAnimatedProps(() => ({ intensity: veilIntensity(progress.value) }))

  return (
    <BottomBarOverlay>
      {/* 상자는 자기 자리를 안 먹는다. 오른쪽 여백이 이 상자의 넓이라, 상자가 터치를 받으면
          버튼 옆의 목록 줄이 안 눌린다. */}
      <View
        testID="drop-price-fab"
        pointerEvents="box-none"
        style={{ bottom: fabBottomPx }}
        className="absolute right-4"
      >
        {/* 그림자만 드는 상자. **원 밖이어야 한다** - 아래 원이 `overflow-hidden` 이라 같은 뷰에
            달면 플랫폼에 따라 그림자가 잘린다. 여기서 자르지도 않는다(자르면 그림자가 자기 상자
            안에 갇힌다). 모양은 `borderRadius` 에서 나온다. */}
        <View
          testID="drop-price-fab-elevation"
          style={{ borderRadius: 999, boxShadow: boxShadowOf(definition.shadowColor, FAB_SHADOW) }}
        >
        <Pressable
          role="button"
          // 원 안에 글자가 없다. 이 이름이 무엇이 열리는지 말하는 유일한 자리다.
          aria-label="아이템 가격 입력"
          onPress={() => {
            tapFeedback()
            navigation.navigate('DropPrice')
          }}
          // 다크에서는 그림자가 거의 안 보여 테두리가 경계를 진다. 크기가 박힌 이 원이 들어야
          // 테두리가 안쪽에 그려져 자리가 안 움직인다.
          style={
            definition.mode === 'dark'
              ? { borderWidth: StyleSheet.hairlineWidth, borderColor: FAB_DARK_EDGE }
              : undefined
          }
          className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary"
        >
          {DROP_PRICE_FAB_ITEMS.map((itemName, slot) => (
            <DrumItem key={itemName} itemName={itemName} slot={slot} progress={progress} />
          ))}

          {/* 흐림은 **자기 뒤에 있는 것**을 흐린다. 그림들보다 뒤에 서야 그것들이 흐려진다.
              모서리는 위 `overflow-hidden` 이 자른다. 여기에 반경을 주면 iOS 의 시각 효과
              뷰가 그것을 안 따라 각진 네모가 원 밖으로 삐져나온다. */}
          <AnimatedVeil
            testID="drop-price-fab-veil"
            animatedProps={veil}
            tint={tint}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
        </View>
      </View>
    </BottomBarOverlay>
  )
}
