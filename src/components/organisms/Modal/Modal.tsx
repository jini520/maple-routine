import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '../../../lib/use-body-scroll-lock'
import { Card } from '../../atoms/Card/Card'

// 모달은 **오버레이 + 패널** 두 조각의 합성이다(ADR-094 3단계).
//
// 왜 프롭이 아니라 구조인가 — 예전 API 는 `card` `maxWidth` `align` `tightBottom` 네 프롭을
// 가졌고, 그중 `card={false}` 는 "카드 껍데기를 빼 달라"는 뜻이었다. 껍데기의 **유무**는
// 켜고 끄는 속성이 아니라 **어떤 패널을 쓰는가**의 문제라 컴포넌트로 세웠다. 덕분에 부정
// 불리언이 사라지고, `maxWidth`·`tight` 는 그것이 실제로 의미를 갖는 패널에만 붙는다
// (예전에는 `card={false}` 일 때 `tightBottom` 이 무의미하다는 것을 주석으로 설명해야 했다).
//
// 오버레이가 소유하는 취약 구조(포털·스크림·안전영역 오프셋·body 스크롤 잠금)는 그대로
// 한곳에 남는다 — 호출부가 그 관계를 깰 수 없다(ADR-094 결정 1).

export interface ModalProps {
  onClose: () => void
  /**
   * `Modal.Card` 또는 `Modal.Panel` 하나.
   *
   * 타입을 element 로 좁혀 둔 이유 — 패널을 빼고 내용을 직접 넣으면 클릭이 오버레이까지
   * 올라가 안쪽을 눌러도 모달이 닫힌다(`stopPropagation` 은 패널이 소유한다).
   */
  children: React.ReactElement
  testId?: string
  /**
   * 세로 위치. 기본 'top' — 키보드가 뜨면 WebView 가 줄어드는데 중앙 정렬이면 중앙이 키보드
   * 높이의 절반만큼 이동해 모달이 크게 튄다(iOS 는 애니메이션 없이 스냅해 특히 어색하다).
   * 상단 고정이면 뷰포트가 줄어도 위치가 그대로라 튀지 않는다. 키보드를 띄우지 않는 모달만
   * 'center' 를 쓴다.
   */
  align?: 'top' | 'center'
}

interface ModalPanelProps {
  children: React.ReactNode
  /** 패널 최대 너비 Tailwind 클래스 — 기본 `max-w-sm`. */
  maxWidth?: string
}

interface ModalCardProps extends ModalPanelProps {
  /**
   * 하단 패딩만 줄인다(`p-6` → `pb-4`). 부 동작 버튼이 작아 아래 여백이 상대적으로 커 보이는
   * 모달에 쓴다([[ADR-065]] 결정 2 — 업데이트 모달).
   */
  tight?: boolean
}

/** 클릭이 오버레이로 올라가 모달이 닫히는 것을 막는다 — 두 패널이 함께 쓴다. */
function stopClickPropagation(event: React.MouseEvent): void {
  event.stopPropagation()
}

/** 카드 껍데기(테두리·배경·패딩)를 갖는 패널. 모달 대부분이 이것을 쓴다. */
function ModalCard(props: ModalCardProps): React.JSX.Element {
  return (
    <Card
      onClick={stopClickPropagation}
      className={`w-full ${props.maxWidth ?? 'max-w-sm'} ${
        props.tight === true ? 'px-6 pb-4 pt-6' : 'p-6'
      }`}
    >
      {props.children}
    </Card>
  )
}

/**
 * 껍데기 없이 위치만 잡는 패널 — children 이 이미 자기 카드 스타일을 갖고 있을 때 쓴다
 * (예: 온보딩 화면에서 그대로 재사용하는 `AccountFlowStatus`).
 */
function ModalPanel(props: ModalPanelProps): React.JSX.Element {
  return (
    <div onClick={stopClickPropagation} className={`w-full ${props.maxWidth ?? 'max-w-sm'}`}>
      {props.children}
    </div>
  )
}

// body 로 포털 렌더링한다 — 호출부 어디에 놓이든 부모의 레이아웃 유틸리티에 영향받지 않게 하려고.
// 예로 space-y-*는 자식에 margin-block-end를 붙이는데, position:fixed에 top/bottom이 함께 걸린
// 오버레이는 그 마진만큼 높이가 줄어(880→864) 화면 끝까지 못 덮는다. 그러면 상태바·제스처 영역만
// 딤이 빠져 밝은 띠로 남는다(실기기 확인). 포털로 띄우면 항상 뷰포트 전체를 덮는다.
export function Modal(props: ModalProps): React.JSX.Element {
  useBodyScrollLock()

  // 상단 정렬은 안전영역(상태바·노치)만큼 내린 뒤 여백을 더 둬 화면 끝에 붙지 않게 한다.
  const alignClass =
    (props.align ?? 'top') === 'center'
      ? 'items-center'
      : 'items-start pt-[calc(var(--sa-top)+2rem)]'

  return createPortal(
    <div
      data-testid={props.testId}
      onClick={props.onClose}
      className={`fixed inset-0 z-50 flex justify-center overflow-y-auto bg-scrim px-4 ${alignClass}`}
    >
      {props.children}
    </div>,
    document.body,
  )
}

Modal.Card = ModalCard
Modal.Panel = ModalPanel
