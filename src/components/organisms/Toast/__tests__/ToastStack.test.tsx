// 토스트 스택. 갈린 것 둘.
//
// *"body 직속으로 렌더링한다"* → **사라진다.** RN 에서 그 성질을 주는 것은 네이티브 윈도우뿐인데
//   그것은 화면 전체의 터치를 삼켜 토스트에 쓸 수 없다(`ToastStack.tsx`). 대신 **자기가
//   놓인 자리에 절대 배치로 그리고 터치를 통과시킨다**는 계약을 지킨다.
// - `bottom-[calc(...)]` 클래스를 보던 두 케이스는 실제 `bottom` 숫자를 잰다.
import {
  flattenStyle,
  renderOverlay,
  type AtomElement,
} from '../../../__tests__/render-atom'
import { fireEvent } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

import { useToastStore, type ToastItem } from '../../../../features/toast/store'
import { resolveBottomBarMetrics } from '../../../../lib/bottom-bar-metrics'
import { setSystemBarsPort } from '../../../../native/ports'
import {
  buttonNavigationSystemBarsPort,
  noopSystemBarsPort,
} from '../../../../native/__tests__/fake-native-ports'

import { ToastStack } from '../ToastStack'

jest.mock('../../../../features/toast/store', () => ({ useToastStore: jest.fn() }))

const mockedStore = jest.mocked(useToastStore)

function mockStore(toasts: ToastItem[]): { dismiss: jest.Mock } {
  const dismiss = jest.fn()
  mockedStore.mockReturnValue({
    toasts,
    queue: [],
    showSuccess: jest.fn(),
    showInfo: jest.fn(),
    showError: jest.fn(),
    dismiss })
  return { dismiss }
}

/** 어떤 요소 아래의 글자. 순서를 보는 데 쓴다. */
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
  setSystemBarsPort(noopSystemBarsPort)
})

/** 토스트가 하단바 윗변에서 띄우는 간격. */
const 간격 = 12

describe('ToastStack', () => {
  // 목록 순서가 곧 위→아래 순서다.
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

// 스택 자신은 터치를 통과시키고 토스트 카드만 받는다. 절대 배치라 자기 상자 밖을
  // 애초에 안 받았고, RN 에서는 명시해야 한다.
  it('스택 자신은 터치를 통과시킨다', async () => {
    mockStore([toast('t1', '첫째')])
    const { getByTestId } = await renderOverlay(<ToastStack />)

    expect(getByTestId('toast-stack').props.pointerEvents).toBe('box-none')
  })

  // 바 높이는 창 폭의 함수다. 상수로 적어 두면 바가 72 인 기기에서 토스트가 바 위로 4 만 뜨고, 더 높은 기기에서는 바에 겹친다.
  it('hasTabBar 가 true(기본값)면 하단바 몫 위에 띄운다', async () => {
    mockStore([toast('t1', '첫째')])
    const { getByTestId } = await renderOverlay(<ToastStack />)

    const 바_몫 = resolveBottomBarMetrics(Dimensions.get('window').width, false).spacePx
    expect(flattenStyle(getByTestId('toast-stack').props.style).bottom).toBe(34 + 바_몫 + 간격)
  })

  // 3버튼 내비게이션 바 위에서는 하단바가 14 더 뜬다. 토스트만 그대로면 바에 겹친다.
  it('3버튼 내비게이션 바가 있으면 하단바를 띄운 높이만큼 함께 오른다', async () => {
    setSystemBarsPort(buttonNavigationSystemBarsPort)
    mockStore([toast('t1', '첫째')])
    const { getByTestId } = await renderOverlay(<ToastStack />)

    const 바 = resolveBottomBarMetrics(Dimensions.get('window').width, true)
    expect(바.liftPx).toBeGreaterThan(0)
    expect(flattenStyle(getByTestId('toast-stack').props.style).bottom).toBe(
      34 + 바.liftPx + 바.heightPx + 간격,
    )
  })

  it('hasTabBar 가 false 면 안전영역 바로 위에 띄운다(온보딩 등 탭바 없는 화면)', async () => {
    mockStore([toast('t1', '첫째')])
    const { getByTestId } = await renderOverlay(<ToastStack hasTabBar={false} />)

    expect(flattenStyle(getByTestId('toast-stack').props.style).bottom).toBe(34 + 간격)
  })

})
