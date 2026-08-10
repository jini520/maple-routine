// @vitest-environment jsdom
// 가격 기록 화면([[ADR-124]] 결정 8) — 보스 수익에서 보던 주를 이어받는지, 값을 매기면 저장까지
// 가는지, 실패를 삼키지 않는지.
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DropPriceScreen } from '../DropPriceScreen'
import { useDropPriceStore } from '../../../features/boss-profit/drop-price-store'
import { useBossProfitStore } from '../../../features/boss-profit/store'

const { showErrorMock } = vi.hoisted(() => ({ showErrorMock: vi.fn() }))
vi.mock('../../../features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: showErrorMock, showSuccess: vi.fn(), showInfo: vi.fn() }) },
}))

const PERIOD = '2026-08-06'
const loadMock = vi.fn()
const savePriceMock = vi.fn()
const excludePriceMock = vi.fn()

function entry(overrides = {}) {
  return {
    id: `ocid-1|스우|하드|${PERIOD}|0`,
    ocid: 'ocid-1',
    boss: '스우',
    difficulty: '하드' as const,
    periodKey: PERIOD,
    dropIndex: 0,
    partySize: 3,
    drop: { category: 'equipment' as const, itemName: '루즈 컨트롤 머신 마크', quantity: 1 },
    ...overrides,
  }
}

function mockPriceStore(overrides = {}): void {
  useDropPriceStore.setState({
    status: 'ready',
    periodKey: PERIOD,
    groups: [{ ocid: 'ocid-1', characterName: '지내우시', imageUrl: null, entries: [entry()] }],
    load: loadMock,
    savePrice: savePriceMock,
    excludePrice: excludePriceMock,
    ...overrides,
  })
}

beforeEach(() => {
  loadMock.mockReset().mockResolvedValue(undefined)
  savePriceMock.mockReset().mockResolvedValue(undefined)
  excludePriceMock.mockReset().mockResolvedValue(undefined)
  showErrorMock.mockReset()
  useBossProfitStore.setState({ tab: 'weekly', periodKey: PERIOD })
  mockPriceStore()
})
afterEach(cleanup)

function renderScreen(): void {
  render(
    <MemoryRouter initialEntries={['/profit/prices']}>
      <DropPriceScreen />
    </MemoryRouter>,
  )
}

describe('DropPriceScreen', () => {
  it('보스 수익에서 보던 주를 그대로 연다', () => {
    renderScreen()

    expect(loadMock).toHaveBeenCalledWith(PERIOD)
  })

  // 처음엔 주 단위로만 열었는데, 그러면 **월간 보스 드롭에 닿을 길이 없었다**(사용자 보고
  // 2026-08-10) — 그 기록의 `period_key` 는 `YYYY-MM` 이라 어느 주차 조회에도 안 걸린다.
  it('월간 탭에서 들어오면 그 달을 연다 — 월간 보스 드롭도 값을 매길 수 있어야 한다', () => {
    useBossProfitStore.setState({ tab: 'monthly', periodKey: '2026-08' })
    renderScreen()

    expect(loadMock).toHaveBeenCalledWith('2026-08')
  })

  it('월간으로 열면 기간 이동도 달 단위다', () => {
    useBossProfitStore.setState({ tab: 'monthly', periodKey: '2026-08' })
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: '이전 기간' }))

    expect(loadMock).toHaveBeenCalledWith('2026-07')
  })

  it('월간으로 열면 문구도 달로 말한다', () => {
    useBossProfitStore.setState({ tab: 'monthly', periodKey: '2026-08' })
    mockPriceStore({ groups: [] })
    renderScreen()

    expect(screen.getByText('이 달에 기록된 아이템이 없습니다')).toBeInTheDocument()
  })

  it('행을 탭하면 키패드가 열리고, 저장하면 스토어로 간다', async () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))

    // 단위 칩으로 값을 만든다 — 자릿수를 세지 않게 하는 것이 이 칩의 존재 이유다.
    fireEvent.click(screen.getByRole('button', { name: '+1억' }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(savePriceMock).toHaveBeenCalledWith(expect.objectContaining({ boss: '스우' }), 100_000_000, 3)
    })
  })

  it('분배 인원 기본값은 그 행의 파티원 수다', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))

    expect(screen.getByText('3인')).toBeInTheDocument()
  })

  it('저장이 실패하면 토스트로 알린다 — 조용히 삼키면 저장된 줄 알고 떠난다', async () => {
    savePriceMock.mockRejectedValue(new Error('쓰기 실패'))
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))
    fireEvent.click(screen.getByRole('button', { name: '+1억' }))
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(showErrorMock).toHaveBeenCalledWith('가격을 저장하지 못했습니다')
    })
  })

  it('조회 실패는 빈 목록으로 위장하지 않는다', () => {
    mockPriceStore({ status: 'failed', groups: [] })
    renderScreen()

    expect(screen.getByText('가격 기록을 불러오지 못했습니다')).toBeInTheDocument()
  })
})

