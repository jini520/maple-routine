import { act, fireEvent, within } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import type { CategoryTotal } from '../../../features/stats/aggregate'
import { CategorySection } from '../CategorySection'

const 지출: CategoryTotal[] = [
  { key: 'enhancement:starforce', name: '스타포스', meso: 1_860_000_000 },
  { key: 'enhancement:cube_reset', name: '큐브 재설정', meso: 720_000_000 },
  { key: 'symbol', name: '심볼 강화', meso: 330_000_000 },
  { key: 'item_purchase', name: '아이템 구매', meso: 250_000_000 },
  { key: 'enhancement:potential', name: '잠재능력', meso: 210_000_000 },
  { key: 'scroll', name: '주문서', meso: 110_000_000 },
  { key: 'content', name: '컨텐츠', meso: 60_000_000 },
  { key: 'enhancement:soul_potential', name: '소울 잠재능력', meso: 40_000_000 },
]

const 수입: CategoryTotal[] = [
  { key: 'boss_crystal', name: '보스 결정석', meso: 2_840_000_000 },
  { key: 'boss_drop', name: '보스 드롭', meso: 970_000_000 },
  {
    key: 'hunting',
    name: '사냥',
    meso: 200_000_000,
    parts: [
      { key: 'hunting_meso', name: '사냥 메소', meso: 180_000_000 },
      { key: 'sol_erda_fragment', name: '솔 에르다 조각', meso: 20_000_000 },
    ],
  },
  { key: 'item_sale', name: '아이템 판매', meso: 30_000_000 },
  { key: 'etc', name: '기타', meso: 10_000_000 },
]

beforeEach(() => {
  installNoopNativePorts()
})

describe('CategorySection', () => {
  it('가운데에 합계가 서고 조각마다 항목 · % · 금액이 적힌다', async () => {
    const view = await renderOverlay(<CategorySection title="지출 내역" side="expense" items={지출} />)

    expect(view.getByTestId('stats-category-total').props.children).toBe('35.8억')
    const starforce = view.getByTestId('stats-category-label-enhancement:starforce')
    expect(within(starforce).getByText('스타포스')).toBeTruthy()
    expect(within(starforce).getByText('52%')).toBeTruthy()
    expect(within(starforce).getByText('18.6억')).toBeTruthy()
  })

  it('넷을 넘는 것은 그 외 한 조각이고 누르면 묶인 항목이 뜬다', async () => {
    const view = await renderOverlay(<CategorySection title="지출 내역" side="expense" items={지출} />)

    expect(view.getByTestId('stats-category-label-rest')).toBeTruthy()
    expect(view.queryByTestId('stats-category-popover')).toBeNull()

    await act(async () => {
      fireEvent.press(view.getByLabelText('그 외 4 세부 항목'))
    })

    const popover = view.getByTestId('stats-category-popover')
    expect(within(popover).getByText('잠재능력')).toBeTruthy()
    expect(within(popover).getByText('소울 잠재능력')).toBeTruthy()
    expect(within(popover).getByText('2.1억')).toBeTruthy()
  })

  it('남는 것이 하나면 묶지 않는다', async () => {
    const view = await renderOverlay(<CategorySection title="수입 내역" side="income" items={수입.slice(0, 5)} />)

    expect(view.queryByTestId('stats-category-label-rest')).toBeNull()
    expect(view.getByTestId('stats-category-label-etc')).toBeTruthy()
  })

  it('나눠 보이는 조각은 누르면 그 갈래의 세부 줄이 뜬다', async () => {
    const view = await renderOverlay(<CategorySection title="수입 내역" side="income" items={수입} />)

    expect(within(view.getByTestId('stats-category-label-hunting')).getByText('사냥 ›')).toBeTruthy()

    await act(async () => {
      fireEvent.press(view.getByLabelText('사냥 세부 항목'))
    })

    const popover = view.getByTestId('stats-category-popover')
    expect(within(popover).getByText('사냥')).toBeTruthy()
    expect(within(popover).getByText('사냥 메소')).toBeTruthy()
    expect(within(popover).getByText('1.8억')).toBeTruthy()
    expect(within(popover).getByText('솔 에르다 조각')).toBeTruthy()
    expect(within(popover).getByText('2,000만')).toBeTruthy()
  })

  it('기록이 없으면 도넛 대신 한 줄을 적는다', async () => {
    const view = await renderOverlay(<CategorySection title="수입 내역" side="income" items={[]} />)

    expect(view.getByText('이 기간의 수입 기록이 없어요')).toBeTruthy()
  })
})

describe('CategorySection 기간 바꾸기', () => {
  it('열린 팝오버는 항목이 바뀌면 닫힌다', async () => {
    let setItems: ((items: CategoryTotal[]) => void) | null = null
    function 하네스(): React.JSX.Element {
      const react = require('react') as typeof import('react')
      const [items, set] = react.useState(지출)
      setItems = set
      return <CategorySection title="지출 내역" side="expense" items={items} />
    }
    const view = await renderOverlay(<하네스 />)
    await act(async () => {
      fireEvent.press(view.getByLabelText('그 외 4 세부 항목'))
    })
    expect(view.getByTestId('stats-category-popover')).toBeTruthy()

    await act(async () => {
      setItems?.([...지출])
    })

    expect(view.queryByTestId('stats-category-popover')).toBeNull()
  })
})
