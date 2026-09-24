/**
 * 화면 하단에서 올라오는 시트. `@gorhom/bottom-sheet` 을 감싼 껍데기.
 *
 * 여는 법은 조건부 마운트. 마운트하면 열리고 `onClose` 를 받아 언마운트하면 닫힌다. `onClose` 는
 * 이탈 애니메이션이 끝난 뒤에 온다. 스크림을 누르거나 아래로 끌어도 닫힌다.
 *
 * 높이는 내용이 정하고 화면의 82% 가 상한. 키보드가 뜨면 그 높이만큼 상한이 준다(시트와 키보드를
 * 합쳐 82% 다). 폭은 448 중앙 정렬. 스크롤은 이 껍데기가 갖는다.
 *
 * `header` 와 `footer` 를 주면 그 둘은 스크롤 밖에 고정된다. 라이브러리가 시트 키를 스크롤
 * **내용** 높이로 정하므로 둘의 높이만큼을 스크롤 내용의 여백이 비워 준다. 그래서 바닥 줄을
 * 세우면 시트가 그 높이만큼 짧아지고, 키보드가 떠도 그 줄은 언제나 보인다.
 *
 * 전제로 앱 셸에 `BottomSheetModalProvider` 와 `GestureHandlerRootView` 가 있어야 뜬다.
 *
 * @example
 * {열림 ? <BottomSheet label="수입 기록" onClose={() => setState(null)}>{내용}</BottomSheet> : null}
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  useBottomSheetTimingConfigs,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'

import { vars } from 'nativewind'

import { BlurView } from 'expo-blur'

import { useBlurTint, useThemeAppearance } from '../../../theme/context'
import { buildSheetScopeVariables } from '../../../theme/theme-vars'

import { nextScrimOpacity } from './scrim-opacity'
import { useStepDissolve } from './step-dissolve'

/**
 * 시트가 위로 갈 수 있는 끝. **상단 안전영역 바로 아래까지**다(사용자 지정 2026-09-24).
 *
 * 전에는 화면 높이의 0.82 였다. 비율은 화면이 높을 때는 남는 18% 가 숨돌림이 되지만, 화면이
 * 낮아지면 **그 18% 가 내용에서 먼저 깎인다.** 360×640dp 에서 0.82 는 525dp 이고 그중 저장 줄과
 * 머리를 빼면 스크롤에 남는 것이 400dp 안팎이다. 같은 화면에서 안전영역만 피하면 609dp 라
 * 84dp 가 돌아온다.
 *
 * 화면 높이에 비례하지 않는 것이 요점이다. 피해야 하는 것은 **노치와 상태바**이지 화면의 몇
 * 퍼센트가 아니다.
 */
function maxSheetHeight(frameHeight: number, topInset: number): number {
  return frameHeight - topInset
}
/** 시트 최대 너비. 넘으면 중앙 정렬로 남는다. */
const MAX_WIDTH = 448
/** 그랩 핸들이 차지하는 높이. 스크롤 내용의 `paddingTop` 이 이 값을 되돌려 준다. */
const HANDLE_HEIGHT = 24
/** 시트 위 모서리. 머리 층도 같은 값을 써야 덧댄 판으로 안 보인다. */
const SHEET_RADIUS = 20
/**
 * 단계가 갈려 자리를 옮기는 시간.
 *
 * 키보드에 맞추던 시절의 250ms 를 그대로 쓰면 시트가 휙 바뀐다(사용자 지적). 그 아래로
 * 내려가지 않는 것이 이 값의 하한이다. 곡선은 `exp` 가 아니라 `cubic` 이다. `exp` 는 진행도를
 * 앞쪽에 몰아 툭 하고 끝난다.
 */
const MOVE_MS = 380
/**
 * 겹치는 층의 순서. 같은 자리에 포개져 서므로 이 수가 무엇이 위인지를 정한다.
 *
 * 핸들이 맨 위다. 머리가 핸들 자리를 덮는 데다 뒤에 그려져서, 층이 같으면 핸들이 안 보인다.
 */
