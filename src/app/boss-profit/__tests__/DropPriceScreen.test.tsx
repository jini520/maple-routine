// 아이템 가격 입력 화면. 이 화면이 지키는 것을 적는다.
//
// 갈린 것 셋
// ① **라우터가 없다**. 뒤로는 `goBack` 이 불렸는가로 본다.
// ② 입력 카드 **내부** 계약은 `organisms/InputCard` 의 테스트가 갖는다.
//    여기서는 *"행을 누르면 그 기록을 들고 열리는가· 저장이 스토어까지 가는가"* 만 본다.
// ③ **표시 계약을 케이스로 못박았다.** 미입력 자리에 `0` 이
//    없는지, `priceMeso` 는 있고 `priceState` 가 없는 기록(가장 강한 반례)이 여전히 미입력으로
//    읽히는지, 그 기록이 합계를 한 푼도 안 움직이는지.
import type { ReactNode } from 'react'
import { act, fireEvent, within } from '@testing-library/react-native'

// 시트 껍데기는 `BossDropSheet.test.tsx` 와 같은 이유로 세워 둔다.
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, { testID: 'sheet-backdrop', ...props }),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    // 넘긴 것을 그대로 돌려준다. 시트가 무엇을 넘겼는지는 프롭에서 본다.
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import weeklyBossesData from '../../../data/weekly-bosses.json'
import { useDropPriceStore, type DropPriceEntry } from '../../../features/boss-profit/drop-price-store'
import { useBossProfitStore } from '../../../features/boss-profit/store'
import { getCurrentBossProfitPeriod } from '../../../lib/boss/boss-profit-period'
import type { RecordedDrop } from '../../../types/drops'

import { flattenStyle, renderOverlay, 테스트_안전영역 } from '../../../components/__tests__/render-atom'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { setHapticsPort } from '../../../native/ports'
import { DropPriceScreen } from '../DropPriceScreen'

const mockShowError = jest.fn()
const goBack = jest.fn()

jest.mock('../../../features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: jest.fn() }) },
}))
jest.mock('../../../features/boss-profit/store', () => ({ useBossProfitStore: jest.fn() }))
jest.mock('../../../features/boss-profit/drop-price-store', () => ({ useDropPriceStore: jest.fn() }))
// 가격 카드의 자동 수수료가 읽는 등급 기록. ocid-1 은 다이아 ID 다.
jest.mock('../../../features/mvp-grade/fee-context', () => ({
  loadFeeContext: jest.fn(async () => ({
    histories: new Map([['A', [{ startDate: '2026-06-11', grade: 'diamond' }]]]),
    sightings: [{ ocid: 'ocid-1', name: '루디', accountId: 'A', firstSeenOn: '2026-06-01', lastSeenOn: '2026-09-22' }],
    fallbackOcid: 'ocid-1',
  })),
}))
jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))

// 기간은 라우트 파라미터가 준다. 떠 있는 버튼은 넘기고 today 타일은 안 넘긴다.
let mockRoute: { name: 'DropPrice'; params?: { cycle: 'weekly' | 'monthly'; periodKey: string } } = {
  name: 'DropPrice',
}
jest.mock('@react-navigation/native', () => ({
  // 통째로 갈아 끼우면 이 패키지가 내보내는 컨텍스트까지 사라진다. 실물을 깔고 필요한 것만 덮는다.
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => mockRoute,
}))

const mockedProfitStore = jest.mocked(useBossProfitStore)
const mockedPriceStore = jest.mocked(useDropPriceStore)
const mockedNavigation = jest.mocked(useScreenNavigation)

// 스토어가 상태 타입을 내보내지 않아 훅에서 판다(`drop-history-store` 쪽과 같은 방식).
type PriceStore = ReturnType<typeof useDropPriceStore>

// 보스 이름·난이도는 게임 레퍼런스 데이터에서 뽑는다.
const 주간보스 = weeklyBossesData.weekly[0].key
const 주간보스이름 = weeklyBossesData.weekly[0].name
const PERIOD = '2026-08-06'

const load = jest.fn()
const savePrice = jest.fn()
const excludePrice = jest.fn()

function 드롭(overrides: Partial<RecordedDrop> = {}): RecordedDrop {
  return {
    category: 'equipment',
    itemKey: 'loose_control_machine_mark',
    itemName: '루즈 컨트롤 머신 마크',
    quantity: 1,
    ...overrides,
  }
}

