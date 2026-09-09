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
import { Keyboard, Platform, Pressable, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  useBottomSheetInternal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'

import { vars } from 'nativewind'

import { useThemeAppearance } from '../../../theme/context'
import { buildSheetScopeVariables } from '../../../theme/theme-vars'

/** 시트 최대 높이의 비율. 화면 높이 × 이 값. */
const MAX_HEIGHT_RATIO = 0.82
/** 시트 최대 너비. 넘으면 중앙 정렬로 남는다. */
const MAX_WIDTH = 448
/** 그랩 핸들이 차지하는 높이. 스크롤 내용의 `paddingTop` 이 이 값을 되돌려 준다. */
const HANDLE_HEIGHT = 24
/** 시트 위 모서리. 머리 층도 같은 값을 써야 덧댄 판으로 안 보인다. */
const SHEET_RADIUS = 20
/**
 * 스크롤을 끝으로 보낼 때 주는 y. 스크롤 뷰가 알아서 끝에서 멈춘다.
 *
 * `scrollToEnd` 를 안 쓰는 것은 `BottomSheetScrollView` 의 ref 에 그 메서드가 없어서다.
 */
const MAX_SCROLL = 99999
/**
 * 겹치는 층 셋의 순서. 넷 다 같은 상자 안에 절대 배치로 서므로 이 수가 무엇이 위인지를 정한다.
 *
 * 핸들이 맨 위다. 머리가 핸들 자리를 덮는 데다 뒤에 그려져서, 층이 같으면 핸들이 안 보인다.
 */
const HEADER_LAYER = 1
const FOOTER_LAYER = 2
const HANDLE_LAYER = 3

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
/**
 * 애니메이션이 붙는 상자. `Animated.View` 를 그대로 쓰면 안 된다.
 *
 * 앱이 `lib/nativewind-interop` 에서 `Animated.View` 를 NativeWind 에 등록해 두는데, 그러면
 * `style` 이 그쪽 처리를 한 번 거치면서 리애니메이티드가 넘긴 스타일이 붙지 않는다. 화면에서는
 * 상자가 통째로 안 그려지는 것으로 보인다.
 */
const AnimatedBox = Animated.createAnimatedComponent(View)

/**
 * 스크롤 위에 겹쳐 서는 바닥 층. 저장 버튼이 여기 산다.
 *
 * 자리는 **시트 컨테이너 기준**으로 위에서부터 잰다. 시트 안에서 `bottom: 0` 을 잡으면 안 된다.
 * 라이브러리가 시트 아래에 끌어내림 저항용 여유와 키보드 몫을 패딩으로 깔아 두는데, 그 패딩
 * 바깥이 기준이 되어 화면 밖으로 내려간다.
 *
 * 공유값은 **지역 상수로 꺼내 쓸 것**. `internal.animatedPosition.get()` 처럼 객체를 타고
 * 들어가면 리애니메이티드가 클로저에서 그 공유값을 못 찾아 구독을 안 건다. 그러면 첫 값으로
 * 굳어 바닥 줄이 화면 밖에 머문다(2026-09-09 시뮬레이터에서 확인).
 */
function SheetFooterLayer(props: {
  /** 떠 있는 키보드 높이. 이만큼 위로 올라선다. */
  keyboardHeight: number
  /** 잰 높이를 위로 올린다. 스크롤이 그만큼을 자리로 비워야 시트가 그만큼 자란다. */
  onHeight: (height: number) => void
  children: ReactNode
}): React.JSX.Element {
  const internal = useBottomSheetInternal(true)
  const layout = internal?.animatedLayoutState
  const position = internal?.animatedPosition
  const ownHeight = useSharedValue(0)
  const keyboardHeight = props.keyboardHeight

  const placement = useAnimatedStyle(() => {
    if (layout === undefined || position === undefined) return { transform: [{ translateY: 0 }] }
    const { containerHeight, handleHeight } = layout.get()
    const bottom = Math.max(0, containerHeight - position.get()) - keyboardHeight
    return {
      transform: [
        { translateY: Math.max(0, bottom - ownHeight.get() - Math.max(0, handleHeight)) },
      ],
    }
  })

  return (
    <AnimatedBox
      onLayout={(event) => {
        ownHeight.set(event.nativeEvent.layout.height)
        props.onHeight(event.nativeEvent.layout.height)
      }}
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: FOOTER_LAYER }, placement]}
    >
      {props.children}
    </AnimatedBox>
  )
}

