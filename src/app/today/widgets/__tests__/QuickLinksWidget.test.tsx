// 빠른 이동 위젯. 이 파일이 지키는 것 넷.
// ① 칸은 구성 차례대로 다섯씩 줄을 이루고, 칸 아래는 짧은 이름 · 접근성 이름은 전체 이름이다
// ② 탭 화면 칸은 그 탭을 열고, 하위 페이지 칸은 스택에 민다. 칸마다 갈 곳이 달라 타일 전체는 누를 수 없다
// ③ 제목 줄의 `편집` 이 편집 시트를 연다
// ④ 가계부 분류 칸은 그 분류를 넘겨 가계부 탭을 연다. 서버 갈래 표에 그 분류가 없으면 칸을 그리지 않는다
import type { ReactNode } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../../components/__tests__/render-atom'
import { useOpenTab } from '../../../../hooks/useOpenTab'
import { useScreenNavigation } from '../../../../hooks/useScreenNavigation'
import { cashbookCategoriesTable } from '../../../../lib/cashbook/categories'
import type { QuickLinksConfig } from '../../../../types/quick-links'
import { QuickLinksWidget } from '../QuickLinksWidget'
import { 뷰모델 } from './widget-fixture'

// 시트 라이브러리를 맨 뷰로 바꾼다. 여기서 보는 것은 `편집` 이 시트를 세우는가다.
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    useBottomSheetTimingConfigs: (config: unknown) => config,
    useBottomSheetInternal: () =>
      jest.requireActual<typeof import('../../../../components/__tests__/bottom-sheet-internal-fake')>(
        '../../../../components/__tests__/bottom-sheet-internal-fake',
      ).fakeBottomSheetInternal(),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})
jest.mock('../../../../hooks/useOpenTab', () => ({ useOpenTab: jest.fn() }))
jest.mock('../../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))

const openTab = jest.fn()
const navigate = jest.fn()

beforeEach(() => {
  openTab.mockClear()
  navigate.mockClear()
  jest.mocked(useOpenTab).mockReturnValue(openTab)
  jest.mocked(useScreenNavigation).mockReturnValue({ navigate, goBack: jest.fn() } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
})

async function 위젯(quickLinks: QuickLinksConfig) {
  return renderOverlay(<QuickLinksWidget data={뷰모델({ quickLinks })} />)
}

describe('칸', () => {
  it('구성 차례대로 다섯씩 줄을 이룬다', async () => {
    const view = await 위젯({
      rows: 2,
      ids: ['profit', 'stats', 'boss-manage', 'item-split', 'app-settings', 'boss', 'notices'],
    })

    const 줄 = [0, 1].map((index) => view.getByTestId(`quick-links-row-${index}`))
    expect(줄[0]).toHaveTextContent(/^보스 수입통계보스 관리분배금 계산설정$/)
    expect(줄[1]).toHaveTextContent(/^보스공지$/)
  })

  it('칸 아래는 짧은 이름이고 접근성 이름은 전체 이름이다', async () => {
    const view = await 위젯({ rows: 1, ids: ['item-split'] })

    expect(view.getByRole('button', { name: '판매 분배금 계산기' })).toHaveTextContent('분배금 계산')
  })
})

describe('누르기', () => {
  it('탭 화면 칸은 그 탭을 열고 하위 페이지 칸은 스택에 민다', async () => {
    const view = await 위젯({ rows: 1, ids: ['stats', 'boss-manage'] })

    await fireEvent.press(view.getByRole('button', { name: '통계' }))
    await fireEvent.press(view.getByRole('button', { name: '보스 관리' }))

    expect(openTab).toHaveBeenCalledWith('Stats')
    expect(navigate).toHaveBeenCalledWith('BossManage')
  })

  it('`편집` 을 누르면 편집 시트가 열린다', async () => {
    const view = await 위젯({ rows: 1, ids: ['stats'] })
    expect(view.queryByTestId('quick-links-sheet')).toBeNull()

    await fireEvent.press(view.getByRole('button', { name: '빠른 이동 편집' }))

    expect(await view.findByTestId('quick-links-sheet')).toBeTruthy()
  })
})

describe('가계부 분류 칸', () => {
  // 앱에 든 테스트 데이터는 옛 표라 `사냥 전리품 판매` 줄이 없다.
  const 옛표 = cashbookCategoriesTable.get()
  afterEach(() => cashbookCategoriesTable.set(옛표))

  function 전리품판매를더한표(): typeof 옛표 {
    const 조각 = 옛표.categories.find((each) => each.key === 'sol_erda_fragment')!
    return { ...옛표, categories: [...옛표.categories, { ...조각, key: 'hunt_loot_sale', name: '사냥 전리품 판매' }] }
  }

  it('누르면 그 분류를 넘겨 가계부 탭을 연다', async () => {
    const view = await 위젯({ rows: 1, ids: ['income-hunting'] })

    await fireEvent.press(view.getByRole('button', { name: '수입 사냥' }))

    expect(openTab).toHaveBeenCalledWith('Cashbook', { incomeCategory: 'hunting' })
  })

  it('서버 갈래 표에 없는 분류의 칸은 그리지 않고, 표에 줄이 들어오면 그 자리에 다시 선다', async () => {
    const view = await 위젯({ rows: 1, ids: ['profit', 'income-hunt-loot-sale', 'stats'] })
    expect(view.getByTestId('quick-links-row-0')).toHaveTextContent(/^보스 수입통계$/)

    await act(async () => cashbookCategoriesTable.set(전리품판매를더한표()))

    expect(view.getByTestId('quick-links-row-0')).toHaveTextContent(/^보스 수입전리품 판매통계$/)
  })
})
