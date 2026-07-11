// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BossProfitScreen } from '../BossProfitScreen'
import { useBossProfitStore, type BossProfitRow } from '../../../features/boss-profit/store'

vi.mock('../../../features/boss-profit/store', () => ({
  useBossProfitStore: vi.fn(),
}))

const mockedUseBossProfitStore = vi.mocked(useBossProfitStore)

function mockStore(overrides: Partial<ReturnType<typeof useBossProfitStore>>): void {
  mockedUseBossProfitStore.mockReturnValue({
    status: 'idle',
    rows: [],
    error: null,
    staleCharacterNames: [],
    trackedOcids: null,
    loadTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    setPartySize: vi.fn(),
    ...overrides,
  })
}

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    boss: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    periodKey: '2026-07-09',
    periodLabel: '이번 주',
    priceMeso: 10_000_000,
    maxPartySize: 6,
    partySize: null,
    payoutMeso: null,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BossProfitScreen', () => {
  it('마운트 시 loadTrackedOcids가 1회 호출된다', () => {
    const loadTrackedOcids = vi.fn()
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()], loadTrackedOcids })

    render(<BossProfitScreen />)

    expect(loadTrackedOcids).toHaveBeenCalledTimes(1)
  })

  it('trackedOcids가 null이면 빈 상태 안내만 보인다', () => {
    mockStore({ status: 'loaded', trackedOcids: null, rows: [] })

    render(<BossProfitScreen />)

    expect(
      screen.getByText('추적 중인 캐릭터가 없습니다 — 보스 스케줄러에서 캐릭터를 선택해주세요'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '캐릭터 관리' })).not.toBeInTheDocument()
  })

  it('trackedOcids가 빈 배열이면 빈 상태 안내만 보인다', () => {
    mockStore({ status: 'loaded', trackedOcids: [], rows: [] })

    render(<BossProfitScreen />)

    expect(
      screen.getByText('추적 중인 캐릭터가 없습니다 — 보스 스케줄러에서 캐릭터를 선택해주세요'),
    ).toBeInTheDocument()
  })

  it('status가 loading이면 로딩 표시를 보여준다', () => {
    mockStore({ status: 'loading', trackedOcids: ['ocid-1'], rows: [] })

    render(<BossProfitScreen />)

    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('status가 error이면 에러 문구를 보여준다', () => {
    mockStore({ status: 'error', trackedOcids: ['ocid-1'], error: { kind: 'invalidApiKey' }, rows: [] })

    render(<BossProfitScreen />)

    expect(screen.getByText('API 키가 유효하지 않습니다')).toBeInTheDocument()
  })

  it('추적 캐릭터는 있지만 처치한 보스가 없으면 빈 상태 문구를 보여준다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [] })

    render(<BossProfitScreen />)

    expect(screen.getByText('아직 처치한 보스가 없습니다')).toBeInTheDocument()
  })

  it('새로고침 버튼을 클릭하면 refresh가 추적 목록으로 호출된다', () => {
    const refresh = vi.fn()
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()], refresh })

    render(<BossProfitScreen />)
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }))

    expect(refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  it('stale 캐릭터가 있으면 안내 문구가 보인다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      staleCharacterNames: ['낟낟'],
    })

    render(<BossProfitScreen />)

    expect(screen.getByText(/일부 캐릭터 동기화 실패: 낟낟/)).toBeInTheDocument()
  })

  it('rows를 이번 주/이번 달 섹션으로 분리해 렌더링하고 각 섹션 합계를 보여준다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [
        row({ boss: '자쿰', difficulty: '카오스', periodLabel: '이번 주', priceMeso: 10_000_000, partySize: 2, payoutMeso: 5_000_000 }),
        row({
          boss: '검은마법사',
          difficulty: '익스트림',
          cycle: 'monthly',
          periodKey: '2026-07',
          periodLabel: '이번 달',
          priceMeso: 20_000_000,
          partySize: 4,
          payoutMeso: 5_000_000,
        }),
      ],
    })

    render(<BossProfitScreen />)

    expect(screen.getByText(/이번 주 합계.*5,000,000 메소/)).toBeInTheDocument()
    expect(screen.getByText(/이번 달 합계.*5,000,000 메소/)).toBeInTheDocument()
    expect(screen.getByText(/낟낟 · 자쿰 · 카오스/)).toBeInTheDocument()
    expect(screen.getByText(/낟낟 · 검은마법사 · 익스트림/)).toBeInTheDocument()
  })

  it('priceMeso가 null이면 가격 미확정 배지를 보여준다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row({ boss: '벨로나', priceMeso: null, maxPartySize: 6 })],
    })

    render(<BossProfitScreen />)

    expect(screen.getByText('가격 미확정')).toBeInTheDocument()
  })

  it('priceMeso가 있고 partySize가 null이면 입력 안내 문구를 보여준다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row({ priceMeso: 10_000_000, partySize: null, payoutMeso: null })],
    })

    render(<BossProfitScreen />)

    expect(screen.getByText('파티원 수를 입력해주세요')).toBeInTheDocument()
  })

  it('payoutMeso가 있으면 메소 단위로 표시한다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row({ priceMeso: 10_000_000, partySize: 2, payoutMeso: 5_000_000 })],
    })

    render(<BossProfitScreen />)

    expect(screen.getByText('5,000,000 메소')).toBeInTheDocument()
  })

  it('파티원 수 입력 후 blur하면 setPartySize가 호출된다', async () => {
    const setPartySize = vi.fn().mockResolvedValue(undefined)
    const targetRow = row({ priceMeso: 10_000_000, partySize: null, payoutMeso: null })
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [targetRow], setPartySize })

    render(<BossProfitScreen />)
    const input = screen.getByRole('spinbutton', { name: /낟낟 자쿰 카오스 파티원 수/ })
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(setPartySize).toHaveBeenCalledWith(
        expect.objectContaining({ ocid: 'ocid-1', boss: '자쿰', difficulty: '카오스' }),
        3,
      )
    })
  })

  it('setPartySize가 실패하면 입력 필드 아래에 에러 문구를 보여주고 흐름을 막지 않는다', async () => {
    const setPartySize = vi.fn().mockRejectedValue(new Error('파티원 수는 1 이상 6 이하의 정수여야 합니다'))
    const targetRow = row({ priceMeso: 10_000_000, partySize: null, payoutMeso: null })
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [targetRow], setPartySize })

    render(<BossProfitScreen />)
    const input = screen.getByRole('spinbutton', { name: /낟낟 자쿰 카오스 파티원 수/ })
    fireEvent.change(input, { target: { value: '99' } })
    fireEvent.blur(input)

    expect(await screen.findByText('파티원 수는 1 이상 6 이하의 정수여야 합니다')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /낟낟 자쿰 카오스 파티원 수/ })).toBeInTheDocument()
  })
})
