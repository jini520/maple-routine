// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BossProfitScreen } from '../BossProfitScreen'
import {
  useBossProfitStore,
  type BossProfitRow,
  type BossProfitWeeklySubtotal,
} from '../../../features/boss-profit/store'

vi.mock('../../../features/boss-profit/store', () => ({
  useBossProfitStore: vi.fn(),
}))

const mockedUseBossProfitStore = vi.mocked(useBossProfitStore)

function mockStore(overrides: Partial<ReturnType<typeof useBossProfitStore>>): void {
  mockedUseBossProfitStore.mockReturnValue({
    status: 'idle',
    tab: 'weekly',
    periodKey: '2026-07-09',
    rows: [],
    weeklySubtotals: [],
    isPeriodLoading: false,
    periodUnavailable: false,
    error: null,
    staleCharacterNames: [],
    trackedOcids: null,
    loadTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    setTab: vi.fn(),
    goToPreviousPeriod: vi.fn(),
    goToNextPeriod: vi.fn(),
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
    partySize: 2,
    payoutMeso: 5_000_000,
    ...overrides,
  }
}

function subtotal(overrides: Partial<BossProfitWeeklySubtotal> = {}): BossProfitWeeklySubtotal {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    periodKey: '2026-07-09',
    totalMeso: 5_000_000,
    state: 'confirmed',
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BossProfitScreen', () => {
  it('제목이 "보스 수익"으로 렌더된다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()] })

    render(<BossProfitScreen />)

    expect(screen.getByRole('heading', { name: '보스 수익' })).toBeInTheDocument()
  })

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
  })

  it('trackedOcids가 빈 배열이면 빈 상태 안내만 보인다', () => {
    mockStore({ status: 'loaded', trackedOcids: [], rows: [] })

    render(<BossProfitScreen />)

    expect(
      screen.getByText('추적 중인 캐릭터가 없습니다 — 보스 스케줄러에서 캐릭터를 선택해주세요'),
    ).toBeInTheDocument()
  })

  it('주간/월간 탭 클릭 시 setTab이 호출된다', () => {
    const setTab = vi.fn()
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()], setTab })

    render(<BossProfitScreen />)
    fireEvent.click(screen.getByRole('button', { name: '월간' }))
    expect(setTab).toHaveBeenCalledWith('monthly')

    fireEvent.click(screen.getByRole('button', { name: '주간' }))
    expect(setTab).toHaveBeenCalledWith('weekly')
  })

  it('‹/› 버튼 클릭 시 goToPreviousPeriod/goToNextPeriod가 호출된다', () => {
    const goToPreviousPeriod = vi.fn()
    const goToNextPeriod = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      periodKey: '2020-01-02',
      goToPreviousPeriod,
      goToNextPeriod,
    })

    render(<BossProfitScreen />)
    fireEvent.click(screen.getByRole('button', { name: '이전 기간' }))
    expect(goToPreviousPeriod).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '다음 기간' }))
    expect(goToNextPeriod).toHaveBeenCalledTimes(1)
  })

  it('최신 기간에서는 다음 기간 버튼이 disabled다', () => {
    const now = new Date()
    mockStore({
      status: 'loaded',
      tab: 'monthly',
      trackedOcids: ['ocid-1'],
      rows: [],
      weeklySubtotals: [subtotal()],
      periodKey: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
    })

    render(<BossProfitScreen />)

    expect(screen.getByRole('button', { name: '다음 기간' })).toBeDisabled()
  })

  it('과거 기간에서는 다음 기간 버튼이 활성 상태다', () => {
    mockStore({
      status: 'loaded',
      tab: 'monthly',
      trackedOcids: ['ocid-1'],
      rows: [],
      weeklySubtotals: [subtotal()],
      periodKey: '2000-01',
    })

    render(<BossProfitScreen />)

    expect(screen.getByRole('button', { name: '다음 기간' })).not.toBeDisabled()
  })

  it('isPeriodLoading이 true면 스피너를 보여주고 보스 목록은 렌더되지 않는다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      isPeriodLoading: true,
    })

    render(<BossProfitScreen />)

    expect(screen.getByText(/기록을 불러오는 중/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /낟낟/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/총 수익/)).not.toBeInTheDocument()
  })

  it('periodUnavailable이 true면 안내 문구를 보여준다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [],
      periodUnavailable: true,
    })

    render(<BossProfitScreen />)

    expect(screen.getByText('이 기간을 불러오지 못했습니다 — 다시 시도해주세요')).toBeInTheDocument()
  })

  it('status가 loading이고 캐릭터 그룹이 없으면 로딩 표시를 보여준다', () => {
    mockStore({ status: 'loading', trackedOcids: ['ocid-1'], rows: [] })

    render(<BossProfitScreen />)

    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('ADR-017: status가 loading이어도 캐시된 rows가 있으면 로딩 표시 대신 목록을 계속 보여준다', () => {
    mockStore({
      status: 'loading',
      trackedOcids: ['ocid-1'],
      rows: [row()],
    })

    render(<BossProfitScreen />)

    expect(screen.queryByText(/불러오는 중/)).not.toBeInTheDocument()
    expect(screen.getByText(/총 수익/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
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

  it('캐릭터별 드롭다운은 기본 상태에서 접혀 있어 보스 행이 보이지 않는다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()] })

    render(<BossProfitScreen />)

    expect(screen.queryByText('자쿰')).not.toBeInTheDocument()
  })

  it('드롭다운 헤더를 클릭하면 펼쳐져 보스 행과 합계 footer가 보이고, 다시 클릭하면 접힌다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()] })

    render(<BossProfitScreen />)
    const header = screen.getByRole('button', { name: /낟낟/ })

    fireEvent.click(header)
    expect(screen.getByText('자쿰')).toBeInTheDocument()
    expect(screen.getByText('낟낟 합계')).toBeInTheDocument()

    fireEvent.click(header)
    expect(screen.queryByText('자쿰')).not.toBeInTheDocument()
  })

  it('압축 스테퍼의 + 클릭 시 setPartySize가 호출된다', async () => {
    const setPartySize = vi.fn().mockResolvedValue(undefined)
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row({ partySize: 2 })], setPartySize })

    render(<BossProfitScreen />)
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))
    fireEvent.click(screen.getByRole('button', { name: '낟낟 자쿰 카오스 파티원 수 증가' }))

    await waitFor(() => {
      expect(setPartySize).toHaveBeenCalledWith(
        expect.objectContaining({ ocid: 'ocid-1', boss: '자쿰', difficulty: '카오스' }),
        3,
      )
    })
  })

  it('압축 스테퍼의 - 클릭이 실패하면 에러 문구를 보여준다', async () => {
    const setPartySize = vi.fn().mockRejectedValue(new Error('파티원 수는 1 이상 6 이하의 정수여야 합니다'))
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row({ partySize: 2 })], setPartySize })

    render(<BossProfitScreen />)
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))
    fireEvent.click(screen.getByRole('button', { name: '낟낟 자쿰 카오스 파티원 수 감소' }))

    expect(await screen.findByText('파티원 수는 1 이상 6 이하의 정수여야 합니다')).toBeInTheDocument()
  })

  it('priceMeso가 null이면 가격 미확정 배지를 보여주고 스테퍼가 비활성화된다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row({ boss: '벨로나', priceMeso: null, partySize: null, payoutMeso: null })],
    })

    render(<BossProfitScreen />)
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByText('가격 미확정')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '낟낟 벨로나 카오스 파티원 수 증가' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '낟낟 벨로나 카오스 파티원 수 감소' })).toBeDisabled()
  })

  it('payoutMeso가 있으면 메소 단위로 표시한다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row({ priceMeso: 10_000_000, partySize: 2, payoutMeso: 5_000_000 })],
    })

    render(<BossProfitScreen />)
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByRole('listitem')).toHaveTextContent('5,000,000 메소')
  })

  it('weekly 탭: 여러 캐릭터의 총 수익이 상단에 합산되어 표시된다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1', 'ocid-2'],
      rows: [
        row({ ocid: 'ocid-1', characterName: '낟낟', payoutMeso: 5_000_000 }),
        row({
          ocid: 'ocid-2',
          characterName: '내옆에최성일',
          boss: '루시드',
          priceMeso: 6_000_000,
          partySize: 2,
          payoutMeso: 3_000_000,
        }),
      ],
    })

    render(<BossProfitScreen />)

    expect(screen.getByText(/총 수익/)).toBeInTheDocument()
    expect(screen.getByText('8,000,000 메소')).toBeInTheDocument()
  })

  it('rows가 비어있으면 상단 합계 카드 없이 빈 상태 문구만 보인다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [] })

    render(<BossProfitScreen />)

    expect(screen.getByText('아직 처치한 보스가 없습니다')).toBeInTheDocument()
    expect(screen.queryByText(/총 수익/)).not.toBeInTheDocument()
  })

  it('monthly 탭: 주차별 합계 서브섹션과 월간 보스 서브섹션이 각각 렌더된다', () => {
    mockStore({
      status: 'loaded',
      tab: 'monthly',
      periodKey: '2026-07',
      trackedOcids: ['ocid-1'],
      rows: [
        row({
          boss: '검은마법사',
          difficulty: '익스트림',
          cycle: 'monthly',
          periodKey: '2026-07',
          priceMeso: 20_000_000,
          partySize: 4,
          payoutMeso: 5_000_000,
        }),
      ],
      weeklySubtotals: [
        subtotal({ periodKey: '2026-07-02', totalMeso: 5_000_000, state: 'confirmed' }),
        subtotal({ periodKey: '2026-07-09', totalMeso: 3_000_000, state: 'inProgress' }),
        subtotal({ periodKey: '2026-07-16', totalMeso: 0, state: 'upcoming' }),
      ],
    })

    render(<BossProfitScreen />)
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByText('주간 보스 수익 · 주차별 합계')).toBeInTheDocument()
    expect(screen.getByText('월간 보스 수익')).toBeInTheDocument()
    expect(screen.getByText('검은마법사')).toBeInTheDocument()
    expect(screen.getByText('진행 중')).toBeInTheDocument()
    expect(screen.getByText('예정')).toBeInTheDocument()
  })

  it('monthly 탭: 아직 시작하지 않은 주는 흐리게(opacity-40) 표시된다', () => {
    mockStore({
      status: 'loaded',
      tab: 'monthly',
      periodKey: '2026-07',
      trackedOcids: ['ocid-1'],
      rows: [],
      weeklySubtotals: [subtotal({ periodKey: '2026-07-16', totalMeso: 0, state: 'upcoming' })],
    })

    render(<BossProfitScreen />)
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    const upcomingLabel = screen.getByText('예정')
    const upcomingRow = upcomingLabel.closest('li')
    expect(upcomingRow).toHaveClass('opacity-40')
  })

  it('monthly 탭: 월간 보스 기록이 없는 캐릭터도 주차별 합계만으로 그룹이 생성된다', () => {
    mockStore({
      status: 'loaded',
      tab: 'monthly',
      periodKey: '2026-07',
      trackedOcids: ['ocid-1'],
      rows: [],
      weeklySubtotals: [subtotal({ periodKey: '2026-07-02', totalMeso: 5_000_000, state: 'confirmed' })],
    })

    render(<BossProfitScreen />)

    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
    expect(screen.queryByText('아직 처치한 보스가 없습니다')).not.toBeInTheDocument()
  })

  it('드롭다운 헤더에 그 캐릭터의 합계만 표시되고 다른 캐릭터 수익이 섞이지 않는다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1', 'ocid-2'],
      rows: [
        row({ ocid: 'ocid-1', characterName: '낟낟', payoutMeso: 5_000_000 }),
        row({
          ocid: 'ocid-2',
          characterName: '내옆에최성일',
          boss: '루시드',
          priceMeso: 6_000_000,
          partySize: 2,
          payoutMeso: 3_000_000,
        }),
      ],
    })

    render(<BossProfitScreen />)

    expect(screen.getByRole('button', { name: /낟낟.*5,000,000 메소/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /내옆에최성일.*3,000,000 메소/ })).toBeInTheDocument()
  })
})
