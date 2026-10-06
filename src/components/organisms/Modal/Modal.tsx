/**
 * 모달은 오버레이 + 패널 두 조각의 합성이다.
 *
 * 프롭이 아니라 구조인 것은 껍데기의 유무가 켜고 끄는 속성이 아니라 어떤 패널을 쓰는가 의
 * 문제이기 때문이다. 덕분에 부정 불리언이 사라지고 `maxWidth`·`tight` 는 그것이 실제로 의미를
 * 갖는 패널에만 붙는다.
 *
 * 오버레이가 소유하는 취약 구조(전체 화면 덮기·스크림·안전영역 오프셋·바깥 탭)는 한곳에
 * 남는다. 호출부가 그 관계를 깰 수 없다.
 */
import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import {
  Dimensions,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MODAL_TOP_GAP_PX, overlayWindowHeightPx, resolveModalMaxHeight } from '../../../lib/modal-metrics'
import { LinearGradient } from '../../../lib/nativewind-interop'
import { useThemeAppearance } from '../../../theme/context'
import { Card } from '../../atoms'

export interface ModalProps {
  onClose: () => void
  /**
   * `Modal.Card` 또는 `Modal.Panel` 하나.
   *
   * 패널을 빼고 내용을 직접 넣으면 터치가 오버레이로 떨어져 안쪽을 눌러도 모달이 닫힌다.
   * responder 선언은 패널이 소유한다.
   */
  children: ReactNode
  testId?: string
  /**
   * 세로 위치. 기본 `top`. 키보드가 뜨면 화면이 줄어드는데 중앙 정렬이면 중앙이 키보드 높이의
   * 절반만큼 이동해 모달이 크게 튄다. 상단 고정이면 가용 높이가 줄어도 위치가 그대로다.
   * 키보드를 띄우지 않는 모달만 `center` 를 쓴다.
   */
  align?: 'top' | 'center'
}

interface ModalPanelProps {
  children: ReactNode
  /** 패널 최대 너비 Tailwind 클래스. 기본 `max-w-sm`. */
  maxWidth?: string
}

interface ModalCardProps extends ModalPanelProps {
  /**
   * 하단 패딩만 줄인다(`p-6` → `pb-4`). 부 동작 버튼이 작아 아래 여백이 상대적으로 커 보이는
   * 모달에 쓴다(업데이트 모달).
   */
  tight?: boolean
  /** 카드 바닥에 고정되는 버튼 줄. 카드가 상한에 닿아도 늘 보인다. 없으면 카드 전체가 구른다. */
  footer?: ReactNode
}

/** 터치를 이 요소가 가져가게 하는 responder. 바깥으로 흘러가 모달이 닫히는 것을 막는다. */
const claimTouch = (): boolean => true

/** 패널이 가질 수 있는 높이. 오버레이가 안전영역과 정렬에서 내려 준다. */
const MaxHeightContext = createContext<number | undefined>(undefined)

/** 구르는 칸이 가려진 쪽 끝에 까는 페이드 길이. 시트와 같은 값이다. */
const FADE_PX = 16

/** 같은 색의 알파 0. 표면색이 8자리로 올 수도 있어 앞 7자리만 쓴다. */
function fadedOut(color: string): string {
  return `${color.slice(0, 7)}00`
}

/**
 * 상한 안에서 넘치는 몫만 구르는 칸. 위아래로 가려진 내용이 있을 때만 그쪽에 페이드를 깐다.
 *
 * 넘치지 않으면 스크롤을 끈다. 켜 두면 모달 안의 제스처(파티 인원 모달의 비율 슬라이더)와
 * 세로 스크롤이 다툰다.
 */
function CapScroll(props: { children: ReactNode; surface?: string; testId: string }): React.JSX.Element {
  const viewportRef = useRef(0)
  const contentRef = useRef(0)
  const [overflows, setOverflows] = useState(false)
  const [hiddenAbove, setHiddenAbove] = useState(false)
  const [hiddenBelow, setHiddenBelow] = useState(false)

  function sync(): void {
    // 1px 은 소수점 반올림 몫. 0 으로 두면 맨 아래에서 페이드가 깜빡인다.
    const over = contentRef.current > viewportRef.current + 1
    setOverflows(over)
    setHiddenBelow(over)
  }

  return (
    <View style={{ flexShrink: 1 }}>
      <ScrollView
        testID={props.testId}
        scrollEnabled={overflows}
        bounces={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        style={{ flexGrow: 0 }}
        onLayout={(event) => {
          viewportRef.current = event.nativeEvent.layout.height
          sync()
        }}
        onContentSizeChange={(_, height) => {
          contentRef.current = height
          sync()
        }}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
          setHiddenAbove(contentOffset.y > 1)
          setHiddenBelow(contentOffset.y + layoutMeasurement.height < contentSize.height - 1)
        }}
      >
        {props.children}
      </ScrollView>
      {props.surface !== undefined && hiddenAbove && (
        <View
          testID={`${props.testId.replace(/-scroll$/, '')}-fade-top`}
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: FADE_PX }}
        >
          <LinearGradient
            colors={[props.surface, fadedOut(props.surface)]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1 }}
          />
        </View>
      )}
      {props.surface !== undefined && hiddenBelow && (
        <View
          testID={`${props.testId.replace(/-scroll$/, '')}-fade-bottom`}
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: FADE_PX }}
        >
          <LinearGradient
            colors={[fadedOut(props.surface), props.surface]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </View>
  )
}