// 2026-08-10 사용자 수정 요청 묶음.
describe('표시 규칙 정정', () => {
  it('상자명은 쓰지 않고 인원은 "n인" 까지만 — 이름이 길어 아이템명을 밀어냈다', () => {
    mockPriceStore({
      groups: [
        {
          ocid: 'ocid-1',
          characterName: '지내우시',
          imageUrl: null,
          entries: [
            entry({
              drop: {
                category: 'consumable' as const,
                itemName: '리스트레인트 링',
                boxOrigin: '홍옥의 보스 반지 상자',
                ringLevel: 3,
                quantity: 1,
                priceState: 'entered' as const,
                priceMeso: 1_200_000_000,
                priceShare: 3,
              },
            }),
          ],
        },
      ],
    })
    renderScreen()

    expect(screen.queryByText(/홍옥의 보스 반지 상자/)).not.toBeInTheDocument()
    expect(screen.getByText(/3인$/)).toBeInTheDocument()
    expect(screen.queryByText(/3인 분배/)).not.toBeInTheDocument()
  })

  it('스킵 상태는 "skip" 으로 쓴다', () => {
    mockPriceStore({
      groups: [
        {
          ocid: 'ocid-1',
          characterName: '지내우시',
          imageUrl: null,
          entries: [entry({ drop: { category: 'equipment' as const, itemName: '가디언 엔젤 링', quantity: 1, priceState: 'excluded' as const } })],
        },
      ],
    })
    renderScreen()

    expect(screen.getByText('기록 안함')).toBeInTheDocument()
  })

  it('기록이 없으면 아이템 어휘로 말한다', () => {
    mockPriceStore({ groups: [] })
    renderScreen()

    expect(screen.getByText('이 주에 기록된 아이템이 없습니다')).toBeInTheDocument()
    expect(screen.getByText(/보스 수익에서 아이템을 먼저 기록하면/)).toBeInTheDocument()
  })

  it('더 갈 수 없는 과거에서는 이전 기간 버튼이 잠긴다', () => {
    useBossProfitStore.setState({ tab: 'weekly', periodKey: '2025-01-02' })
    renderScreen()

    expect(screen.getByRole('button', { name: '이전 기간' })).toBeDisabled()
  })
})

// 2026-08-10 사용자 지정 — **스킵과 기록 안함은 다른 일이다.**
//   기록 안함 = "값을 매길 만하지 않다"는 결정 → 저장한다(미입력에서 빠진다)
//   스킵       = "아직 안 팔렸다, 팔리면 넣겠다" → **아무것도 저장하지 않고** 미입력에 머문다
describe('기록 안함 vs 스킵 (ADR-124 결정 6 정정)', () => {
  it('"기록 안함" 은 결정을 저장한다', async () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))

    fireEvent.click(screen.getByRole('button', { name: '기록 안함' }))

    await waitFor(() => {
      expect(excludePriceMock).toHaveBeenCalledWith(expect.objectContaining({ boss: '스우' }))
    })
  })

  it('단건 편집에는 스킵이 없다 — 닫으면 같은 일이라 버튼을 늘리지 않는다', () => {
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))

    expect(screen.queryByRole('button', { name: '스킵' })).not.toBeInTheDocument()
  })

  it('순차 모드의 스킵은 아무것도 저장하지 않고 다음 건으로만 간다', () => {
    mockPriceStore({
      groups: [
        {
          ocid: 'ocid-1',
          characterName: '지내우시',
          imageUrl: null,
          entries: [
            entry(),
            entry({ id: 'second', dropIndex: 1, drop: { category: 'equipment', itemName: '가디언 엔젤 링', quantity: 1 } }),
          ],
        },
      ],
    })
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /미입력 2건 이어서 입력/ }))

    fireEvent.click(screen.getByRole('button', { name: '스킵' }))

    expect(excludePriceMock).not.toHaveBeenCalled()
    expect(savePriceMock).not.toHaveBeenCalled()
    // 다음 건으로 넘어갔다 — 목록에도 같은 이름이 있으므로 키패드 안으로 좁힌다.
    expect(within(screen.getByTestId('drop-price-pad')).getByText('가디언 엔젤 링')).toBeInTheDocument()
  })
})