function 항목(overrides: Partial<DropPriceEntry> = {}): DropPriceEntry {
  return {
    id: `ocid-1|${주간보스}|hard|${PERIOD}|0`,
    ocid: 'ocid-1',
    bossKey: 주간보스,
    bossName: 주간보스이름,
    difficulty: 'hard',
    periodKey: PERIOD,
    dropIndex: 0,
    partySize: 3,
    drop: 드롭(),
    ...overrides,
  }
}

function 그룹(entries: DropPriceEntry[]) {
  return [{ ocid: 'ocid-1', characterName: '지내우시', imageUrl: null, entries }]
}

function mockStores(options: { price?: Partial<PriceStore>; cycle?: 'weekly' | 'monthly'; periodKey?: string } = {}): void {
  mockRoute = {
    name: 'DropPrice',
    params: { cycle: options.cycle ?? 'weekly', periodKey: options.periodKey ?? PERIOD },
  }

  mockedPriceStore.mockReturnValue({
    status: 'ready',
    // 화면이 `읽은 기간` 과 `보는 기간` 을 대조하므로 기본값은 열린 기간과 같아야 한다.
    periodKey: options.periodKey ?? PERIOD,
    groups: 그룹([항목()]),
    load,
    savePrice,
    excludePrice,
    ...options.price,
  } as unknown as PriceStore)
}

beforeEach(() => {
  load.mockReset().mockResolvedValue(undefined)
  savePrice.mockReset().mockResolvedValue(undefined)
  excludePrice.mockReset().mockResolvedValue(undefined)
  mockShowError.mockReset()
  goBack.mockReset()
  mockedNavigation.mockReturnValue({ goBack } as unknown as ReturnType<typeof useScreenNavigation>)
  mockStores()
})

// ★ 회귀 가드. 이 화면은 공용 `PageHeader` 를 쓰지 않고 **같은 값을 자기 파일에서**
// 낸다(드랍 히스토리·보스 수익과 같은 사정). 공용 셸만 고치고 여기를 빠뜨리면 히스토리·가격 두
// 하위 페이지의 제목 높이가 16px 갈리는데, 두 화면은 같은 진입점 줄에서 나란히 열린다.
describe('DropPriceScreen: 셸', () => {
  // 들어오는 문의 이름이 `아이템 가격` 이라 도착한 화면도 같은 말로 자기를 말한다.
  it('제목은 `아이템 가격 입력` 이다', async () => {
    mockStores()
    const { getByText, queryByText } = await renderOverlay(<DropPriceScreen />)

    expect(getByText('아이템 가격 입력')).toBeTruthy()
    expect(queryByText('가격 기록')).toBeNull()
  })

  it('헤더가 상단 안전영역만큼만 먹는다. 여백을 더하지 않는다', async () => {
    const { getByTestId } = await renderOverlay(<DropPriceScreen />)

    expect(flattenStyle(getByTestId('page-header').props.style).paddingTop).toBe(
      테스트_안전영역.insets.top,
    )
  })
})

