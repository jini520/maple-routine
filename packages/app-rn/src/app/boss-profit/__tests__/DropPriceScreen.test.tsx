// 가격 기록 화면([[ADR-124]] 결정 8) — 웹판(251줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 셋
// ① **라우터가 없다** — 뒤로는 `goBack` 이 불렸는가로 본다.
// ② 키패드 **내부** 계약은 `DropPricePad.test.tsx` 가 갖는다(웹은 화면 테스트에 섞여 있었다).
//    여기서는 *"행을 누르면 그 기록을 들고 열리는가 · 저장이 스토어까지 가는가"* 만 본다.
// ③ **[[ADR-124]] 표시 계약을 케이스로 못박았다** — 웹에 없던 것이다. 미입력 자리에 `0` 이
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
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import weeklyBossesData from '@core/data/weekly-bosses.json'
import { useDropPriceStore, type DropPriceEntry } from '@core/features/boss-profit/drop-price-store'
import { useBossProfitStore } from '@core/features/boss-profit/store'
import type { RecordedDrop } from '@core/types/drops'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useScreenNavigation } from '../../use-screen-navigation'
import { DropPriceScreen } from '../DropPriceScreen'

const mockShowError = jest.fn()
const goBack = jest.fn()

jest.mock('@core/features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: jest.fn() }) },
}))
jest.mock('@core/features/boss-profit/store', () => ({ useBossProfitStore: jest.fn() }))
jest.mock('@core/features/boss-profit/drop-price-store', () => ({ useDropPriceStore: jest.fn() }))
jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

const mockedProfitStore = jest.mocked(useBossProfitStore)
const mockedPriceStore = jest.mocked(useDropPriceStore)
const mockedNavigation = jest.mocked(useScreenNavigation)

// 스토어가 상태 타입을 내보내지 않아 훅에서 판다(`drop-history-store` 쪽과 같은 방식).
type PriceStore = ReturnType<typeof useDropPriceStore>

// 보스 이름·난이도는 게임 레퍼런스 데이터에서 뽑는다([[ADR-006]]).
const 주간보스 = weeklyBossesData.weekly[0].boss
const PERIOD = '2026-08-06'

const load = jest.fn()
const savePrice = jest.fn()
const excludePrice = jest.fn()

function 드롭(overrides: Partial<RecordedDrop> = {}): RecordedDrop {
  return { category: 'equipment', itemName: '루즈 컨트롤 머신 마크', quantity: 1, ...overrides }
}