const HEADER_LAYER = 1
/** 바닥 줄 층. 머리보다 위다 - 짧은 시트에서 둘이 만나면 바닥 줄이 이긴다. */
const FOOTER_LAYER = 2
const HANDLE_LAYER = 3
/** 갈아 드는 흐림. 머리도 함께 흐려져야 하므로 둘보다 위다. */
const VEIL_LAYER = 4

/**
 * 머리가 **재기 전에 잡아 두는 키**. 첫 프레임에 0 으로 두면 안 된다.
 *
 * 라이브러리는 시트의 키를 스크롤 **내용**에서 재는데, 그 내용의 여백이 이 값들에서 나온다.
 * 0 으로 시작하면 시트가 **두 번 움직인다**. 먼저 그만큼 작아졌다가, 잰 값이 도착하면 다시
 * 커진다. 화면에서는 내용과 버튼이 따로 노는 것으로 보인다(사용자 지적, 60fps 프레임에서 확인).
 *
 * 잰 값이 오면 그것으로 갈아탄다. 여기 값은 **첫 프레임 한 번만** 쓰인다.
 */
const HEADER_GUESS = HANDLE_HEIGHT + 8 + 28
/**
 * 바닥 줄의 첫 프레임 추정 높이. 재기 전에도 스크롤이 그만큼을 비워 둬야 마지막 줄이 안 가린다.
 *
 * 버튼 44 + 위 여백 12 + 아래 여백 16. 인셋은 줄이 자기 안에서 지므로 여기 없다.
 */
const FOOTER_GUESS = 44 + 12 + 16

/** 가장 짙을 때의 흐림. `BlurView` 의 세기는 1~100 이다. */
const STEP_BLUR = 72
/**
 * 얹힌 흐림이 걷히는 데 걸리는 시간.
 *
 * **시트가 옮겨 앉는 시간(`MOVE_MS`)과 별개다.** 이 값만 줄이면 흐림이 먼저 걷히고 시트는
 * 제 속도로 앉는다(사용자 지시).
 *
 * 아래로는 한계가 있다. 흐림은 움직임이 아니라 되찾는 초점이라, 너무 짧으면 깜빡인 것으로만
 * 읽히고 무엇이 흐려졌었는지가 안 남는다.
 */
const STEP_MS = 300

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
const AnimatedVeil = Animated.createAnimatedComponent(BlurView)

/**
 * 시트 뒤를 덮고 누르면 닫는 스크림. 페이드까지 직접 보간하는 부품.
 *
 * 라이브러리 `BottomSheetBackdrop` 을 안 쓴다. 스냅 포인트가 하나뿐인 이 배치에서는 그쪽 보간
 * 구간이 퇴화해 불투명도가 0 으로 굳는다. 인덱스가 -1(닫힘)과 0(열림) 둘뿐이라 `index + 1` 을
 * 0~1 로 자르면 같은 그림이 나온다.
 *
 * 다만 그 인덱스를 **그대로 받지는 않는다**. 짙기는 `scrim-opacity` 의 규칙을 거친다.
 */
function SheetScrim(props: {
  animatedIndex: SharedValue<number>
  animatedPosition: SharedValue<number>
  style: BottomSheetBackdropProps['style']
  color: string
  onPress: () => void
}): React.JSX.Element {
  /** 지금 그리고 있는 짙기. 다음 프레임이 이것과 견줘 옅어질지 정한다. */
  const shown = useSharedValue(0)
  /** 직전 프레임의 시트 자리. 시트가 내려갔나를 이것으로 본다. */
  const lastPosition = useSharedValue(Number.POSITIVE_INFINITY)

  const animatedStyle = useAnimatedStyle(() => {
    const position = props.animatedPosition.get()
    const opacity = nextScrimOpacity(
      props.animatedIndex.get(),
      position,
      shown.get(),
      lastPosition.get(),
    )
    shown.set(opacity)
    lastPosition.set(position)
    return { opacity }
  })

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="닫기"
      onPress={props.onPress}
      style={[props.style, { backgroundColor: props.color }, animatedStyle]}
    />
  )
}

