/**
 * 모달은 **오버레이 + 패널** 두 조각의 합성이다(3단계).
 *
 * 왜 프롭이 아니라 구조인가. 예전 API 는 `card` `maxWidth` `align` `tightBottom` 네 프롭을
 * 가졌고, 그중 `card={false}` 는 "카드 껍데기를 빼 달라"는 뜻이었다. 껍데기의 **유무**는 켜고 끄는
 * 속성이 아니라 **어떤 패널을 쓰는가**의 문제라 컴포넌트로 세웠다. 덕분에 부정 불리언이 사라지고,
 * `maxWidth`·`tight` 는 그것이 실제로 의미를 갖는 패널에만 붙는다.
 *
 * 오버레이가 소유하는 취약 구조(전체 화면 덮기·스크림·안전영역 오프셋·바깥 탭)는 그대로 한곳에
 * 남는다. 호출부가 그 관계를 깰 수 없다.
 *
 * ── RN 으로 옮기며 갈린 것 다섯 ─────────────────────────────────────────────────────
 *
 * ① **`createPortal(document.body)` → `react-native` 의 `Modal`.** 포털을 쓴 이유(*"호출부 어디에
 *    놓이든 부모의 레이아웃 유틸리티에 영향받지 않게"*, `space-y-*` 가 `fixed` 오버레이 높이를
 *    깎아 상태바 자리에 밝은 띠가 남던 실기기 결함)가 RN 에서는 더 강하게 성립한다. `absolute
 *    inset-0` 은 **부모 상자**에 갇혀 탭바조차 못 덮는다. `Modal` 은 별도 네이티브 윈도우다.
 * ② **`useBodyScrollLock` 이 사라진다**. 뒤 문서 스크롤 잠금을 네이티브 윈도우가 구조적으로 한다.
 *    대체가 아니라 필요 자체가 없어진 것이라 짝을 만들지 않는다.
 * ③ **`stopPropagation` → `onStartShouldSetResponder`.** RN 에는 이벤트 버블링이 없고 대신 터치를
 *    누가 가져가는지(responder)를 정한다. 자식 `View` 가 터치를 안 가져가면 **바깥 `Pressable` 이
 *    받아 모달이 닫힌다**. 그래서 두 패널이 웹에서 `onClick={stopClickPropagation}` 을 갖던 바로
 *    그 자리에서 responder 를 선언한다(같은 자리, 같은 목적).
 * ④ **안드로이드 뒤로가기 → 닫기**(후반, 2단계가 organisms 몫으로 남긴 자리).
 * ⑤ **`overflow-y-auto` 는 안 옮긴다.** 웹은 오버레이가 스크롤을 가져 내용이 길면 굴렸는데, RN 에서
 *    같은 것을 하려면 스크롤 컨테이너가 바깥 탭 영역을 통째로 덮어 "바깥을 눌러 닫기"가 죽는다.
 *  이 세운 규칙("스크롤포트는 **쓰는 쪽**이 자기 자리에 맞게 둔다")을 그대로
 *    적용해, 길어질 수 있는 모달이 자기 안에 스크롤포트를 둔다.
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
   * 패널을 빼고 내용을 직접 넣으면 터치가 오버레이로 떨어져 안쪽을 눌러도 모달이 닫힌다
   * (responder 선언은 패널이 소유한다. 파일 머리 ③).
   */
  children: ReactNode
  testId?: string
  /**
   * 세로 위치. 기본 'top'키보드가 뜨면 화면이 줄어드는데 중앙 정렬이면 중앙이 키보드 높이의
   * 절반만큼 이동해 모달이 크게 튄다(iOS 는 애니메이션 없이 스냅해 특히 어색하다). 상단 고정이면
   * 가용 높이가 줄어도 위치가 그대로라 튀지 않는다. 키보드를 띄우지 않는 모달만 'center' 를 쓴다.
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

/** 터치를 이 요소가 가져간다. 바깥 `Pressable` 로 흘러가 모달이 닫히는 것을 막는다(파일 머리 ③). */
const claimTouch = (): boolean => true

/**
 * 카드 껍데기(테두리·배경·패딩)를 갖는 패널. 모달 대부분이 이것을 쓴다.
 *
 * 스크림 위 테두리 톤다운은 `border-panel-border` 한 클래스다. 웹의
 * `:root[data-mode='light'] .panel-on-scrim` 규칙이 계산하던 결과를 토큰으로 미리 만들어 뒀고
 * (`src/theme/theme-vars.ts`), 모드 분기는 거기서 `definition.mode` 로 딱 한 번 일어난다.
 * `Card` atom 이 갖고 있는 `border-border` 를 이 클래스가 덮는다.
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
 * 껍데기 없이 위치만 잡는 패널. children 이 이미 자기 카드 스타일을 갖고 있을 때 쓴다
 * (예: 온보딩 화면에서 그대로 재사용하는 `AccountFlowStatus`).
 *
 * ** 의 두 클래스 중 이쪽 짝은 RN 에 없다.** 웹은
 * `.panel-on-scrim-parent > *` 로 **직계 자식**의 테두리를 톤다운했는데, RN 에는 자손 선택자가
 * 없어 부모가 자식의 스타일을 정할 방법이 없다. 그래서 그 결정이 지키려던 것("스크림 위라는
 * 사실은 오버레이가 소유한다")을 **자식이 `border-panel-border` 를 직접 쓰는 것**으로 대신한다.
 * 스크림 없는 화면과 공유되는 자식(`AccountFlowStatus`)이 올 때는 그 사실을 프롭으로 받아야
 * 한다. 그 배선은 화면 단계 몫이다.
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
      {/* 웹은 가로 중앙을 `justify-center`(row), 세로를 `items-*` 로 잡았다. RN 의 기본 방향이
          column 이라 두 축의 클래스가 서로 바뀐다. 그려지는 결과는 같다. */}
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
