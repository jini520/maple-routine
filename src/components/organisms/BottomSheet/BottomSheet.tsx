// 화면 하단에서 올라오는 시트([[ADR-038]] → [[ADR-039]]).
//
// [[ADR-039]] 는 자체구현(62줄)이 못 주던 넷 — 진입·이탈 애니메이션, 속도 기반 fling, 놓을 때
// 부드러운 스냅 복귀, 마우스/터치 양쪽 드래그 — 때문에 라이브러리로 갈아탔고, **스킨과 공개
// API 는 그대로 두어 교체 비용을 시트 하나에 가뒀다**. RN 에서도 같은 판단이라 웹의 `vaul` 자리에
// `@gorhom/bottom-sheet` 을 넣는다.
//
// ── 라이브러리 기본값이 아니라 [[ADR-039]] 를 따른 자리 ──────────────────────────────
//
// · **높이**: `snapPoints` 를 주지 않고 **내용 높이 + 상한**으로 둔다(`enableDynamicSizing` +
//   `maxDynamicContentSize`). 고정 스냅 포인트가 라이브러리의 흔한 사용법이지만 [[ADR-039]] 결정 2
//   의 스킨은 `max-h-[82vh]` — *상한*이지 *높이*가 아니다.
// · **폭**: `max-w-md`(448) 중앙 정렬. 라이브러리는 전폭이 기본이다.
// · **닫힘 통보 시점**: 부모가 시트를 조건부 마운트하고 `onClose` 로 언마운트하는 패턴을 유지하되
//   ([[ADR-039]] 결정 3) 이탈 애니메이션이 끝난 뒤에 알린다 — 웹의 `onAnimationEnd(isOpen=false)`
//   자리가 여기서는 `onDismiss` 다. 마운트 시 `present()` 를 부르는 것이 웹의 `open` 초기값 `true`
//   와 같은 뜻이다.
// · **그랩 핸들·배경**: `h-1 w-9 bg-border-strong` / `rounded-t-[20px] border-t border-border bg-bg`.
//   핸들은 라이브러리 것을 **쓰지 않고 시트 첫 자식으로 직접 그린다**(사유는 아래 핸들 주석).
//   배경 라운딩은 `backgroundStyle` 이 준다.
// · **스크림**: `bg-scrim` 토큰을 **직접 그리고 페이드도 직접 보간한다.** 라이브러리 백드롭은
//   스냅 포인트가 하나인 이 배치에서 불투명도가 0 으로 굳어 아예 안 보였다 — 사유는 `SheetScrim` 주석.
//
// ── 웹의 정정 둘은 RN 에 **없는 문제**다 ───────────────────────────────────────────
//
// [[ADR-039]] 정정 1(`pointer-events-auto`)·정정 2(`data-sheet-keep-open` 가드)는 둘 다 원인이
// **Radix `dismissable-layer`** 였다 — 시트가 열린 동안 `document.body` 에 `pointer-events:none` 을
// 걸고, 시트 콘텐츠 **바깥**의 pointerdown 을 dismiss 신호로 본 것(그리고 React 포털 이벤트가 DOM
// 이 아니라 React 트리로 전파되는 성질). RN 에는 문서도 없고, 바깥 탭은 우리 스크림이 받는다
// (`onPress` → `dismiss()`). 고가 드롭 연출은 그보다 위의 **네이티브 윈도우**라
// (`DropEffectOverlay`) 탭이 시트에 닿지 않는다 — 마커도 가드도 필요 없다.
//
// ── 배선 전제 ─────────────────────────────────────────────────────────────────────
//
// `BottomSheetModal` 은 **`BottomSheetModalProvider` 아래**에서만 뜨고, 제스처는
// `GestureHandlerRootView` 안에서만 돈다. 둘 다 앱 셸이 소유한다(화면 단계). `BottomSheet`(비-모달)
// 대신 이것을 고른 이유는 인라인 시트가 **부모 상자 안**에서만 그려져 탭바를 못 덮기 때문이다 —
// 웹의 `fixed inset-x-0 bottom-0 z-[60]` 이 하던 일을 프로바이더의 호스트가 대신한다.
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet'

import { useThemeAppearance } from '../../../theme/context'