/**
 * 시트 뒤를 덮고 누르면 닫는 스크림. 페이드까지 직접 보간하는 부품.
 *
 * 라이브러리 `BottomSheetBackdrop` 을 안 쓴다. 스냅 포인트가 하나뿐인 이 배치에서는 그쪽 보간
 * 구간이 퇴화해 불투명도가 0 으로 굳는다. 인덱스가 -1(닫힘)과 0(열림) 둘뿐이라 `index + 1` 을
 * 0~1 로 자르면 같은 그림이 나온다.
 */
function SheetScrim(props: {
  animatedIndex: SharedValue<number>
  style: BottomSheetBackdropProps['style']
  color: string
  onPress: () => void
}): React.JSX.Element {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(props.animatedIndex.value + 1, 0), 1),
  }))

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
  /**
   * 스크롤 아래에 고정되는 줄. 저장 버튼이 여기 산다.
   *
   * **이 줄의 높이만큼 스크롤이 줄어든다.** 그래서 시트가 그만큼 짧아지고, 키보드가 떠도 이
   * 줄은 언제나 보인다.
   */
  footer?: ReactNode
  /**
   * 키보드가 뜨면 스크롤을 끝으로 보낼지. 치는 칸이 **맨 아래에 모여 있는** 시트만 켠다.
   *
   * 키보드가 뜨는 순간 보여야 할 것이 아래쪽이고, 위에서 잘리는 것은 이미 정해 놓은 값들이다.
   * 치는 칸이 중간에 있는 시트에서 켜면 반대로 그 칸이 위로 밀려 나간다.
   */
  scrollToEndOnKeyboard?: boolean
}

