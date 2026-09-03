// 이 화면이 지키는 것을 적는다.
//
// 갈린 것 둘
// ① **뒷 페이지 스크롤을 막고 복원한다는 옮길 계약이 아니다**. `useBodyScrollLock` 이 하던 일을
//    네이티브 윈도우가 구조적으로 한다(`DisconnectConfirm.tsx`). 대체가 아니라 필요
//    자체가 없어진 것이라 짝을 만들지 않는다.
// ② `오버레이 바깥 클릭`은 `Modal` 의 `testId` 로 잡아 누른다. 카드가 responder 를 선언해
//    안쪽 터치는 오버레이로 흘러가지 않는다(`Modal.tsx`).
import { fireEvent } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { DisconnectConfirm } from '../DisconnectConfirm'

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

function buttonOf(view: Rendered, label: string): AtomElement {
  let node: AtomElement | null = view.getByText(label)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`버튼을 찾지 못했다: ${label}`)
  return node
}

function props(overrides: Partial<React.ComponentProps<typeof DisconnectConfirm>> = {}) {
  return {
    isOpen: true,
    isDisconnecting: false,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  }
}

describe('DisconnectConfirm', () => {
  it('isOpen이 false면 아무것도 렌더링하지 않는다', async () => {
    const view = await renderOverlay(<DisconnectConfirm {...props({ isOpen: false })} />)

    expect(view.queryByTestId('disconnect-confirm-overlay')).toBeNull()
    expect(view.queryByText('연결을 해제할까요?')).toBeNull()
  })

  it('확인 버튼을 누르면 onConfirm이 호출된다', async () => {
    const onConfirm = jest.fn()
    const view = await renderOverlay(<DisconnectConfirm {...props({ onConfirm })} />)

    fireEvent.press(buttonOf(view, '연결 해제'))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('취소 버튼을 누르면 onCancel이 호출된다', async () => {
    const onCancel = jest.fn()
    const view = await renderOverlay(<DisconnectConfirm {...props({ onCancel })} />)

    fireEvent.press(buttonOf(view, '취소'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('오버레이 바깥을 누르면 onCancel이 호출된다', async () => {
    const onCancel = jest.fn()
    const view = await renderOverlay(<DisconnectConfirm {...props({ onCancel })} />)

    fireEvent.press(view.getByTestId('disconnect-confirm-overlay'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  // 스피너가 라벨을 덮는다. 되돌릴 수 없는 동작이라 진행 중인지 멈춘 건지가
  // `disabled` 만으로는 구분되지 않는다.
  it('isDisconnecting이 true면 확인 버튼이 대기 상태가 되고 비활성이다', async () => {
    const view = await renderOverlay(<DisconnectConfirm {...props({ isDisconnecting: true })} />)

    // `aria-busy` 는 RN 이 `accessibilityState.busy` 로 접는다. `disabled` 와 같은 객체다.
    const confirm = buttonOf(view, '연결 해제')
    expect(confirm.props.accessibilityState).toMatchObject({ disabled: true, busy: true })
  })
})
