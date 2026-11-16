// MASPI 상세 화면. 서버가 준 시세 하나를 머리 · 그래프 카드 · 범위와 거래 칸으로 나눠 적는다.
import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useMarketItem } from '../../../features/market/query'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { MaspiItemScreen } from '../MaspiItemScreen'
import { MARKET_EMPTY_TITLE } from '../MaspiScreen'

jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))
jest.mock('../../../features/market/query', () => ({ useMarketItem: jest.fn() }))

const 열기 = { params: { itemKey: 'magic_eyepatch', ringLevel: null, world: 'general' } }

beforeEach(() => {
  jest.mocked(useScreenNavigation).mockReturnValue({ goBack: jest.fn() } as unknown as ReturnType<typeof useScreenNavigation>)
})

describe('MaspiItemScreen', () => {
  it('기준가 · 전일 대비 칩 · 범위 · 거래 등급을 적고, 처음 기간은 30일이다', async () => {
    jest.mocked(useMarketItem).mockReturnValue({
      date: '2026-11-15',
      itemKey: 'magic_eyepatch',
      ringLevel: null,
      price: 2_600_000_000,
      changePct: -7.8,
      low: 2_500_000_000,
      high: 2_800_000_000,
      grade: 'normal',
      series: [
        { date: '2026-11-14', price: 2_820_000_000, low: 2_700_000_000, high: 2_840_000_000 },
        { date: '2026-11-15', price: 2_600_000_000, low: 2_500_000_000, high: 2_800_000_000 },
      ],
    })

    const view = await renderOverlay(<MaspiItemScreen route={열기} />)

    expect(jest.mocked(useMarketItem)).toHaveBeenCalledWith({ itemKey: 'magic_eyepatch', ringLevel: null, world: 'general' })
    expect(view.getByText('마력이 깃든 안대')).toBeTruthy()
    expect(view.getByTestId('maspi-item-price')).toHaveTextContent('26억')
    expect(view.getByText('전일 대비 -7.8%')).toBeTruthy()
    expect(view.getByText('25억 ~ 28억')).toBeTruthy()
    expect(view.getByText('보통')).toBeTruthy()
    expect(view.getByText('11/15 기준')).toBeTruthy()
    expect(view.getByLabelText('30일').props.accessibilityState?.selected).toBe(true)
  })

  it('신뢰 시세가 아니게 됐으면 빈 상태 카드다', async () => {
    jest.mocked(useMarketItem).mockReturnValue(null)

    const view = await renderOverlay(<MaspiItemScreen route={열기} />)

    expect(view.getByText(MARKET_EMPTY_TITLE)).toBeTruthy()
  })
})