export function BottomSheet(props: BottomSheetProps): React.JSX.Element {
  const ref = useRef<BottomSheetModal>(null)
  const scrollRef = useRef<{ scrollTo?: (options: { y: number; animated: boolean }) => void }>(null)
  const insets = useSafeAreaInsets()
  const frame = useSafeAreaFrame()
  const { definition } = useThemeAppearance()
  /** 시트 안에서만 표면 계열을 한 칸 올린 변수 묶음. 껍데기 색과 내용 스코프가 여기서 함께 나온다. */
  const sheetScope = buildSheetScopeVariables(definition)
  const sheetSurface = sheetScope['--color-bg']!

  /** 고정된 머리가 차지한 높이. 흐름 밖이라 스크롤 내용의 `paddingTop` 이 이만큼을 되돌려 준다. */
  const [headerHeight, setHeaderHeight] = useState(0)
  /** 고정된 바닥 줄의 높이. 스크롤 내용의 `paddingBottom` 이 이만큼을 자리로 비운다. */
  const [footerHeight, setFooterHeight] = useState(0)

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false })
  }, [props.resetScrollKey])

  // 마운트가 곧 열림이다.
  useEffect(() => {
    ref.current?.present()
  }, [])

  /**
   * 떠 있는 키보드의 높이. 0 이면 안 떠 있다.
   *
   * 두 곳이 쓴다. 상한에서 이만큼을 빼고(윗변이 한 선에 선다) 아래 `paddingBottom` 이 인셋을
   * 걷을지 정한다. 떴나와 얼마나가 같은 이벤트에서 오는 같은 사실이라 상태를 하나로 둔다.
   *
   * 라이브러리의 키보드 상태는 시트 안에서만 살아서 RN 이벤트를 직접 듣는다. iOS 는 `will`,
   * 안드로이드는 `did`(`will` 이 없다).
   */
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.select({ ios: 'keyboardWillShow', default: 'keyboardDidShow' }),
      (event) => setKeyboardHeight(event.endCoordinates.height),
    )
    const hide = Keyboard.addListener(
      Platform.select({ ios: 'keyboardWillHide', default: 'keyboardDidHide' }),
      () => setKeyboardHeight(0),
    )
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  const scrollToEndOnKeyboard = props.scrollToEndOnKeyboard === true
  useEffect(() => {
    if (!scrollToEndOnKeyboard || keyboardHeight === 0) return
    // 키보드가 뜨는 동안 시트 키가 줄고 스크롤 길이가 바뀐다. 그 뒤에 한 번 더 보내야 끝에 닿는다.
    scrollRef.current?.scrollTo?.({ y: MAX_SCROLL, animated: true })
    const settled = setTimeout(() => {
      scrollRef.current?.scrollTo?.({ y: MAX_SCROLL, animated: true })
    }, 350)
    return () => clearTimeout(settled)
  }, [scrollToEndOnKeyboard, keyboardHeight])

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <SheetScrim
        animatedIndex={backdropProps.animatedIndex}
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
      android_keyboardInputMode="adjustPan"
      // 기본값 `none` 이면 키보드 닫힘에서 라이브러리가 위치를 다시 안 재서 시트가 올라간 자리에
      // 남는다.
      keyboardBlurBehavior="restore"
      /*
        상한에서 키보드 높이를 뺀다. 이 앱은 edge-to-edge 라 키보드가 떠도 창이 안 줄어들고,
        시트를 올리는 것은 OS 가 아니라 라이브러리다. 올리는 방식이 시트를 통째로 미는 것이라
        상한을 그대로 두면 윗변이 82% 선보다 키보드 높이만큼 더 올라간다.
      */
      maxDynamicContentSize={frame.height * MAX_HEIGHT_RATIO - keyboardHeight}
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
          paddingTop: props.header === undefined ? HANDLE_HEIGHT + 8 : headerHeight,
          /*
            바닥 줄이 있으면 그 높이만큼을 자리로 비운다. 라이브러리가 시트 키를 스크롤 **내용**
            높이로 정하므로, 이 여백이 곧 바닥 줄이 설 자리다. 상한에 닿아 있으면 대신 스크롤이
            그만큼 줄어든다. 인셋은 바닥 줄이 자기 안에서 진다.
          */
          paddingBottom:
            props.footer === undefined
              ? (keyboardHeight > 0 ? 0 : insets.bottom) + 16
              : footerHeight,
        }}
      >
        {/*
          시트 스코프. `vars()` 를 얹은 `View` 서브트리만 새 표면 기준을 쓴다. 스크롤 뷰가 아니라
          그 안인 것은 `vars()` 가 css-interop 이 아는 요소여야 닿기 때문이다.
        */}
        <View style={vars(sheetScope)}>{props.children}</View>
      </BottomSheetScrollView>

      {props.footer !== undefined && (
        // (`&& ( … )` 안은 JS 표현식 자리라 `{/* */}` 이 아니라 `//` 다.)
        <SheetFooterLayer keyboardHeight={keyboardHeight} onHeight={setFooterHeight}>
          <View
            testID="bottom-sheet-footer"
            style={{
              backgroundColor: sheetSurface,
              paddingHorizontal: 16,
              paddingTop: 12,
              // 키보드가 덮고 있으면 홈 인디케이터 몫은 빈 띠가 된다.
              paddingBottom: (keyboardHeight > 0 ? 0 : insets.bottom) + 16,
            }}
          >
            <View style={vars(sheetScope)}>{props.footer}</View>
          </View>
        </SheetFooterLayer>
      )}
    </BottomSheetModal>
  )
}
