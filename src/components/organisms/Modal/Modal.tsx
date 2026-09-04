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
import type { ReactNode } from 'react'
import { Modal as RNModal, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

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
}

/** 터치를 이 요소가 가져가게 하는 responder. 바깥으로 흘러가 모달이 닫히는 것을 막는다. */
const claimTouch = (): boolean => true

/**
 * 카드 껍데기(테두리·배경·패딩)를 갖는 패널. 모달 대부분이 이것을 쓴다.
 *
 * 스크림 위 테두리 톤다운은 `border-panel-border` 한 클래스다. 모드 분기는 `theme-vars.ts`
 * 에서 `definition.mode` 로 한 번 일어난다. `Card` atom 이 갖고 있는 `border-border` 를 이
 * 클래스가 덮는다.
 */
function ModalCard(props: ModalCardProps): React.JSX.Element {
  return (
    <Card
      onStartShouldSetResponder={claimTouch}
      className={`w-full ${props.maxWidth ?? 'max-w-sm'} border-panel-border ${
        props.tight === true ? 'px-6 pb-4 pt-6' : 'p-6'
      }`}
    >
      {props.children}
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
  return (
    <View
      onStartShouldSetResponder={claimTouch}
      className={`w-full ${props.maxWidth ?? 'max-w-sm'}`}
    >
      {props.children}
    </View>
  )
}

export function Modal(props: ModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const align = props.align ?? 'top'

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
        {/* RN 의 기본 방향이 column 이라 두 축의 클래스가 서로 바뀐다. 그려지는 결과는 같다. */}
      <Pressable
        testID={props.testId}
        onPress={props.onClose}
        className={`flex-1 items-center bg-scrim px-4 ${align === 'center' ? 'justify-center' : ''}`}
        // 상단 정렬은 안전영역(상태바·노치)만큼 내린 뒤 여백을 더 둬 화면 끝에 붙지 않게 한다.
        style={align === 'center' ? undefined : { paddingTop: insets.top + 32 }}
      >
        {props.children}
      </Pressable>
    </RNModal>
  )
}

Modal.Card = ModalCard
Modal.Panel = ModalPanel