function 항목(overrides: Partial<DropPriceEntry> = {}): DropPriceEntry {
  return {
    id: `ocid-1|${주간보스}|하드|${PERIOD}|0`,
    ocid: 'ocid-1',
    boss: 주간보스,
    difficulty: '하드',
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

function mockStores(options: { price?: Partial<PriceStore>; tab?: 'weekly' | 'monthly'; periodKey?: string } = {}): void {
  mockedProfitStore.mockReturnValue({
    tab: options.tab ?? 'weekly',
    periodKey: options.periodKey ?? PERIOD,
  } as unknown as ReturnType<typeof useBossProfitStore>)

  mockedPriceStore.mockReturnValue({
    status: 'ready',
    periodKey: PERIOD,
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

describe('DropPriceScreen — 기간을 이어받는다 ([[ADR-124]] 결정 8)', () => {
  it('보스 수익에서 보던 주를 그대로 연다', async () => {
    await renderOverlay(<DropPriceScreen />)

    expect(load).toHaveBeenCalledWith(PERIOD)
  })

  // 처음엔 주 단위로만 열었는데, 그러면 **월간 보스 드롭에 닿을 길이 없었다**(사용자 보고
  // 2026-08-10) — 그 기록의 `period_key` 는 `YYYY-MM` 이라 어느 주차 조회에도 안 걸린다.
  it('월간 탭에서 들어오면 그 달을 연다', async () => {
    mockStores({ tab: 'monthly', periodKey: '2026-08' })
    await renderOverlay(<DropPriceScreen />)

    expect(load).toHaveBeenCalledWith('2026-08')
  })

  it('월간으로 열면 기간 이동도 달 단위다', async () => {
    mockStores({ tab: 'monthly', periodKey: '2026-08' })
    const { getByLabelText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('이전 기간'))
    })

    expect(load).toHaveBeenCalledWith('2026-07')
  })

  it('월간으로 열면 문구도 달로 말한다', async () => {
    mockStores({ tab: 'monthly', periodKey: '2026-08', price: { groups: [] } })
    const { getByText } = await renderOverlay(<DropPriceScreen />)

    expect(getByText('이 달에 기록된 아이템이 없습니다')).toBeTruthy()
  })

  it('더 갈 수 없는 과거에서는 이전 기간 버튼이 잠긴다', async () => {
    mockStores({ periodKey: '2025-01-02' })
    const { getByLabelText } = await renderOverlay(<DropPriceScreen />)

    expect(getByLabelText('이전 기간').props.accessibilityState.disabled).toBe(true)
  })

  it('뒤로는 pop 이다 — 딥링크가 없어 돌아갈 곳을 계산하지 않는다', async () => {
    const { getByLabelText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('뒤로'))
    })

    expect(goBack).toHaveBeenCalled()
  })
})

describe('DropPriceScreen — 값 매기기', () => {
  it('행을 탭하면 그 기록을 들고 키패드가 열리고, 저장하면 스토어로 간다', async () => {
    const { getByLabelText, getByText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크 가격 입력'))
    })
    // 단위 칩으로 값을 만든다 — 자릿수를 세지 않게 하는 것이 이 칩의 존재 이유다.
    await act(async () => {
      fireEvent.press(getByText('+1억'))
    })
    await act(async () => {
      fireEvent.press(getByText('저장'))
    })

    expect(savePrice).toHaveBeenCalledWith(
      expect.objectContaining({ boss: 주간보스 }),
      100_000_000,
      3,
    )
  })

  it('분배 인원 기본값은 그 행의 파티원 수다', async () => {
    const { getByLabelText, getByText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크 가격 입력'))
    })

    expect(getByText('3인')).toBeTruthy()
  })

  it('저장이 실패하면 토스트로 알린다 — 조용히 삼키면 저장된 줄 알고 떠난다', async () => {
    savePrice.mockRejectedValue(new Error('쓰기 실패'))
    const { getByLabelText, getByText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크 가격 입력'))
    })
    await act(async () => {
      fireEvent.press(getByText('+1억'))
    })
    await act(async () => {
      fireEvent.press(getByText('저장'))
    })

    expect(mockShowError).toHaveBeenCalledWith('가격을 저장하지 못했습니다')
  })

  it('조회 실패는 빈 목록으로 위장하지 않는다 ([[ADR-062]])', async () => {
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

// **미입력은 0원이 아니다** — 이 화면이 그 구분을 가장 직접적으로 보여주는 자리다.
describe('DropPriceScreen — 미입력 ≠ 0원 ([[ADR-124]])', () => {
  it('미입력 행의 금액 자리에는 0 이 아니라 "입력" 이 선다', async () => {
    const { getByLabelText } = await renderOverlay(<DropPriceScreen />)

    // **행 안으로 좁혀 묻는다** — 합계 두 자리(캐릭터 머리·요약 헤드라인)는 `0 메소` 가 맞다.
    // 아무것도 안 매겼으니 더한 값이 0인 것이고, 그것과 *"이 기록의 값을 모른다"* 는 다른 사실이다.
    const row = within(getByLabelText('루즈 컨트롤 머신 마크 가격 입력'))
    expect(row.getByText('입력')).toBeTruthy()
    expect(row.queryByText(/메소/)).toBeNull()
    expect(row.queryByText('0')).toBeNull()
  })

  // 가장 강한 반례 — `priceMeso ?? 0` 계열로 그리면 여기서 금액이 샌다.
  it('priceMeso 는 있고 priceState 가 없는 기록은 여전히 미입력이고 합계를 안 움직인다', async () => {
    mockStores({
      price: { groups: 그룹([항목({ drop: 드롭({ priceMeso: 9_000_000_000 }) })]) },
    })
    const { getByLabelText, getAllByText, queryByText } = await renderOverlay(<DropPriceScreen />)

    expect(within(getByLabelText('루즈 컨트롤 머신 마크 가격 입력')).getByText('입력')).toBeTruthy()
    expect(queryByText('90억')).toBeNull()
    expect(queryByText(/9,000,000,000/)).toBeNull()
    // 캐릭터 합계와 요약 헤드라인 둘 다 0 이다 — 값을 매기지 않았으므로 더할 것이 없다.
    expect(getAllByText('0 메소')).toHaveLength(2)
  })

  it('기록 안함은 미입력과 다른 얼굴이고 미입력 카운트에서 빠진다', async () => {
    mockStores({
      price: {
        groups: 그룹([
          항목({ drop: 드롭({ priceState: 'excluded' }) }),
          항목({ id: 'second', dropIndex: 1, drop: 드롭({ itemName: '가디언 엔젤 링' }) }),
        ]),
      },
    })
    const { getByText } = await renderOverlay(<DropPriceScreen />)

    expect(getByText('기록 안함')).toBeTruthy()
    expect(getByText('기록 안함 1')).toBeTruthy()
    expect(getByText('미입력 1')).toBeTruthy()
    expect(getByText('1 / 2 정함')).toBeTruthy()
  })

  it('값을 매긴 행만 인원을 말한다 — 미입력에 "1인" 이 서면 정해진 값처럼 읽힌다', async () => {
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

    expect(getByText(new RegExp(`${주간보스} · 3인`))).toBeTruthy()
    expect(queryByText(/1인$/)).toBeNull()
  })

  it('다 매기면 미입력 칩 대신 한 줄 문구가 선다', async () => {
    mockStores({
      price: {
        groups: 그룹([항목({ drop: 드롭({ priceState: 'entered', priceMeso: 100, priceShare: 1 }) })]),
      },
    })
    const { getByText, queryByText } = await renderOverlay(<DropPriceScreen />)

    expect(getByText('이 주는 다 정했습니다')).toBeTruthy()
    expect(queryByText(/미입력/)).toBeNull()
  })
})

describe('DropPriceScreen — 표시 규칙 정정 (2026-08-10)', () => {
  it('상자명은 쓰지 않는다 — 이름이 길어 아이템명과 보스를 밀어냈다', async () => {
    mockStores({
      price: {
        groups: 그룹([
          항목({
            drop: 드롭({
              category: 'consumable',
              itemName: '리스트레인트 링',
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

  it('고가 아이템 행에는 골드 배경이 깔린다 — 보스 행과 같은 표현이다 ([[ADR-045]] 결정 5)', async () => {
    const 고가 = weeklyBossesData.weekly[0].boss
    mockStores({
      price: { groups: 그룹([항목({ boss: 고가, drop: 드롭({ itemName: '루즈 컨트롤 머신 마크' }) })]) },
    })
    const { queryByTestId } = await renderOverlay(<DropPriceScreen />)

    expect(queryByTestId('valuable-drop-row-tint')).toBeTruthy()
  })

  it('고가가 아닌 행에는 그 배경을 만들지 않는다', async () => {
    mockStores({ price: { groups: 그룹([항목({ drop: 드롭({ itemName: '주문의 흔적' }) })]) } })
    const { queryByTestId } = await renderOverlay(<DropPriceScreen />)

    expect(queryByTestId('valuable-drop-row-tint')).toBeNull()
  })
})

// **스킵과 기록 안함은 다른 일이다**([[ADR-124]] 결정 6 정정).
//   기록 안함 = "값을 매길 만하지 않다"는 결정 → 저장한다(미입력에서 빠진다)
//   스킵       = "아직 안 팔렸다, 팔리면 넣겠다" → **아무것도 저장하지 않고** 미입력에 머문다
describe('DropPriceScreen — 순차 입력', () => {
  it('"기록 안함" 은 결정을 저장한다', async () => {
    const { getByLabelText, getByText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크 가격 입력'))
    })
    await act(async () => {
      fireEvent.press(getByText('기록 안함'))
    })

    expect(excludePrice).toHaveBeenCalledWith(expect.objectContaining({ boss: 주간보스 }))
  })

  it('단건 편집에는 스킵이 없다 — 닫으면 같은 일이라 버튼을 늘리지 않는다', async () => {
    const { getByLabelText, queryByText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('루즈 컨트롤 머신 마크 가격 입력'))
    })

    expect(queryByText('스킵')).toBeNull()
  })

  it('순차 모드의 스킵은 아무것도 저장하지 않고 다음 건으로만 간다', async () => {
    mockStores({
      price: {
        groups: 그룹([
          항목(),
          항목({ id: 'second', dropIndex: 1, drop: 드롭({ itemName: '가디언 엔젤 링' }) }),
        ]),
      },
    })
    const { getByText, getByTestId, queryByText } = await renderOverlay(<DropPriceScreen />)

    await act(async () => {
      fireEvent.press(getByText('미입력 2건 이어서 입력'))
    })
    await act(async () => {
      fireEvent.press(getByText('스킵'))
    })

    expect(excludePrice).not.toHaveBeenCalled()
    expect(savePrice).not.toHaveBeenCalled()
    // 다음 건으로 넘어갔다 — 목록에도 같은 이름이 있으므로 키패드 안으로 좁힌다.
    expect(within(getByTestId('drop-price-pad')).getByText('가디언 엔젤 링')).toBeTruthy()
    // 마지막 건이라 진행 표기가 사라지고 버튼도 `다음` 이 아니라 `저장` 이다(웹과 같은 계산).
    expect(within(getByTestId('drop-price-pad')).getByText('저장')).toBeTruthy()
    expect(queryByText('스킵')).toBeNull()
  })
})
