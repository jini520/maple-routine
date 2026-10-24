// 빠른 이동 위젯. 이 파일이 지키는 것 셋.
// ① 칸은 구성 차례대로 다섯씩 줄을 이루고, 칸 아래는 짧은 이름 · 접근성 이름은 전체 이름이다
// ② 탭 화면 칸은 그 탭을 열고, 하위 페이지 칸은 스택에 민다. 칸마다 갈 곳이 달라 타일 전체는 누를 수 없다
// ③ 제목 줄의 `편집` 이 편집 시트를 연다
import type { ReactNode } from 'react'
import { fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../../components/__tests__/render-atom'
import { useOpenTab } from '../../../../hooks/useOpenTab'
import { useScreenNavigation } from '../../../../hooks/useScreenNavigation'
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
    expect(줄[0]).toHaveTextContent(/^보스 수익통계보스 관리분배금 계산설정$/)
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