interface BottomSheetProps {
  onClose: () => void
  children: ReactNode
  /**
   * 스크린리더가 읽는 시트 이름. 화면에는 안 나온다.
   *
   * 기본값이 없다. 주면 다음 시트가 그것을 물려받아, 껍데기가 이름을 하나로 갖고 있던 자리로
   * 돌아온다. 시트 넷이 전부 `드롭 아이템 기록` 으로 읽히던 상태였다.
   */
  label: string
  testId?: string
  /**
   * 바뀌면 스크롤을 맨 위로 되돌리는 키. 시트 안에서 내용이 통째로 갈리는 자리에 쓴다(지출 시트의
   * 갈래 전환). 안 넘기면 아무 일도 안 한다.
   */
  resetScrollKey?: string | number
  /**
   * 스크롤 위에 고정되는 줄. 제목과 날짜가 여기 산다. 시트 모서리와 같게 둥글다.
   */
  header?: ReactNode
  /** 스크롤 내용의 마지막 줄. 저장 버튼이 여기 산다. */
  footer?: ReactNode
  /**
   * 지금 어느 단계인가. 이 값이 바뀌면 **시트 전체가 흐려졌다 돌아온다**.
   *
   * 머리·내용·바닥 줄이 한꺼번에 갈리므로 내용만 갈아 드는 것으로는 제목이 튄다. 안 주면
   * 아무 일도 안 한다.
   */
  stepKey?: string
}

/**
 * 갈아 드는 흐림 한 겹.
 *
 * **흐림이 짙어진 뒤에 마운트된다.** 리애니메이티드는 `useAnimatedProps` 를 처음 부른 그 순간의
 * 값을 첫 프레임에 쓰고(`initial.value`), 그 값이 인라인 프롭보다 세다. 그래서 이 훅이 시트에
 * 살면 흐림 층이 붙는 첫 프레임이 세기 0 으로 그려져 **새 화면이 또렷하게 한 장 번쩍인다**
 * (60fps 녹화에서 확인). 층과 훅을 함께 여기 두면 훅의 첫 호출이 곧 마운트라, 그때 이미 1 인
 * 값을 첫 프레임이 받는다.
 */
function StepVeil(props: { onDone: () => void }): React.JSX.Element {
  /**
   * 재질은 **앱 테마가 고른다**. 기본값 `'default'` 는 OS 외형을 따라가 다크 OS 에서 검게 깔린다
   * (라이트 테마 시트가 통째로 어두워졌다).
   */
  const tint = useBlurTint()
  /**
   * 1 로 시작해 0 으로 걷힌다.
   *
   * **여기서 만드는 것이 계약이다.** 리애니메이티드는 `useAnimatedProps` 를 처음 부른 그 순간의
   * 값을 첫 프레임에 쓰고(`initial.value`), 그 값이 인라인 프롭보다 세다. 값이 시트에 살면 흐림
   * 층이 붙는 첫 프레임을 세기 0 으로 그려 **새 화면이 또렷하게 한 장 번쩍인다**(60fps 녹화에서
   * 확인). 값과 층이 함께 여기 있으면 그 첫 프레임이 이미 1 이다.
   */
  const progress = useSharedValue(1)
  const veil = useAnimatedProps(() => ({ intensity: STEP_BLUR * progress.get() }))

  const { onDone } = props
  useEffect(() => {
    progress.set(
      withTiming(0, { duration: STEP_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        // 중간에 갈아탔으면 층이 통째로 새로 서므로 여기서 걷었다고 말하지 않는다.
        if (finished === true) runOnJS(onDone)()
      }),
    )
  }, [progress, onDone])

  return (
    <View
      testID="bottom-sheet-veil"
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      /*
        **시트와 같은 모서리로 자른다.** 흐림 층은 네모라 그냥 얹으면 둥근 위 모서리 자리에
        각진 모서리가 생겼다 사라진다(사용자 지적). 자르는 것은 바깥 상자가 한다.
        `BlurView` 자신에게 반경을 주면 iOS 의 시각 효과 뷰가 그것을 안 따른다.
      */
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: VEIL_LAYER,
        borderTopLeftRadius: SHEET_RADIUS,
        borderTopRightRadius: SHEET_RADIUS,
        overflow: 'hidden',
      }}
    >
      <AnimatedVeil
        testID="bottom-sheet-veil-blur"
        animatedProps={veil}
        // 색을 따로 안 얹는다. 시트 표면 위라 얹으면 바탕이 함께 물든다.
        tint={tint}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </View>
  )
}

