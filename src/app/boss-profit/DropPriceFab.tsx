/**
 * 아이템 가격 입력으로 가는 떠 있는 버튼. 보스 수익의 주간 탭에만 선다.
 *
 * 자리와 크기가 가계부의 ＋ 와 같다. 값은 `lib/fab-metrics.ts` 하나에서 오고, 그리는 자리는
 * `BottomBarOverlay` 포털 안이다. 화면 안에서 그리면 `zIndex` 를 얼마로 주든 떠 있는 하단바
 * 아래로 간다.
 *
 * 원 안의 태그가 가끔 구멍을 축으로 흔들린다. 값은 `drop-price-fab-motion.ts` 가 든다.
 *
 * 원 오른쪽 위에 보고 있는 주의 가격 미입력 건수가 선다. 수익 내역 상자가 미입력 줄을 안 싣는
 * 대신 이 배지가 그 신호를 받는다.
 *
 * @see docs/features/boss-profit.md 정책
 */
import { Pressable, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle } from 'react-native-reanimated'

import { TagIcon, Text } from '../../components/atoms'
import { BottomBarOverlay } from '../../components/organisms/BottomBar/BottomBarOverlay'
import { useUnpricedDropCount } from '../../features/boss-profit/use-unpriced-drop-count'
import { useFabBottomPx } from '../../lib/fab-metrics'
import { useLoopedValue } from '../../hooks/useLoopedValue'
import { tapFeedback } from '../../native/haptics'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { useThemeAppearance } from '../../theme/context'
import { FAB_SHADOW } from '../../lib/fab-metrics'
import { boxShadowOf } from '../../lib/shadow'
import { TAG_SWING_LOOP_MS, TAG_SWING_PIVOT, tagSwingDegrees } from './drop-price-fab-motion'

/**
 * 애니메이션이 붙는 상자. `nativewind-interop` 에 등록된 `Animated.View` 를 쓰지 않는다.
 *
 * 등록된 컴포넌트에 정적 스타일과 애니메이션 스타일을 한 배열로 넘기면 정적 쪽이 사라진다.
 */
const AnimatedBox = Animated.createAnimatedComponent(View)

/** 배지에 그대로 적는 가장 큰 수. 넘으면 `9+` 다. */
const BADGE_MAX_COUNT = 9

export function DropPriceFab(props: {
  /** 보스 수익 주간 탭이 보고 있는 주. 버튼이 여는 가격 입력 화면도 그 주로 열린다. */
  periodKey: string
}): React.JSX.Element {
  const navigation = useScreenNavigation()
  const { definition } = useThemeAppearance()
  const fabBottomPx = useFabBottomPx()
  // 모르는 수(`null`)와 0 은 배지를 안 세운다.
  const unpriced = useUnpricedDropCount(props.periodKey)
  const showsBadge = unpriced !== null && unpriced > 0

  // 움직임 줄이기면 진행률이 0 에 머문다. 그 값에서 각도가 0 이라 끄는 갈래를 따로 둘 필요가 없다.
  const progress = useLoopedValue({
    from: 0,
    to: 1,
    durationMs: TAG_SWING_LOOP_MS,
    easing: Easing.linear,
  })

  const swing = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tagSwingDegrees(progress.value)}deg` }],
  }))

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
        {/* 그림자만 드는 상자. 모양은 `borderRadius` 에서 나온다. */}
        <View
          testID="drop-price-fab-elevation"
          style={{ borderRadius: 999, boxShadow: boxShadowOf(definition.shadowColor, FAB_SHADOW) }}
        >
          <Pressable
            role="button"
            // 원 안에 글자가 없다. 이 이름이 무엇이 열리는지 말하는 유일한 자리다. 배지가 `9+` 여도
            // 스크린리더는 실제 수를 읽는다.
            aria-label={showsBadge ? `아이템 가격 입력, 미입력 ${unpriced}건` : '아이템 가격 입력'}
            onPress={() => {
              tapFeedback()
              // 버튼은 주간 탭에만 선다. 가격 입력 화면은 보스 수익 스토어를 안 읽으므로 보던 주를 넘긴다.
              navigation.navigate('DropPrice', { cycle: 'weekly', periodKey: props.periodKey })
            }}
            className="h-14 w-14 items-center justify-center rounded-full bg-primary"
          >
            <AnimatedBox testID="drop-price-fab-tag" style={[{ transformOrigin: TAG_SWING_PIVOT }, swing]}>
              <TagIcon className="h-6 w-6 text-on-primary" strokeWidth={2.2} aria-hidden />
            </AnimatedBox>
          </Pressable>
        </View>
        {/* 뜻은 원의 이름이 읽으므로 배지는 장식이다. */}
        {showsBadge && (
          <View
            testID="drop-price-fab-badge"
            pointerEvents="none"
            aria-hidden
            // 한 자리일 때 정원이 되도록 최소 너비를 높이와 같은 수로 준다. 최소 너비만 계단
            // 이름(`min-w-4.5`)을 못 쓰고 박은 값이다. `tailwind-v4-axes.cjs` 가 `minWidth`
            // 계단을 `full` 과 컨테이너 폭으로 갈아끼워 spacing 에서 파생되는 이름이 없다.
            className="absolute right-0 top-0 h-4.5 min-w-[18px] items-center justify-center rounded-full bg-error px-1"
          >
            <Text className="text-9 font-bold leading-none text-on-error">
              {unpriced > BADGE_MAX_COUNT ? `${BADGE_MAX_COUNT}+` : String(unpriced)}
            </Text>
          </View>
        )}
      </View>
    </BottomBarOverlay>
  )
}