/** 시트 최대 높이 — 웹 `max-h-[82vh]`. */
const MAX_HEIGHT_RATIO = 0.82
/** 시트 최대 너비 — 웹 `max-w-md`. */
const MAX_WIDTH = 448
/** 그랩 핸들이 차지하는 높이 — 라이브러리 기본 핸들과 같은 값이라 내용 시작 위치가 그대로다. */
const HANDLE_HEIGHT = 24

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * 스크림 — **`BottomSheetBackdrop` 을 쓰지 않되, 페이드는 되살린다.**
 *
 * 라이브러리 백드롭이 안 보였던 이유는 불투명도를 `interpolate(animatedIndex, [-1,
 * disappearsOnIndex, appearsOnIndex], …)` 로 만드는데 스냅 포인트가 하나뿐인 우리 시트에서는 그
 * 입력 구간이 `[-1, -1, 0]` — **첫 구간의 폭이 0** 인 퇴화 구간이 되기 때문이다(`BottomSheet` 주석).
 *
 * 그래서 한동안 애니메이션 없이 그냥 덮었는데, 그러면 **시트가 닫히는 동안 스크림이 불투명하게
 * 남아 늦게 사라진다**(2026-08-13 실기기 보고). 페이드가 장식이 아니라 «닫히는 중»을 말해 주는
 * 신호였던 것이다.
 *
 * 보간을 직접 한다 — 스냅 포인트가 하나이므로 인덱스는 **-1(닫힘) ↔ 0(열림)** 뿐이고, 그 사이를
 * 잇는 식은 `index + 1` 을 0~1 로 자르는 것이 전부다. `interpolate` 를 안 쓰니 퇴화 구간도 없다.
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
  testId?: string
  /**
   * 이 값이 바뀌면 **스크롤을 맨 위로 되돌린다.**
   *
   * 시트 안에서 내용이 통째로 갈리는 화면이 있는데(지출 시트의 갈래 전환), 스크롤은 **껍데기가
   * 소유**하므로 내용만 바뀌고 위치는 그대로 남는다 — 새 내용이 **밀린 자리에서 시작**해 제목이
   * 잘린 채로 보였다(iOS 실측 2026-08-25). 되돌리는 것도 소유자의 일이라 여기 둔다.
   *
   * 안 넘기면 아무 일도 안 한다 — 한 내용만 그리는 시트는 되돌릴 것이 없다.
   */
  resetScrollKey?: string | number
  /**
   * **키보드 위에 붙는 띠**([[ADR-173]] 결정 4) — 가계부 시트의 빠른 금액 칩이 첫 호출부다.
   *
   * 라이브러리의 `footerComponent` 자리다. 시트 콘텐츠 **밖**이라 스크롤을 안 타고, 키보드가
   * 올라오면 그 위에 붙어 있게 만들어진 슬롯이다 — 폼 안에 두면 무엇과든 이웃하게 되므로
   * (그것이 «칩이 저장과 너무 가깝다» 의 원인이었다) 자리를 옮기는 대신 **폼 밖으로 내보낸다.**
   *
   * 안 넘기면 라이브러리에 아무것도 안 준다 — 띠가 없는 시트는 전과 한 픽셀도 안 다르다.
   */
  footer?: ReactNode
}

