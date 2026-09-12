/**
 * today 머리의 캐릭터 관리 버튼. 얼굴 셋이 원 안에서 차례로 넘어간다.
 *
 * 목록은 뷰모델이 낸다(`headerPortraits`). 대표를 앞에 두는 것과 셋으로 자르는 것이 판정이라,
 * 이 부품은 받은 것을 순서대로 돌리기만 한다.
 *
 * 도는 값은 `header-portrait-motion.ts` 가 들고 진행률 하나에서 얼굴들의 자리가 다 나온다.
 *
 * @see docs/features/today.md 머리의 캐릭터 관리 버튼
 */
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { CircleUserRoundIcon } from '../../components/atoms'
import { CharacterAvatar } from '../../components/molecules/CharacterAvatar/CharacterAvatar'
import { PORTRAIT_HEADER } from '../../components/organisms/CharacterPortrait/portrait-metrics'
import { useLoopedValue } from '../../hooks/useLoopedValue'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { tapFeedback } from '../../native/haptics'
import { useThemeMode } from '../../theme/context'
import {
  headerLoopMs,
  loopTo,
  slotOpacity,
  slotPhase,
  slotTranslateY,
} from './header-portrait-motion'
import type { HeaderPortraitView } from './view-model'

/**
 * 애니메이션이 붙는 상자. `nativewind-interop` 에 등록된 `Animated.View` 를 쓰지 않는다.
 *
 * 등록된 컴포넌트에 정적 스타일과 애니메이션 스타일을 한 배열로 넘기면 정적 쪽이 사라진다.
 * 대가는 `className` 을 못 쓰는 것이라 자리를 `style` 로 준다.
 */
const AnimatedBox = Animated.createAnimatedComponent(View)

/**
 * 원 안의 여백이 드러내는 바탕. **순백과 순검정**이다(사용자 지시).
 *
 * 테마 토큰으로는 낼 수 없는 값이다. `surface` 가 순백인 테마는 렌 하나뿐이고, 라이트의 `bg` 는
 * 테마마다 물들어 있다(엔젤릭버스터 `#F9E9F1`). 그래서 토큰을 쓰지 않고 값으로 박는다.
 *
 * **3자리 hex(`#fff`)를 쓰지 말 것.** 안드로이드 `Color.parseColor` 가 거부해 화면이 죽는다.
 *
 * 가르는 기준은 `mode` 다. 테마 이름으로 가르면 테마가 늘 때마다 목록을 고쳐야 하고 빠뜨리면
 * 조용히 틀린다(`theme/context.ts` 의 `useThemeMode`).
 */
const CIRCLE_BACKGROUND = { light: '#ffffff', dark: '#000000' } as const

/**
 * 테두리 두께(사용자 지시로 1 에서 올렸다).
 *
 * 클래스(`border-2`)로 쓰지 않는다. 이 저장소에서 아무도 안 쓰던 유틸리티라, NativeWind 가 CSS 를
 * 서버가 뜰 때 한 번 컴파일하는 탓에 **두께가 조용히 0 이 된다**(`mr-2` 에서 겪은 그 자리).
 * 색은 `border-primary` 가 이미 쓰이는 클래스라 그쪽에 남는다.
 *
 * 이 값이 원 안의 여백(원 40 − 얼굴 32 의 절반 = 4)의 절반을 넘으면 여백이 선에 먹힌다. 2 가
 * 그 바닥이라, 더 두껍게 하려면 `PORTRAIT_HEADER.faceSize` 를 함께 줄여야 한다.
 */
const CIRCLE_BORDER_PX = 2

function DrumFace(props: {
  portrait: HeaderPortraitView
  slot: number
  slots: number
  progress: SharedValue<number>
}): React.JSX.Element {
  const { progress, slot, slots } = props

  const style = useAnimatedStyle(() => {
    const phase = slotPhase(progress.value, slot, slots)
    return {
      opacity: slotOpacity(phase, slots),
      transform: [{ translateY: slotTranslateY(phase, slots) }],
    }
  })

  return (
    // 얼굴이 원보다 작으므로 가운데로 모은다. 안 모으면 왼쪽 위로 붙어 여백이 오른쪽 아래에만
    // 생긴다(`DropPriceFab` 의 드럼이 같은 이유로 가운데 정렬이다).
    <AnimatedBox
      style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <CharacterAvatar
        testID={`character-manage-face-box-${slot}`}
        imageTestID={`character-manage-face-${slot}`}
        imageUrl={props.portrait.imageUrl}
        name={props.portrait.name}
        size={PORTRAIT_HEADER.faceSize}
      />
    </AnimatedBox>
  )
}

