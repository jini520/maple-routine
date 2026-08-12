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
//   라이브러리 기본 핸들 색·라운딩을 쓰지 않는다.
// · **스크림**: `bg-scrim` 토큰. 라이브러리 백드롭의 기본 검정 + 자체 알파를 끄고(`opacity={1}`)
//   테마 값을 그대로 쓴다 — 그러지 않으면 라이트 테마에서 스크림이 두 겹이 된다.
//
// ── 웹의 정정 둘은 RN 에 **없는 문제**다 ───────────────────────────────────────────
//
// [[ADR-039]] 정정 1(`pointer-events-auto`)·정정 2(`data-sheet-keep-open` 가드)는 둘 다 원인이
// **Radix `dismissable-layer`** 였다 — 시트가 열린 동안 `document.body` 에 `pointer-events:none` 을
// 걸고, 시트 콘텐츠 **바깥**의 pointerdown 을 dismiss 신호로 본 것(그리고 React 포털 이벤트가 DOM
// 이 아니라 React 트리로 전파되는 성질). RN 에는 문서도 없고, `@gorhom/bottom-sheet` 은 바깥 탭을
// 백드롭에서만 받는다(`pressBehavior`). 고가 드롭 연출은 그보다 위의 **네이티브 윈도우**라
// (`DropEffectOverlay`) 탭이 시트에 닿지 않는다 — 마커도 가드도 필요 없다.
//
// ── 배선 전제 ─────────────────────────────────────────────────────────────────────
//
// `BottomSheetModal` 은 **`BottomSheetModalProvider` 아래**에서만 뜨고, 제스처는
// `GestureHandlerRootView` 안에서만 돈다. 둘 다 앱 셸이 소유한다(화면 단계). `BottomSheet`(비-모달)
// 대신 이것을 고른 이유는 인라인 시트가 **부모 상자 안**에서만 그려져 탭바를 못 덮기 때문이다 —
// 웹의 `fixed inset-x-0 bottom-0 z-[60]` 이 하던 일을 프로바이더의 호스트가 대신한다.
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'

import { useThemeAppearance } from '../../../theme/context'

/** 시트 최대 높이 — 웹 `max-h-[82vh]`. */
const MAX_HEIGHT_RATIO = 0.82
/** 시트 최대 너비 — 웹 `max-w-md`. */
const MAX_WIDTH = 448

interface BottomSheetProps {
  onClose: () => void
  children: ReactNode
  testId?: string
}

export function BottomSheet(props: BottomSheetProps): React.JSX.Element {
  const ref = useRef<BottomSheetModal>(null)
  const insets = useSafeAreaInsets()
  // `82vh` 의 짝 — 인셋과 같은 프로바이더에서 나와 둘이 같은 순간을 가리킨다
  // (`CharacterTrackingPicker` 가 `100dvh` 를 옮긴 것과 같은 이유).
  const frame = useSafeAreaFrame()
  const { definition } = useThemeAppearance()

  // 웹의 `open` 초기값 `true` 와 같은 뜻 — 마운트가 곧 열림이다([[ADR-039]] 결정 3).
  useEffect(() => {
    ref.current?.present()
  }, [])

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...backdropProps}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        // 알파는 토큰이 이미 갖고 있다 — 라이브러리 기본 알파를 겹치면 두 겹이 된다.
        opacity={1}
        pressBehavior="close"
        style={[backdropProps.style, { backgroundColor: definition.scrim }]}
      />
    ),
    [definition.scrim],
  )

  return (
    <BottomSheetModal
      ref={ref}
      // 부모가 언마운트로 닫는 패턴을 유지하되, 이탈 애니메이션이 끝난 뒤에 알린다.
      onDismiss={props.onClose}
      enablePanDownToClose
      enableDynamicSizing
      maxDynamicContentSize={frame.height * MAX_HEIGHT_RATIO}
      backdropComponent={renderBackdrop}
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
      handleIndicatorStyle={{ height: 4, width: 36, backgroundColor: definition.borderStrong }}
    >
      <BottomSheetScrollView
        testID={props.testId}
        // 웹은 `pt-2`, 하단은 시트가 화면 끝까지 가므로 안전영역만큼 더 비운다
        // ([[ADR-039]] 결정 2 의 `pb-[calc(1rem+env(safe-area-inset-bottom))]` 과 같은 뜻).
        contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 16 }}
      >
        {props.children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}