describe('DropPriceScreen: 기간을 이어받는다', () => {
  it('넘겨받은 주를 그대로 연다', async () => {
    await renderOverlay(<DropPriceScreen />)

    expect(load).toHaveBeenCalledWith(PERIOD)
  })

  // today 타일이 기간을 안 넘긴다. 보스 수익 스토어의 보는 기간은 계산해 둔 날짜 글자라, 보스 수익
  // 화면이 없을 때는 낡아 있을 수 있다(수요일 밤에 백그라운드로 두고 목요일에 돌아온 경우).
  it('넘겨받은 기간이 없으면 스토어에 남은 기간이 아니라 열리는 순간의 주간 · 이번 주로 연다', async () => {
    const currentWeekKey = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
    mockStores({ periodKey: currentWeekKey })
    mockRoute = { name: 'DropPrice' }
    mockedProfitStore.mockReturnValue({
      tab: 'monthly',
      periodKey: '2026-08',
    } as unknown as ReturnType<typeof useBossProfitStore>)

    const { getByLabelText } = await renderOverlay(<DropPriceScreen />)

    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith(currentWeekKey)
    // 주 단위로 열렸다. 달 단위면 이전 기간이 `YYYY-MM` 이다.
    await act(async () => {
      fireEvent.press(getByLabelText('이전 기간'))
    })
    expect(load).toHaveBeenLastCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

  // 주 단위로만 열면 월간 보스 드롭에 닿을 길이 없다. 그 기록의 `period_key` 는 `YYYY-MM` 이라
  // 어느 주차 조회에도 안 걸린다.
  it('월간을 넘겨받으면 그 달을 연다', async () => {
    mockStores({ cycle: 'monthly', periodKey: '2026-08' })
    await renderOverlay(<DropPriceScreen />)

    expect(load).toHaveBeenCalledWith('2026-08')
  })

  it('월간으로 열면 기간 이동도 달 단위다', async () => {
    mockStores({ cycle: 'monthly', periodKey: '2026-08' })
    const { getByLabelText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('이전 기간'))
    })

    expect(load).toHaveBeenCalledWith('2026-07')
  })

  it('월간으로 열면 문구도 달로 말한다', async () => {
    mockStores({ cycle: 'monthly', periodKey: '2026-08', price: { groups: [] } })
    const { getByText } = await renderOverlay(<DropPriceScreen />)

    expect(getByText('이 달에 기록된 아이템이 없습니다')).toBeTruthy()
  })

  // 이 스토어는 화면을 떠나도 살아 있어 지난번 기간의 `ready` 를 그대로 든다. 읽기를 거는
  // 효과는 첫 렌더 뒤에 도므로, 안 가르면 기록이 있는데도 빈 상태가 한 프레임 번쩍인다.
  it('아직 이 기간을 안 읽었으면 빈 상태가 아니라 불러오는 중이다', async () => {
    mockStores({ periodKey: '2026-08-06', price: { periodKey: '2026-07-30', groups: [] } })
    const { getByTestId, queryByText } = await renderOverlay(<DropPriceScreen />)

    expect(getByTestId('loading-state')).toBeTruthy()
    expect(queryByText('이 주에 기록된 아이템이 없습니다')).toBeNull()
  })

  it('그 기간을 읽고 나서야 빈 상태가 선다', async () => {
    mockStores({ periodKey: '2026-08-06', price: { periodKey: '2026-08-06', groups: [] } })
    const { getByText } = await renderOverlay(<DropPriceScreen />)

    expect(getByText('이 주에 기록된 아이템이 없습니다')).toBeTruthy()
  })

  it('더 갈 수 없는 과거에서는 이전 기간 버튼이 잠긴다', async () => {
    mockStores({ periodKey: '2025-01-02' })
    const { getByLabelText } = await renderOverlay(<DropPriceScreen />)

    expect(getByLabelText('이전 기간').props.accessibilityState.disabled).toBe(true)
  })

  it('뒤로는 pop 이다. 딥링크가 없어 돌아갈 곳을 계산하지 않는다', async () => {
    const { getByLabelText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('뒤로'))
    })

    expect(goBack).toHaveBeenCalled()
  })
})

