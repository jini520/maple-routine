/**
 * 화면 하단에서 올라오는 시트. `@gorhom/bottom-sheet` 을 감싼 껍데기.
 *
 * 여는 법은 조건부 마운트. 마운트하면 열리고 `onClose` 를 받아 언마운트하면 닫힌다. `onClose` 는
 * 이탈 애니메이션이 끝난 뒤에 온다. 스크림을 누르거나 아래로 끌어도 닫힌다.
 *
 * 높이는 내용이 정하고 화면의 82% 가 상한. 키보드가 뜨면 그 높이만큼 상한이 준다(시트와 키보드를
 * 합쳐 82% 다). 폭은 448 중앙 정렬. 스크롤은 이 껍데기가 갖는다.
 *
 * 전제로 앱 셸에 `BottomSheetModalProvider` 와 `GestureHandlerRootView` 가 있어야 뜬다.
 *
 * @example
 * {열림 ? <BottomSheet label="수입 기록" onClose={() => setState(null)}>{내용}</BottomSheet> : null}
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Keyboard, Platform, Pressable, View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
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
/** 머리와 바닥을 안 잰 동안 쓰는 값. 실제 높이는 `onLayout` 이 덮는다. */
const UNMEASURED = 0

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

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
   * 스크롤을 안 타고 위에 고정되는 줄. 제목과 날짜가 여기 산다.
   *
   * 형제로 두지 않고 흐름 밖에 그린다. 라이브러리가 **스크롤 내용만 재서** 시트 높이를 정하므로
   * 형제의 높이는 그 계산에서 빠진다. 뺀 몫은 내용의 `paddingTop` 이 되돌려 준다(핸들과 같다).
   */
  header?: ReactNode
  /**
   * 스크롤을 안 타고 바닥에 고정되는 줄. 저장 버튼이 여기 산다.
   *
   * 라이브러리의 `footerComponent` 로 넘긴다. 그쪽 `BottomSheetFooter` 가 **키보드가 떠 있으면
   * 아래 인셋을 안 뺀다**. 그 규칙을 두 벌로 만들지 않는다.
   */
  footer?: ReactNode
  /**
   * 열자마자 스크롤을 맨 아래로 보낸다. 치는 칸이 아래에 몰린 시트가 그렇다.
   *
   * 키보드를 부르는 칸이 아래에 있으면 잘려야 할 것은 언제나 위쪽이다.
   */
  startAtBottom?: boolean
}

export function BottomSheet(props: BottomSheetProps): React.JSX.Element {
  const ref = useRef<BottomSheetModal>(null)
  const scrollRef = useRef<{
    scrollTo?: (options: { y: number; animated: boolean }) => void
    scrollToEnd?: (options: { animated: boolean }) => void
  }>(null)
  const insets = useSafeAreaInsets()
  const frame = useSafeAreaFrame()
  const { definition } = useThemeAppearance()
  /** 시트 안에서만 표면 계열을 한 칸 올린 변수 묶음. 껍데기 색과 내용 스코프가 여기서 함께 나온다. */
  const sheetScope = buildSheetScopeVariables(definition)
  const sheetSurface = sheetScope['--color-bg']!

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
  /** 머리와 바닥이 실제로 차지한 높이. 내용의 위아래 여백이 이 값을 되돌려 준다. */
  const [headerHeight, setHeaderHeight] = useState(UNMEASURED)
  const [footerHeight, setFooterHeight] = useState(UNMEASURED)

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

  /**
   * 아래에서 시작하는 시트. 내용이 자란 뒤에 한 번 더 보내야 실제로 끝에 닿는다.
   *
   * 키보드가 떠서 뷰포트가 줄어드는 것도 내용이 자라는 것과 같은 일이라 그 값도 계기로 둔다.
   */
  useEffect(() => {
    if (props.startAtBottom !== true) return
    scrollRef.current?.scrollToEnd?.({ animated: false })
  }, [props.startAtBottom, keyboardHeight, footerHeight])

  /**
   * `useCallback` 으로 안 감싼다. React 컴파일러가 지킬 수 없는 수동 메모이제이션으로 보고
   * 이 컴포넌트의 최적화를 통째로 건너뛴다(lint 가 막는다).
   */
  function renderFooter(footerProps: BottomSheetFooterProps): React.JSX.Element {
    return (
      <BottomSheetFooter {...footerProps}>
        <View
          testID="bottom-sheet-footer"
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          style={{ backgroundColor: sheetSurface, paddingHorizontal: 16, paddingBottom: 16 }}
        >
          {props.footer}
        </View>
      </BottomSheetFooter>
    )
  }

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
      footerComponent={props.footer === undefined ? undefined : renderFooter}
      accessibilityLabel={props.label}
      style={{ maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center' }}
      backgroundStyle={{
        backgroundColor: sheetSurface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
    >
      {/*
        그랩 핸들. 라이브러리 기본 핸들도 `handleComponent` 슬롯도 안 그려져서 첫 자식으로 직접 놓는다.
        핸들을 잡고 끄는 제스처는 없고 내용을 끌어 닫는 경로만 남는다.

        흐름에서 빼 놓을 것(`position: absolute`). `handleComponent={null}` 이라 라이브러리는 핸들
        높이를 0 으로 보고 스크롤 내용만 재는데, 흐름 안에 두면 그 위에 24pt 가 더 얹혀 딱 그만큼
        넘친다. 뺀 몫은 아래 `paddingTop` 이 되돌려 준다.
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
          zIndex: 1,
        }}
      >
        <View
          testID="bottom-sheet-handle"
          style={{ height: 4, width: 36, borderRadius: 2, backgroundColor: definition.borderStrong }}
        />
      </View>

      {/*
        고정 머리. 핸들과 같은 방식으로 흐름 밖에 그린다. 바탕을 칠하는 것은 스크롤 내용이
        이 아래로 지나가기 때문이다.
      */}
      {props.header !== undefined && (
        <View
          testID="bottom-sheet-header"
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
          style={{
            position: 'absolute',
            top: HANDLE_HEIGHT,
            left: 0,
            right: 0,
            zIndex: 1,
            backgroundColor: sheetSurface,
            paddingHorizontal: 16,
          }}
        >
          <View style={vars(sheetScope)}>{props.header}</View>
        </View>
      )}

      <BottomSheetScrollView
        ref={scrollRef as never}
        testID={props.testId}
        contentContainerStyle={{
          paddingTop: HANDLE_HEIGHT + 8 + headerHeight,
          // 키보드가 떠 있으면 인셋만 걷고 숨돌림 16 은 남긴다. 바닥이 있으면 그것이 가리는
          // 만큼도 함께 되돌려 준다(그쪽은 자기 인셋을 스스로 진다).
          paddingBottom: (keyboardHeight > 0 ? 0 : insets.bottom) + 16 + footerHeight,
        }}
      >
        {/*
          시트 스코프. `vars()` 를 얹은 `View` 서브트리만 새 표면 기준을 쓴다. 스크롤 뷰가 아니라
          그 안인 것은 `vars()` 가 css-interop 이 아는 요소여야 닿기 때문이다.
        */}
        <View style={vars(sheetScope)}>{props.children}</View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}
