// 하단 탭 순서 페이지. 끌어서 놓은 순서는 이 페이지에만 보이고, `적용` 을 눌러야 저장되고 바에 반영된다.
import { act, fireEvent } from '@testing-library/react-native'

import { useBarOrderStore } from '../../../features/bar-order/store'
import { DEFAULT_BAR_ORDER, type BarOrder } from '../../../navigation/bar-groups'
import { getBarOrder } from '../../../storage/bar-order'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { SettingsBarOrderScreen } from '../SettingsBarOrderScreen'

const mockGoBack = jest.fn()
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  useSettingsNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
}))

interface GridProps {
  data: string[]
  onDragEnd: (params: { data: string[] }) => void
}

let mockGrids: GridProps[] = []

// 정렬 라이브러리는 받은 프롭만 붙들고 줄은 그대로 그린다. 끌기는 `onDragEnd` 를 직접 불러 대신한다.
jest.mock('react-native-sortables', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    __esModule: true,
    default: {
      Grid: (props: { data: unknown[]; renderItem: (p: { item: unknown; index: number }) => React.ReactNode }) => {
        mockGrids.push(props as unknown as GridProps)
        return React.createElement(React.Fragment, null, ...props.data.map((item, index) => props.renderItem({ item, index })))
      },
      Handle: (props: { children: React.ReactNode }) => props.children,
    },
  }
})

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

const MOVED: BarOrder = {
  groups: ['today', 'ledger', 'utility', 'schedule', 'settings'],
  subs: { schedule: ['Boss', 'Appointments', 'Content'], ledger: ['Stats', 'Profit', 'Cashbook'] },
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function applyButton(view: Rendered): AtomElement {
  let node: AtomElement | null = view.getByText('적용')
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error('적용 버튼이 없다')
  return node
}

/** 다시 그릴 때마다 목록이 새로 쌓이므로 마지막 렌더의 목록 셋. 화면 순서는 하단 탭 · 스케줄러 · 수입·지출 */
function lastGrids(): GridProps[] {
  return mockGrids.slice(-3)
}

async function drop(gridIndex: number, data: string[]): Promise<void> {
  await act(async () => {
    lastGrids()[gridIndex]!.onDragEnd({ data })
  })
}

/** 미리보기 바의 칸 이름. 그려진 순서다 */
function previewLabels(view: Rendered, key: 'groups' | 'schedule' | 'ledger'): string[] {
  const texts: string[] = []
  const walk = (current: AtomElement): void => {
    for (const child of current.children) {
      if (typeof child === 'string') texts.push(child)
      else walk(child)
    }
  }
  walk(view.getByTestId(`bar-order-preview-${key}`))
  return texts
}

beforeEach(() => {
  mockGrids = []
  installFakePreferences()
  useBarOrderStore.setState({ order: DEFAULT_BAR_ORDER })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('SettingsBarOrderScreen', () => {
  // 옮길 수 없는 칸을 목록에 두면 그 줄을 따로 구분해야 하고, 끄는 동안 다른 줄이 그 자리를 밀어낼 수 있다.
  it('저장된 순서로 열리고, today 와 더보기는 목록에 없이 하단 탭 미리보기에만 있다', async () => {
    useBarOrderStore.setState({ order: MOVED })
    const view = await renderOverlay(<SettingsBarOrderScreen />)

    expect(lastGrids().map((grid) => grid.data)).toEqual([
      ['ledger', 'utility', 'schedule'],
      ['Boss', 'Appointments', 'Content'],
      ['Stats', 'Profit', 'Cashbook'],
    ])
    expect(previewLabels(view, 'groups')).toEqual(['today', '수입·지출', '유틸리티', '스케줄러', '더보기'])
  })

  it('놓은 순서가 그 카드의 미리보기에 보이고, 저장은 아직 하지 않는다', async () => {
    const view = await renderOverlay(<SettingsBarOrderScreen />)

    await drop(1, ['Boss', 'Appointments', 'Content'])

    expect(previewLabels(view, 'schedule')).toEqual(['보스', '파티 스케줄', '컨텐츠'])
    expect(previewLabels(view, 'ledger')).toEqual(['보스 수입', '가계부', '통계'])
    expect(useBarOrderStore.getState().order).toEqual(DEFAULT_BAR_ORDER)
    expect(await getBarOrder()).toBeNull()
  })

  it('저장된 순서와 같으면 적용이 꺼지고, 옮겼다가 되돌려도 다시 꺼진다', async () => {
    const view = await renderOverlay(<SettingsBarOrderScreen />)
    expect(applyButton(view).props.accessibilityState?.disabled).toBe(true)

    await drop(0, ['utility', 'schedule', 'ledger'])
    expect(applyButton(view).props.accessibilityState?.disabled).toBe(false)

    await drop(0, ['schedule', 'ledger', 'utility'])
    expect(applyButton(view).props.accessibilityState?.disabled).toBe(true)
  })

  it('적용을 누르면 today 와 더보기를 양 끝에 둔 순서를 저장하고 바에 반영한 뒤 돌아간다', async () => {
    const view = await renderOverlay(<SettingsBarOrderScreen />)

    await drop(0, ['ledger', 'utility', 'schedule'])
    await drop(2, ['Stats', 'Profit', 'Cashbook'])
    await drop(1, ['Boss', 'Appointments', 'Content'])
    await press(applyButton(view))

    expect(useBarOrderStore.getState().order).toEqual(MOVED)
    expect(await getBarOrder()).toEqual(MOVED)
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it('적용 없이 나가면 고친 순서를 버린다', async () => {
    const view = await renderOverlay(<SettingsBarOrderScreen />)

    await drop(0, ['utility', 'schedule', 'ledger'])
    await press(view.getByLabelText('뒤로'))

    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(useBarOrderStore.getState().order).toEqual(DEFAULT_BAR_ORDER)
    expect(await getBarOrder()).toBeNull()

    view.unmount()
    const reopened = await renderOverlay(<SettingsBarOrderScreen />)
    expect(previewLabels(reopened, 'groups')).toEqual(['today', '스케줄러', '수입·지출', '유틸리티', '더보기'])
  })
})