export function BottomSheet(props: BottomSheetProps): React.JSX.Element {
  const ref = useRef<BottomSheetModal>(null)
  const step = useStepDissolve(props.stepKey)
  const move = useBottomSheetTimingConfigs({ duration: MOVE_MS, easing: Easing.out(Easing.cubic) })
  const scrollRef = useRef<{ scrollTo?: (options: { y: number; animated: boolean }) => void }>(null)
  const insets = useSafeAreaInsets()
  const frame = useSafeAreaFrame()
  const { definition } = useThemeAppearance()
  /** 시트 안에서만 표면 계열을 한 칸 올린 변수 묶음. 껍데기 색과 내용 스코프가 여기서 함께 나온다. */
  const sheetScope = buildSheetScopeVariables(definition)
  const sheetSurface = sheetScope['--color-bg']!

  /** 고정된 머리가 차지한 높이. 흐름 밖이라 스크롤 내용의 `paddingTop` 이 이만큼을 되돌려 준다. */
  const [headerHeight, setHeaderHeight] = useState(0)
  const [footerHeight, setFooterHeight] = useState(0)

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false })
  }, [props.resetScrollKey])

  // 마운트가 곧 열림이다.
  useEffect(() => {
    ref.current?.present()
  }, [])

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <SheetScrim
        animatedIndex={backdropProps.animatedIndex}
        animatedPosition={backdropProps.animatedPosition}
        style={backdropProps.style}
        color={definition.scrim}
        onPress={() => ref.current?.dismiss()}
      />
    ),
    [definition.scrim],
  )

  return (
    <BottomSheetModal
      ref={ref}
      handleComponent={null}
      onDismiss={props.onClose}
      enablePanDownToClose
      enableDynamicSizing
      // `adjustResize` 로 바꾸지 말 것. 이 앱은 edge-to-edge 라 키보드가 떠도 창이 안 줄어드는데,
      // 그 값을 받으면 라이브러리가 OS 가 이미 올린 줄 알고 보정을 0 으로 두고 빠져나간다.
      /*
        끌어올림 저항을 0 으로 둔다. 두 가지가 함께 걸린다.

        ① 라이브러리는 시트 아래에 저항용 여유를 패딩으로 깔아 두는데, 그 값이 **시트가 선
        자리를 재료로 쓴다**. 그래서 시트가 미끄러지는 동안 내용 상자의 목표 높이가 매 프레임
        바뀌고, 그 상자의 애니메이션이 매번 다시 시작돼 시트보다 느리게 자란다. 상자 바닥에 선
        저장 줄이 열릴 때 위로 뛰었다가 가라앉는 것이 그것이다. 0 이면 목표가 고정이라 상자와
        시트가 같은 곡선으로 움직여 저장 줄이 화면 바닥에 붙은 채로 올라온다.

        ② 저항이 0 이면 위로 끌어도 안 늘어난다. 스냅 포인트가 하나뿐인 시트라 늘어날 자리가
        애초에 없다. 아래로 끌어 닫는 길은 그대로다.
      */
      overDragResistanceFactor={0}
      maxDynamicContentSize={maxSheetHeight(frame.height, insets.top)}
      animationConfigs={move}
      backdropComponent={renderBackdrop}
      accessibilityLabel={props.label}
      style={{ maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center' }}
      backgroundStyle={{
        backgroundColor: sheetSurface,
        borderTopLeftRadius: SHEET_RADIUS,
        borderTopRightRadius: SHEET_RADIUS,
      }}
    >
      {/*
        그랩 핸들. 라이브러리 기본 핸들도 `handleComponent` 슬롯도 안 그려져서 첫 자식으로 직접 놓는다.
        핸들을 잡고 끄는 제스처는 없고 내용을 끌어 닫는 경로만 남는다.

        흐름에서 빼 놓을 것(`position: absolute`). `handleComponent={null}` 이라 라이브러리는 핸들
        높이를 0 으로 보고 스크롤 내용만 재는데, 흐름 안에 두면 그 위에 24pt 가 더 얹혀 딱 그만큼
        넘친다. 뺀 몫은 아래 `paddingTop` 이 되돌려 준다.

        층은 셋 중 맨 위다. 머리도 같은 자리를 절대 배치로 덮는데, 그쪽이 뒤에 그려지므로 층이
        같으면 핸들이 머리 밑에 깔려 안 보인다.
      */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HANDLE_HEIGHT,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: HANDLE_LAYER,
        }}
      >
        <View
          testID="bottom-sheet-handle"
          style={{ height: 4, width: 36, borderRadius: 2, backgroundColor: definition.borderStrong }}
        />
      </View>

      {props.header !== undefined && (
        // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
        <View
          testID="bottom-sheet-header"
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
          style={{
            position: 'absolute',
            // 핸들 띠까지 덮는다. 아래에서 시작하면 그 위로 스크롤 내용이 비쳐 보인다.
            top: 0,
            left: 0,
            right: 0,
            zIndex: HEADER_LAYER,
            backgroundColor: sheetSurface,
            // 시트 모서리와 같은 값. 다르면 머리가 시트 위에 덧댄 판으로 보인다.
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            paddingTop: HANDLE_HEIGHT,
            paddingHorizontal: 16,
            // 아래로 8. 이 몫까지 머리가 칠해야 스크롤 내용이 그 틈으로 비치지 않는다.
            paddingBottom: 8,
          }}
        >
          <View style={vars(sheetScope)}>{props.header}</View>
        </View>
      )}

      <BottomSheetScrollView
        ref={scrollRef as never}
        testID={props.testId}
        contentContainerStyle={{
          // 잰 머리 높이에 핸들 몫과 아래 여백이 이미 들어 있다. 두 번 더하지 않는다.
          paddingTop:
            props.header === undefined
              ? HANDLE_HEIGHT + 8
              : headerHeight > 0
                ? headerHeight
                : HEADER_GUESS,
          /*
            바닥 줄이 흐름 밖에 서므로 그 자리를 비워 둔다. 라이브러리는 시트 키를 스크롤
            **내용** 높이 하나로 정하므로, 이 몫이 곧 바닥 줄이 설 자리다. 안 비우면 마지막
            줄이 줄 뒤로 들어간다.

            인셋은 여기 없다. 바닥 줄이 자기 안에서 진다(줄이 화면 맨 아래에 붙으므로).
          */
          paddingBottom:
            props.footer === undefined
              ? insets.bottom + 16
              : footerHeight > 0
                ? footerHeight
                : FOOTER_GUESS,
        }}
      >
        {/*
          시트 스코프. `vars()` 를 얹은 `View` 서브트리만 새 표면 기준을 쓴다. 스크롤 뷰가 아니라
          그 안인 것은 `vars()` 가 css-interop 이 아는 요소여야 닿기 때문이다.
        */}
        <View style={vars(sheetScope)}>{props.children}</View>

      </BottomSheetScrollView>

      {props.footer !== undefined && (
        /*
          바닥 줄은 **스크롤 밖**이다. 시트 상자에 `bottom: 0` 으로 붙으므로 상자가 움직이면
          같은 곡선으로 함께 미끄러진다. 그 몫을 따로 애니메이션하면 줄이 상자보다 앞서 도착해
          단계를 오갈 때 빈 띠가 보인다([[ADR-241]] 정정 6 에서 실제로 그렇게 났다).

          `pointerEvents="box-none"` 이 필수다. 층은 줄 높이만큼만 크지만 자기 상자로 터치를
          먹으면 바로 위 내용이 안 눌린다.
        */
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: FOOTER_LAYER }}
        >
          <View
            testID="bottom-sheet-footer"
            onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
            style={{
              backgroundColor: sheetSurface,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View style={vars(sheetScope)}>{props.footer}</View>
          </View>
        </View>
      )}

      {/* 갈아 드는 흐림. 머리·내용·바닥 줄을 통째로 덮으므로 층 셋보다 위다. */}
      {step.busy && <StepVeil key={step.turn} onDone={step.done} />}
    </BottomSheetModal>
  )
}