export function BottomSheet(props: BottomSheetProps): React.JSX.Element {
  const ref = useRef<BottomSheetModal>(null)
  const scrollRef = useRef<{ scrollTo?: (options: { y: number; animated: boolean }) => void }>(null)
  const insets = useSafeAreaInsets()
  // `82vh` 의 짝 — 인셋과 같은 프로바이더에서 나와 둘이 같은 순간을 가리킨다
  // (`CharacterTrackingPicker` 가 `100dvh` 를 옮긴 것과 같은 이유).
  const frame = useSafeAreaFrame()
  const { definition } = useThemeAppearance()

  // 내용이 갈리면 맨 위에서 시작한다 — 사유는 `resetScrollKey` 프롭 주석에.
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false })
  }, [props.resetScrollKey])

  // 웹의 `open` 초기값 `true` 와 같은 뜻 — 마운트가 곧 열림이다([[ADR-039]] 결정 3).
  useEffect(() => {
    ref.current?.present()
  }, [])

  /**
   * 띠는 **라이브러리가 자리를 잡아 준다** — `animatedFooterPosition` 을 그대로 넘겨야 키보드가
   * 오르내릴 때 따라간다. 우리는 안에 무엇을 그릴지만 정한다.
   */
  const { footer } = props
  const renderFooter = useCallback(
    (footerProps: BottomSheetFooterProps) =>
      footer === undefined ? null : (
        <BottomSheetFooter {...footerProps}>{footer}</BottomSheetFooter>
      ),
    [footer],
  )

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
      // 부모가 언마운트로 닫는 패턴을 유지하되, 이탈 애니메이션이 끝난 뒤에 알린다.
      onDismiss={props.onClose}
      enablePanDownToClose
      enableDynamicSizing
      /*
       * **창 모드를 사실대로 알려 준다**([[ADR-170]] 정정 5).
       *
       * 라이브러리는 이 값을 **자기가 바꾸지 않는다** — 소스 어디에도 `softInputMode` 를 건드리는
       * 곳이 없다. 이 프롭은 «앱이 지금 어느 모드인가» 를 **알려 주는** 것이고, 그 값으로 자기
       * 보정량을 정한다. 기본값은 `adjustPan` 인데 **이 앱의 매니페스트는 `adjustResize`** 다.
       *
       * 그대로 두면 안드로이드에서 **두 번 밀린다** — OS 가 창을 줄여 이미 올라온 시트를,
       * 라이브러리가 키보드 높이만큼 또 올린다. `adjustResize` 를 주면 라이브러리가 자기 보정을
       * 0 으로 두고 OS 에 맡긴다.
       */
      android_keyboardInputMode="adjustResize"
      /*
       * **올라간 것은 내려와야 한다**([[ADR-170]] 정정 5).
       *
       * 기본값(`none`)이면 라이브러리가 키보드 **닫힘**에서 일찍 빠져나가 위치를 다시 안 잰다 —
       * 소스에 그렇게 적혀 있다: `if (status === HIDDEN && keyboardBlurBehavior === none) return`.
       * 그래서 시트가 올라간 자리에 그대로 남았다(실기 보고).
       *
       * `restore` 는 «키보드가 뜨기 전에 있던 스냅 포인트로 돌아간다» 이고, 그 분기가 함께
       * `isInTemporaryPosition` 을 내려 **다음 계산이 다시 정상 경로**를 타게 한다.
       */
      keyboardBlurBehavior="restore"
      maxDynamicContentSize={frame.height * MAX_HEIGHT_RATIO}
      backdropComponent={renderBackdrop}
      // 안 넘긴 시트는 라이브러리가 띠 자체를 안 그린다 — 전과 같다.
      footerComponent={props.footer === undefined ? undefined : renderFooter}
      // 웹의 `sr-only` 제목("드롭 아이템 기록")과 같은 자리 — 화면에는 안 보이고 스크린리더만 읽는다.
      accessibilityLabel="드롭 아이템 기록"
      style={{ maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center' }}
      backgroundStyle={{
        backgroundColor: definition.bg,
        borderTopWidth: 1,
        borderTopColor: definition.border,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
    >
      {/*
       * 그랩 핸들 — **라이브러리 기본 핸들을 쓰지 않는다.**
       *
       * `handleIndicatorStyle` 로 [[ADR-039]] 결정 2 의 스킨(`h-1 w-9 bg-border-strong`)을 넘겼는데
       * 기기에서 알약이 아예 안 그려졌다(2026-08-13 — 시트 상단 24pt 를 확대해 확인했고, 보이는
       * 실선 한 줄은 `backgroundStyle` 의 `borderTopWidth` 였다). 스크림과 같은 부류라 같은 처방을
       * 쓴다: **우리가 그린다.** 패닝 제스처는 라이브러리가 이 컴포넌트를 감싸는 컨테이너에 걸므로
       * 그대로 산다.
       *
       * **`handleComponent` 슬롯도 쓰지 않는다** — 거기 넘긴 것이 두 번(클래스·명시 스타일) 다
       * 안 그려졌다(픽셀로 확인: 시트 상단 아래 200px 에 알약 색이 한 줄도 없었다). 라이브러리가
       * 핸들 컨테이너를 **내용 뒤에, 스타일 없는 `Animated.View` 로** 놓기 때문으로 보인다.
       *
       * 그래서 시트의 **첫 자식**으로 우리가 직접 놓는다. 스크롤 뷰 **밖**이라 내용을 굴려도 따라
       * 올라가지 않고, 높이 24pt 는 라이브러리 기본 핸들과 같아 내용 시작 위치가 그대로다.
       *
       * 대가: 핸들을 잡고 끄는 제스처가 사라진다. **`enablePanDownToClose` 는 그대로 산다** —
       * 시트 내용을 맨 위에서 아래로 끄는 경로가 남아 있고, 바깥 탭으로 닫는 [[ADR-039]] 결정 3 도
       * 스크림이 받는다. 닫는 수단이 없어지는 것이 아니라 하나가 준다.
       */}
      {/*
        **핸들이 흐름에서 빠져 있다**(`position: absolute`).
        
        흐름 안에 두면 이 24pt 가 시트 높이 계산에서 **빠진다** — `handleComponent={null}` 이라
        라이브러리는 핸들 높이를 0 으로 보고 스크롤 내용만 재는데, 실제로는 그 위에 24pt 가 더
        얹혀 있어 **딱 그만큼 넘친다.** 내용이 다 보이는데도 조금 굴려지고, 한 번 굴리면 제목이
        잘린 채로 남았다(iOS 실측 2026-08-25).
        
        절대 배치로 빼고 그 몫을 **스크롤 내용의 `paddingTop` 에 넣으면** 라이브러리가 재는 값
        안으로 들어와 높이가 맞는다 — 보이는 자리는 그대로다.
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

      <BottomSheetScrollView
        ref={scrollRef as never}
        testID={props.testId}
        // 웹은 `pt-2`, 하단은 시트가 화면 끝까지 가므로 안전영역만큼 더 비운다
        // ([[ADR-039]] 결정 2 의 `pb-[calc(1rem+env(safe-area-inset-bottom))]` 과 같은 뜻).
        // 위쪽에 핸들 몫을 더한다 — 사유는 바로 위 주석.
        contentContainerStyle={{
          paddingTop: HANDLE_HEIGHT + 8,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {props.children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}