describe('DropPriceScreen: 값 매기기', () => {
  it('행을 탭하면 그 기록을 들고 키패드가 열리고, 저장하면 스토어로 간다', async () => {
    const { getByLabelText, getByTestId, getByText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크 가격 입력'))
    })
    // 행을 누르면 카드가 곧장 뜬다. 가운데 있던 가격 입력 시트는 걷혔다.
    await act(async () => {
      fireEvent.changeText(getByTestId('input-card-value'), '100000000')
    })
    await act(async () => {
      fireEvent.press(getByTestId('input-card-confirm'))
    })

    expect(savePrice).toHaveBeenCalledWith(
      expect.objectContaining({ bossKey: 주간보스 }),
      100_000_000,
      // 합이 그 행의 파티원 수인 균등. 내 비율 1 이라 값이 지금과 같다.
      { myShare: 1, sharesTotal: 3 },
      // 새로 매긴 가격은 판매 · 분배 수수료가 자동이고 그 기간의 등급 요율이다.
      { saleFeePercent: 3, saleFeeAuto: true, splitFeePercent: 3, splitFeeAuto: true },
    )
    expect(getByText).toBeTruthy()
  })

  // 카드는 `기본` 으로 열린다. 내 몫이 `1 ÷ 인원` 이라 인원 하나만 받으면 된다.
  it('분배는 기본으로 열리고 인원이 그 행의 파티원 수다', async () => {
    const { getByLabelText, getByText, getByTestId, queryByTestId } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크 가격 입력'))
    })
    expect(getByText('파티 인원')).toBeTruthy()
    expect(queryByTestId('share-field-ratio-분배 비율')).toBeNull()

    await act(async () => {
      fireEvent.changeText(getByTestId('input-card-value'), '100')
    })
    await act(async () => {
      fireEvent.press(getByTestId('input-card-confirm'))
    })

    expect(savePrice).toHaveBeenCalledWith(expect.anything(), 100, { myShare: 1, sharesTotal: 3 }, expect.anything())
  })

  it('저장이 실패하면 토스트로 알린다. 조용히 삼키면 저장된 줄 알고 떠난다', async () => {
    savePrice.mockRejectedValue(new Error('쓰기 실패'))
    const { getByLabelText, getByTestId, getByText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크 가격 입력'))
    })
    await act(async () => {
      fireEvent.changeText(getByTestId('input-card-value'), '100000000')
    })
    await act(async () => {
      fireEvent.press(getByTestId('input-card-confirm'))
    })

    expect(mockShowError).toHaveBeenCalledWith('가격을 저장하지 못했습니다')
    expect(getByText).toBeTruthy()
  })

  it('조회 실패는 빈 목록으로 위장하지 않는다', async () => {
    mockStores({ price: { status: 'failed', groups: [] } })
    const { getByText } = await renderOverlay(<DropPriceScreen />)

    expect(getByText('가격 기록을 불러오지 못했습니다')).toBeTruthy()
  })

  it('조회 중에는 로딩을 보여준다', async () => {
    mockStores({ price: { status: 'loading', groups: [] } })
    const { getByTestId } = await renderOverlay(<DropPriceScreen />)

    expect(getByTestId('loading-state')).toBeTruthy()
  })

  it('기록이 없으면 아이템 어휘로 말한다', async () => {
    mockStores({ price: { groups: [] } })
    const { getByText } = await renderOverlay(<DropPriceScreen />)

    expect(getByText('이 주에 기록된 아이템이 없습니다')).toBeTruthy()
  })
})