/**
 * 카드 껍데기(테두리·배경·패딩)를 갖는 패널. 모달 대부분이 이것을 쓴다.
 *
 * 스크림 위 테두리 톤다운은 `border-panel-border` 한 클래스다. 모드 분기는 `theme-vars.ts`
 * 에서 `definition.mode` 로 한 번 일어난다. `Card` atom 이 갖고 있는 `border-border` 를 이
 * 클래스가 덮는다.
 */
function ModalCard(props: ModalCardProps): React.JSX.Element {
  const maxHeight = useContext(MaxHeightContext)
  const { definition } = useThemeAppearance()
  return (
    <Card
      testID="modal-card"
      onStartShouldSetResponder={claimTouch}
      className={`w-full ${props.maxWidth ?? 'max-w-sm'} border-panel-border ${
        props.tight === true ? 'px-6 pb-4 pt-6' : 'p-6'
      }`}
      style={{ maxHeight }}
    >
      <CapScroll testId="modal-card-scroll" surface={definition.surface}>
        {props.children}
      </CapScroll>
      {props.footer}
    </Card>
  )
}

/**
 * 껍데기 없이 위치만 잡는 패널. children 이 자기 카드 스타일을 직접 두를 때 쓴다.
 *
 * 지금 쓰는 곳은 `PartySizeModal` 하나다. 히어로 일러스트가 모서리까지 가야 해서 `Modal.Card` 의
 * `p-6` 안에 들어갈 수 없다.
 *
 * RN 에는 자손 선택자가 없어 부모가 자식의 스타일을 정할 방법이 없다. 그래서 스크림 위라는
 * 사실은 오버레이가 소유한다 를 자식이 `border-panel-border` 를 직접 쓰는 것으로 대신한다.
 * 스크림 없는 화면과 공유되는 자식이 올 때는 그 사실을 프롭으로 받아야 하고, 그 배선은
 * 화면 몫이다.
 */
function ModalPanel(props: ModalPanelProps): React.JSX.Element {
  const maxHeight = useContext(MaxHeightContext)
  return (
    <View
      testID="modal-panel"
      onStartShouldSetResponder={claimTouch}
      className={`w-full ${props.maxWidth ?? 'max-w-sm'}`}
      style={{ maxHeight }}
    >
      <CapScroll testId="modal-panel-scroll">{props.children}</CapScroll>
    </View>
  )
}

/**
 * 안드로이드에서 스크림이 **하단 내비 영역을 한 박자 늦게 덮는 것**을 막는 최소 높이.
 *
 * RN 모달의 크기는 안드로이드가 잰 값이 state 로 건너와 정해진다
 * (`DialogRootViewGroup.onSizeChanged` → `updateState({screenHeight})`). 그 값이 두 번 온다.
 * 창이 붙기 전 높이가 먼저 오고, `enableEdgeToEdge()` 의 인셋이 자리잡은 뒤 전체 높이가 온다.
 * `flex-1` 은 그것을 그대로 따라가므로 첫 프레임의 스크림에 내비 바 띠만 빠진다.
 *
 * 표시 높이는 늦게 안 온다. 그것으로 바닥을 깔면 첫 프레임부터 끝까지 덮는다. 창보다 크면
 * 창이 잘라내므로 넘치는 쪽은 안 보인다.
 *
 * iOS 는 모달이 전체 화면 뷰라 이 문제가 없다.
 */
function scrimMinHeight(): number | undefined {
  if (Platform.OS !== 'android') return undefined
  return Dimensions.get('screen').height
}

export function Modal(props: ModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const align = props.align ?? 'top'
  const maxHeight = resolveModalMaxHeight({
    windowHeightPx: overlayWindowHeightPx(window.height),
    insetTopPx: insets.top,
    insetBottomPx: insets.bottom,
    align,
  })

  return (
    <RNModal
      testID={props.testId === undefined ? undefined : `${props.testId}-modal`}
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      {/*
        **제스처 뿌리를 모달 안에 한 번 더 세운다.** 안드로이드에서 RN `Modal` 은 별도 네이티브
        창이라 앱 루트의 `GestureHandlerRootView` 밖이고, 그 창 안의 제스처는 이벤트를 하나도
        못 받는다. 탭은 RN 응답자 시스템이라 멀쩡해서, 증상이 **눌리는데 끌리지 않는다** 로 온다
        (실기기 계측: 같은 스와이프에 트리에서는 17건, 모달 안에서는 0건).
      */}
      <GestureHandlerRootView testID="modal-gesture-root" style={{ flex: 1 }}>
        {/* RN 의 기본 방향이 column 이라 두 축의 클래스가 서로 바뀐다. 그려지는 결과는 같다. */}
        <Pressable
        testID={props.testId}
        onPress={props.onClose}
        className={`flex-1 items-center bg-scrim px-4 ${align === 'center' ? 'justify-center' : ''}`}
        // 상단 정렬은 안전영역(상태바·노치)만큼 내린 뒤 여백을 더 둬 화면 끝에 붙지 않게 한다.
        style={{
          ...(align === 'center' ? null : { paddingTop: insets.top + MODAL_TOP_GAP_PX }),
          minHeight: scrimMinHeight(),
        }}
      >
          <MaxHeightContext.Provider value={maxHeight}>{props.children}</MaxHeightContext.Provider>
        </Pressable>
      </GestureHandlerRootView>
    </RNModal>
  )
}

Modal.Card = ModalCard
Modal.Panel = ModalPanel
