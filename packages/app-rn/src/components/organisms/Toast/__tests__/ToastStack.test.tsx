// 웹판 일곱을 옮겼다. 갈린 것 둘.
//
// · *"body 직속으로 렌더링한다"* → **사라진다.** RN 에서 그 성질을 주는 것은 네이티브 윈도우뿐인데
//   그것은 화면 전체의 터치를 삼켜 토스트에 쓸 수 없다(`ToastStack.tsx` 파일 머리). 대신 **자기가
//   놓인 자리에 절대 배치로 그리고 터치를 통과시킨다**는 계약을 지킨다.
// · `bottom-[calc(...)]` 클래스를 보던 두 케이스는 실제 `bottom` 숫자를 잰다.
import { fireEvent } from '@testing-library/react-native'

import { useToastStore, type ToastItem } from '@core/features/toast/store'

import { flattenStyle, renderOverlay, type AtomElement } from '../../../__tests__/render-atom'
import { ToastStack } from '../ToastStack'

jest.mock('@core/features/toast/store', () => ({ useToastStore: jest.fn() }))

const mockedStore = jest.mocked(useToastStore)

function mockStore(toasts: ToastItem[]): { dismiss: jest.Mock } {
  const dismiss = jest.fn()
  mockedStore.mockReturnValue({
    toasts,
    queue: [],
    showSuccess: jest.fn(),
    showInfo: jest.fn(),
    showError: jest.fn(),
    dismiss,
  })
  return { dismiss }
}

/** 어떤 요소 아래의 글자 — 순서를 보는 데 쓴다. */
function textsUnder(node: AtomElement): string[] {
  const out: string[] = []
  const visit = (current: AtomElement | string): void => {
    if (typeof current === 'string') {
      out.push(current)
      return
    }
    for (const child of current.children) visit(child as AtomElement | string)
  }
  visit(node)
  return out
}

function toast(id: string, message: string): ToastItem {
  return { id, variant: 'success', message, duration: 2000 }
}

afterEach(() => {
  jest.clearAllMocks()
})

describe('ToastStack', () => {
  // 웹은 `container` 가 비는지 봤다. RN 은 렌더 도우미가 프로바이더를 두르므로 **스택 자체가
  // 없는지**를 본다(컴포넌트가 `null` 을 돌려준다).
  it('토스트가 없으면 아무것도 렌더하지 않는다', async () => {
    mockStore([])
    const { queryByTestId } = await renderOverlay(<ToastStack />)

    expect(queryByTestId('toast-stack')).toBeNull()
  })

  it('store 의 toasts 를 각각 렌더한다', async () => {
    mockStore([toast('t1', '첫째'), toast('t2', '둘째')])
    const { getByText } = await renderOverlay(<ToastStack />)

    expect(getByText('첫째')).toBeTruthy()
    expect(getByText('둘째')).toBeTruthy()
  })

  // 목록 순서가 곧 위→아래 순서다(웹은 `flex-col`, RN 은 기본 방향이 column).
  it('오래된 토스트가 위, 최신 토스트가 탭바에 가까운 아래쪽에 온다', async () => {
    mockStore([toast('t1', '첫째'), toast('t2', '둘째')])
    const { getAllByTestId } = await renderOverlay(<ToastStack />)

    expect(getAllByTestId('toast').map((node) => textsUnder(node)[0])).toEqual(['첫째', '둘째'])
  })

  it('닫기 버튼을 누르면 해당 토스트의 id 로 dismiss 를 호출한다', async () => {
    const { dismiss } = mockStore([toast('t1', '첫째'), toast('t2', '둘째')])
    const { getAllByLabelText } = await renderOverlay(<ToastStack />)

    await fireEvent.press(getAllByLabelText('닫기')[1])

    expect(dismiss).toHaveBeenCalledWith('t2')
  })

  // 스택 자신은 터치를 통과시키고 토스트 카드만 받는다 — 웹은 컨테이너가 `fixed` 라 자기 상자 밖을
  // 애초에 안 받았고, RN 에서는 명시해야 한다.
  it('스택 자신은 터치를 통과시킨다', async () => {
    mockStore([toast('t1', '첫째')])
    const { getByTestId } = await renderOverlay(<ToastStack />)

    expect(getByTestId('toast-stack').props.pointerEvents).toBe('box-none')
  })

  it('hasTabBar 가 true(기본값)면 탭바 높이만큼 띄운다', async () => {
    mockStore([toast('t1', '첫째')])
    const { getByTestId } = await renderOverlay(<ToastStack />)

    // 탭바 64 + 안전영역 하단 34 + 12
    expect(flattenStyle(getByTestId('toast-stack').props.style).bottom).toBe(64 + 34 + 12)
  })

  it('hasTabBar 가 false 면 안전영역 바로 위에 띄운다(온보딩 등 탭바 없는 화면)', async () => {
    mockStore([toast('t1', '첫째')])
    const { getByTestId } = await renderOverlay(<ToastStack hasTabBar={false} />)

    expect(flattenStyle(getByTestId('toast-stack').props.style).bottom).toBe(34 + 12)
  })

  it('트리 스냅샷', async () => {
    mockStore([toast('t1', '첫째'), toast('t2', '둘째')])
    const { toJSON } = await renderOverlay(<ToastStack />)

    expect(toJSON()).toMatchSnapshot()
  })
})