// **미입력은 0원이 아니다**. 이 화면이 그 구분을 가장 직접적으로 보여주는 자리다.
describe('DropPriceScreen: 미입력 ≠ 0원', () => {
  it('미입력 행의 금액 자리에는 0 이 아니라 "입력" 이 선다', async () => {
    const { getByLabelText } = await renderOverlay(<DropPriceScreen />)

    // **행 안으로 좁혀 묻는다**. 합계 두 자리(캐릭터 머리·요약 헤드라인)는 `0 메소` 가 맞다.
    // 아무것도 안 매겼으니 더한 값이 0인 것이고, 그것과 *"이 기록의 값을 모른다"* 는 다른 사실이다.
    const row = within(getByLabelText('루즈 컨트롤 머신 마크 가격 입력'))
    expect(row.getByText('입력')).toBeTruthy()
    expect(row.queryByText(/메소/)).toBeNull()
    expect(row.queryByText('0')).toBeNull()
  })

  // 가장 강한 반례. `priceMeso ?? 0` 계열로 그리면 여기서 금액이 샌다.
  it('priceMeso 는 있고 priceState 가 없는 기록은 여전히 미입력이고 합계를 안 움직인다', async () => {
    mockStores({
      price: { groups: 그룹([항목({ drop: 드롭({ priceMeso: 9_000_000_000 }) })]) },
    })
    const { getByLabelText, getAllByText, queryByText } = await renderOverlay(<DropPriceScreen />)

    expect(within(getByLabelText('루즈 컨트롤 머신 마크 가격 입력')).getByText('입력')).toBeTruthy()
    expect(queryByText('90억')).toBeNull()
    expect(queryByText(/9,000,000,000/)).toBeNull()
    // 캐릭터 합계와 요약 헤드라인 둘 다 0 이다. 값을 매기지 않았으므로 더할 것이 없다.
    expect(getAllByText('0 메소')).toHaveLength(2)
  })

  it('기록 안함은 미입력과 다른 얼굴이고 미입력 카운트에서 빠진다', async () => {
    mockStores({
      price: {
        groups: 그룹([
          항목({ drop: 드롭({ priceState: 'excluded' }) }),
          항목({ id: 'second', dropIndex: 1, drop: 드롭({ itemKey: 'guardian_angel_ring', itemName: '가디언 엔젤 링' }) }),
        ]),
      },
    })
    const { getByText } = await renderOverlay(<DropPriceScreen />)

    expect(getByText('기록 안함')).toBeTruthy()
    // 기록 안함은 **가격을 입력한 것이 아니다**. 요약의 `n건` 에서 빠진다.
    expect(getByText('0건')).toBeTruthy()
    // 미입력 카운트에서도 빠진다. 그 수를 말하는 자리는 이제 CTA 하나다.
    expect(getByText('미입력 1건 이어서 입력')).toBeTruthy()
  })

  it('값을 매긴 행만 인원을 말한다. 미입력에 "1인" 이 서면 정해진 값처럼 읽힌다', async () => {
    mockStores({
      price: {
        groups: 그룹([
          항목({
            drop: 드롭({ priceState: 'entered', priceMeso: 1_200_000_000, priceShare: 3 }),
          }),
        ]),
      },
    })
    const { getByText, queryByText } = await renderOverlay(<DropPriceScreen />)

    expect(getByText(new RegExp(`${주간보스이름} · 3인`))).toBeTruthy()
    expect(queryByText(/1인$/)).toBeNull()
  })

  it('요약 오른쪽은 가격을 입력한 개수 하나다', async () => {
    mockStores({
      price: {
        groups: 그룹([
          항목({ drop: 드롭({ priceState: 'entered', priceMeso: 100, priceShare: 1 }) }),
          항목({ id: 'second', dropIndex: 1, drop: 드롭({ itemKey: 'guardian_angel_ring', itemName: '가디언 엔젤 링' }) }),
        ]),
      },
    })
    const { getByText } = await renderOverlay(<DropPriceScreen />)

    expect(getByText('1건')).toBeTruthy()
  })

  // 요약 한 줄이 같은 것을 세 번 말하고 있었다. 미입력 수는 CTA 가, 건별 상태는 행의 pill 이 말한다.
  it('가격 아래 상태 배지 줄이 없다', async () => {
    mockStores({
      price: {
        groups: 그룹([
          항목({ drop: 드롭({ priceState: 'entered', priceMeso: 100, priceShare: 1 }) }),
          항목({ id: 'second', dropIndex: 1, drop: 드롭({ itemKey: 'guardian_angel_ring', itemName: '가디언 엔젤 링' }) }),
          항목({ id: 'third', dropIndex: 2, drop: 드롭({ priceState: 'excluded' }) }),
        ]),
      },
    })
    const { queryByText } = await renderOverlay(<DropPriceScreen />)

    expect(queryByText('입력 1')).toBeNull()
    expect(queryByText('기록 안함 1')).toBeNull()
    expect(queryByText('미입력 1')).toBeNull()
  })

  it('다 매겨도 그 자리에 문구를 세우지 않는다', async () => {
    mockStores({
      price: {
        groups: 그룹([항목({ drop: 드롭({ priceState: 'entered', priceMeso: 100, priceShare: 1 }) })]),
      },
    })
    const { queryByText } = await renderOverlay(<DropPriceScreen />)

    expect(queryByText('이 주는 다 정했습니다')).toBeNull()
    expect(queryByText(/미입력/)).toBeNull()
  })
})

describe('DropPriceScreen: 표시 규칙 정정 (2026-08-10)', () => {
  it('상자명은 쓰지 않는다. 이름이 길어 아이템명과 보스를 밀어냈다', async () => {
    mockStores({
      price: {
        groups: 그룹([
          항목({
            drop: 드롭({
              category: 'consumable',
              itemKey: 'restraint_ring',
              itemName: '리스트레인트 링',
              boxOriginKey: 'red_boss_ring_box',
              boxOrigin: '홍옥의 보스 반지 상자',
              ringLevel: 3,
              priceState: 'entered',
              priceMeso: 1_200_000_000,
              priceShare: 3,
            }),
          }),
        ]),
      },
    })
    const { queryByText, getByText } = await renderOverlay(<DropPriceScreen />)

    expect(queryByText(/홍옥의 보스 반지 상자/)).toBeNull()
    expect(getByText('리스트레인트 링 3레벨')).toBeTruthy()
  })

  // 줄 이름은 key 로 찾은 지금 이름이다. key 가 없는 옛 기록만 적어 둔 이름으로 선다.
  it('key 로 찾은 이름을 쓰고, key 가 없는 옛 기록은 적어 둔 이름을 쓴다', async () => {
    mockStores({
      price: {
        groups: 그룹([
          항목({ drop: 드롭({ itemName: '옛 이름' }) }),
          항목({ id: 'legacy', dropIndex: 1, drop: 드롭({ itemKey: null, itemName: '익셉셔널 해머' }) }),
        ]),
      },
    })
    const { getByLabelText, queryByLabelText } = await renderOverlay(<DropPriceScreen />)

    expect(getByLabelText('루즈 컨트롤 머신 마크 가격 입력')).toBeTruthy()
    expect(queryByLabelText('옛 이름 가격 입력')).toBeNull()
    expect(getByLabelText('익셉셔널 해머 가격 입력')).toBeTruthy()
  })
})