export function CharacterManageButton(props: {
  /** 돌릴 얼굴들. 빈 배열이면 사람 아이콘이 선다. */
  portraits: readonly HeaderPortraitView[]
}): React.JSX.Element {
  const navigation = useScreenNavigation()
  const mode = useThemeMode()
  const slots = props.portraits.length

  // 움직임 줄이기면 진행률이 `from` 에 머문다. 그 값에서 첫 얼굴이 가운데 서고 나머지는 불투명도가
  // 0 이라, 애니메이션을 끄는 갈래를 따로 둘 필요가 없다. 얼굴이 하나뿐일 때도 같다(`loopTo`).
  const progress = useLoopedValue({
    from: 0,
    to: loopTo(slots),
    durationMs: headerLoopMs(slots),
    easing: Easing.linear,
  })

  return (
    <Pressable
      role="button"
      // 원 안에 글자가 없다. 이 이름이 무엇이 열리는지 말하는 유일한 자리다.
      aria-label="캐릭터 관리"
      // 화면이 바뀌는 이동이라 두드림을 낸다.
      onPress={() => {
        tapFeedback()
        navigation.navigate('SettingsCharacters')
      }}
      /*
       * 오른쪽 8 은 헤더가 쥔 `px-4` 위에 이 버튼만 더 미는 값이다(사용자 지시). 원이 화면
       * 가장자리에 붙어 보이던 것을 떼어 놓는다. 다른 탭 화면의 세그먼트보다 그만큼 안쪽이다.
       *
       * 클래스(`mr-2`)로 쓰지 말 것. 이 저장소에서 아무도 안 쓰던 유틸리티라, NativeWind 가 CSS 를
       * 서버가 뜰 때 한 번 컴파일하고 그 결과를 계속 돌려주는 탓에 **여백이 조용히 0 이 된다**
       * (Metro 를 다시 띄워야 나온다). 값으로 적으면 그 함정이 없다.
       */
      style={{
        width: PORTRAIT_HEADER.slot,
        height: PORTRAIT_HEADER.slot,
        marginRight: 8,
        backgroundColor: CIRCLE_BACKGROUND[mode],
        borderWidth: CIRCLE_BORDER_PX,
      }}
      /*
       * `overflow-hidden` 은 얼굴이 오르내리며 테두리를 넘기 때문이다. 안 자르면 둥근 틀 밖에
       * 얼굴 조각이 뜬다.
       *
       * 테두리 색은 **테마 컬러**이고 두께는 `CIRCLE_BORDER_PX` 다(사용자 지시). 알파가 아니라
       * 굵기로 낸다.
       * 반투명하게 깔면 얼굴 그림 위에서 색이 섞여 탁해지고, 테마마다 원색의 밝기가 달라 다크에서
       * 선이 사라지는 테마가 생긴다. 레일 칸의 링도 같은 토큰으로 초상화를 두른다
       * (`CharacterPortrait` 의 `EmptyRing`).
       */
      className="shrink-0 items-center justify-center overflow-hidden rounded-full border-primary"
    >
      {props.portraits.map((portrait, slot) => (
        <DrumFace
          key={portrait.ocid}
          portrait={portrait}
          slot={slot}
          slots={slots}
          progress={progress}
        />
      ))}

      {/* 빈 원이나 지어낸 얼굴을 세우지 않는다. 추적이 없는 첫 실행에서도 문은 열려 있어야 한다.
          아이콘에 `testID` 를 직접 주지 않는 것은 그것이 SVG 부품이라 프롭이 어디까지 내려가는지가
          이 파일의 약속이 아니기 때문이다.

          24 인 것은 원이 40 이기 때문이다. 20 은 그 안에서 헐거웠다. */}
      {slots === 0 && (
        <View testID="character-manage-fallback">
          <CircleUserRoundIcon className="h-6 w-6 text-text-muted" strokeWidth={2} aria-hidden />
        </View>
      )}
    </Pressable>
  )
}
