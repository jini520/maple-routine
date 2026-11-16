// MASPI 목록 화면. 값은 서버가 계산해 준 것이고, 화면은 그 차례대로 적고 고르개로 소비 월드만 바꾼다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useMarketItems, useMaspi } from '../../../features/market/query'
import { useRepresentativeWorldKey } from '../../../features/market/representative'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { worldEmblemUrl } from '../../../lib/assets/asset-lookup'
import type { MarketEntry, MarketItemsResponse } from '../../../server/market'
import { MARKET_EMPTY_TITLE, MaspiScreen } from '../MaspiScreen'

jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))
jest.mock('../../../features/market/query', () => ({ useMaspi: jest.fn(), useMarketItems: jest.fn() }))
jest.mock('../../../features/market/representative', () => ({ useRepresentativeWorldKey: jest.fn() }))

const navigate = jest.fn()

function 시세(부분: Partial<MarketEntry>): MarketEntry {
  return {
    itemKey: 'restraint_ring',
    ringLevel: 4,
    price: 3_300_000_000,
    changePct: 0.3,
    low: 3_200_000_000,
    high: 3_400_000_000,
    grade: 'many',
    spark: [3_250_000_000, 3_300_000_000],
    ...부분,
  }
}

function 목록(world: string, consumable: MarketEntry[]): MarketItemsResponse {
  return {
    date: '2026-11-15',
    // 서버는 판 사람 수 차례로 준다. 화면은 기준가가 높은 차례로 다시 세운다.
    equipment: [시세({ itemKey: 'brand_new_item', ringLevel: null, price: 100_000_000, changePct: null, low: null, high: null }), 시세({})],
    consumable: { world, items: consumable },
  }
}

beforeEach(() => {
  jest.mocked(useScreenNavigation).mockReturnValue({ navigate, goBack: jest.fn() } as unknown as ReturnType<typeof useScreenNavigation>)
  jest.mocked(useMaspi).mockReturnValue({ date: '2026-11-15', close: 9119, change: -24.82, series: [] })
  jest.mocked(useRepresentativeWorldKey).mockReturnValue('scania')
  jest.mocked(useMarketItems).mockImplementation((world) =>
    world === 'eos' ? 목록('eos', []) : 목록(world ?? '', [시세({ itemKey: 'life_whetstone', ringLevel: null, price: 762_500_000 })]),
  )
})

afterEach(() => {
  jest.clearAllMocks()
})

async function press(element: Parameters<typeof fireEvent.press>[0]): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

describe('MaspiScreen', () => {
  it('MASPI 카드에 종가와 부호 붙은 전일 대비를 적고, 머리 아래 줄에 값의 날짜를 적는다', async () => {
    const view = await renderOverlay(<MaspiScreen />)

    expect(view.getByTestId('maspi-card-close')).toHaveTextContent('9,119.00')
    expect(view.getByTestId('maspi-card-change')).toHaveTextContent('-24.82')
    expect(view.getByText('11/15 기준')).toBeTruthy()
  })

  it('장비는 기준가가 높은 차례로 이름 · 기준가 · 전일 대비 · 범위를 적고, 앱이 모르는 아이템은 key 를 이름 자리에 적는다. 범위가 없는 줄은 `범위 -` 다', async () => {
    const view = await renderOverlay(<MaspiScreen />)

    const rows = view.getAllByTestId(/^market-row-/).map((row) => row.props.testID as string)
    expect(rows).toEqual(['market-row-restraint_ring', 'market-row-brand_new_item'])
    expect(view.getByText('리스트레인트 링 4레벨')).toBeTruthy()
    expect(view.getByText('33억')).toBeTruthy()
    expect(view.getByText('+0.3%')).toBeTruthy()
    expect(view.getByText('범위 32억 ~ 34억')).toBeTruthy()
    expect(view.getByText('brand_new_item')).toBeTruthy()
    expect(view.getByText('0.0%')).toBeTruthy()
    expect(view.getByText('범위 -')).toBeTruthy()
  })

  it('소비는 대표 캐릭터의 월드로 열리고, 그 월드에 신뢰 시세가 없으면 빈 상태 카드다', async () => {
    jest.mocked(useRepresentativeWorldKey).mockReturnValue('eos')
    const view = await renderOverlay(<MaspiScreen />)

    await press(view.getByLabelText('소비'))

    expect(jest.mocked(useMarketItems)).toHaveBeenLastCalledWith('eos')
    expect(view.getByText('에오스')).toBeTruthy()
    expect(view.getByText(MARKET_EMPTY_TITLE)).toBeTruthy()
  })

  it('월드 드롭다운은 닫힌 칸과 목록 줄 모두 월드 이름 앞에 월드 엠블럼을 둔다', async () => {
    const view = await renderOverlay(<MaspiScreen />)
    await press(view.getByLabelText('소비'))

    expect(view.getByTestId('maspi-world-icon').props.source).toEqual(worldEmblemUrl('scania'))

    await press(view.getByLabelText('월드'))

    expect(view.getByTestId('maspi-world-option-bera-icon').props.source).toEqual(worldEmblemUrl('bera'))
  })

  it('줄을 누르면 상세를 민다. 장비는 서버가 월드를 보지 않아 general 로, 소비는 고른 월드로 연다', async () => {
    const view = await renderOverlay(<MaspiScreen />)

    await press(view.getByTestId('market-row-restraint_ring'))
    expect(navigate).toHaveBeenLastCalledWith('UtilityMaspiItem', { itemKey: 'restraint_ring', ringLevel: 4, world: 'general' })

    await press(view.getByLabelText('소비'))
    await press(view.getByTestId('market-row-life_whetstone'))
    expect(navigate).toHaveBeenLastCalledWith('UtilityMaspiItem', { itemKey: 'life_whetstone', ringLevel: null, world: 'scania' })
  })
})