// **스킵과 기록 안함은 다른 일이다**.
//   기록 안함 = "값을 매길 만하지 않다"는 결정 → 저장한다(미입력에서 빠진다)
//   스킵 = "아직 안 팔렸다, 팔리면 넣겠다" → **아무것도 저장하지 않고** 미입력에 머문다
describe('DropPriceScreen: 순차 입력', () => {
  it('"기록 안함" 은 결정을 저장한다', async () => {
    const { getByLabelText, getByTestId } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크 가격 입력'))
    })
    await act(async () => {
      fireEvent.press(getByTestId('input-card-exclude'))
    })

    expect(excludePrice).toHaveBeenCalledWith(expect.objectContaining({ bossKey: 주간보스 }))
  })

  it('단건 편집에는 이전이 없고 버튼이 닫기다', async () => {
    const { getByLabelText, getByText, queryByTestId } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크 가격 입력'))
    })

    expect(queryByTestId('input-card-prev')).toBeNull()
    expect(getByText('닫기')).toBeTruthy()
  })

  it('빈 칸으로 넘기면 아무것도 저장하지 않고 다음 건으로만 간다', async () => {
    mockStores({
      price: {
        groups: 그룹([
          항목(),
          항목({ id: 'second', dropIndex: 1, drop: 드롭({ itemKey: 'guardian_angel_ring', itemName: '가디언 엔젤 링' }) }),
        ]),
      },
    })
    const { getByText, getByTestId } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByText('미입력 2건 이어서 입력'))
    })
    expect(getByText('다음(2/2)')).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByTestId('input-card-confirm'))
    })

    expect(excludePrice).not.toHaveBeenCalled()
    expect(savePrice).not.toHaveBeenCalled()
    // 다음 건으로 넘어갔다. 목록에도 같은 이름이 있으므로 카드의 머리로 좁힌다.
    expect(getByTestId('input-card-label').props.children[0]).toBe('가디언 엔젤 링')
    // 마지막 자리라 세는 말을 하고, 이전이 첫 자리를 가리킨다.
    expect(getByText('0개 입력 완료')).toBeTruthy()
    expect(getByText('이전(1/2)')).toBeTruthy()
  })
})

// 화면은 그대로여도 **보는 기간이 바뀐다**. 손끝이 답하는 것은 화면 전환이 아니라 누름이 먹혔다이다.
describe('기간 이동의 촉각', () => {
  const tap = jest.fn(async () => undefined)

  beforeEach(() => {
    tap.mockClear()
    setHapticsPort({ tap, select: async () => {} })
  })

  afterEach(installNoopNativePorts)

  it('‹ › 에 한 번씩 난다', async () => {
    mockStores({ periodKey: '2026-07-30' })
    const { getByLabelText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('이전 기간'))
    })
    expect(tap).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.press(getByLabelText('다음 기간'))
    })
    expect(tap).toHaveBeenCalledTimes(2)
  })

  // 조회 한도 바닥에서는 `이전 기간` 이 꺼져 있다. 꺼진 버튼은 누름 자체가 안 들어간다.
  it('끝 기간의 꺼진 화살표에는 안 난다', async () => {
    mockStores({ periodKey: '2025-01-02' })
    const { getByLabelText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('이전 기간'))
    })

    expect(tap).not.toHaveBeenCalled()
  })

  // 페이지 뒤로는 `BackButton` 이 든다. 이 화면이 그것을 실제로 쓰고 있는지를 함께 본다.
  it('뒤로에도 난다', async () => {
    const { getByLabelText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('뒤로'))
    })

    expect(tap).toHaveBeenCalledTimes(1)
  })
})
