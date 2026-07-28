// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BossProfitScreen } from '../BossProfitScreen'
import {
  useBossProfitStore,
  type BossProfitRow,
  type BossProfitWeeklySubtotal,
} from '../../../features/boss-profit/store'
import { getCurrentBossProfitPeriod } from '../../../lib/boss-profit-period'

// 새로고침 버튼·다음 기간 버튼은 "현재 기간"에서만 각각 노출/비활성되므로, 실행 시점과 무관하게
// 항상 현재 기간을 가리키도록 실제 계산값을 쓴다.
const CURRENT_WEEKLY_PERIOD_KEY = getCurrentBossProfitPeriod('weekly', new Date()).periodKey

vi.mock('../../../features/boss-profit/store', () => ({
  useBossProfitStore: vi.fn(),
  dropRowKey: (ocid: string, boss: string, difficulty: string, periodKey: string) =>
    `${ocid}|${boss}|${difficulty}|${periodKey}`,
}))

const mockedUseBossProfitStore = vi.mocked(useBossProfitStore)

function mockStore(overrides: Partial<ReturnType<typeof useBossProfitStore>>): void {
  mockedUseBossProfitStore.mockReturnValue({
    status: 'idle',
    tab: 'weekly',
    periodKey: '2026-07-09',
    rows: [],
    dropsByRowKey: {},
    weeklySubtotals: [],
    isPeriodLoading: false,
    periodUnavailable: false,
    canGoPreviousPeriod: true,
    error: null,
    staleCharacterNames: [],
    trackedOcids: null,
    lastSyncedAt: null,
    loadTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    setTab: vi.fn(),
    goToPreviousPeriod: vi.fn(),
    goToNextPeriod: vi.fn(),
    setPartySize: vi.fn(),
    setBossDrops: vi.fn(),
    ...overrides,
  })
}

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    imageUrl: null,
    boss: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    periodKey: '2026-07-09',
    periodLabel: '이번 주',
    priceMeso: 10_000_000,
    maxPartySize: 6,
    partySize: 2,
    payoutMeso: 5_000_000,
    isComplete: true,
    ...overrides,
  }
}

function subtotal(overrides: Partial<BossProfitWeeklySubtotal> = {}): BossProfitWeeklySubtotal {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    imageUrl: null,
    periodKey: '2026-07-09',
    totalMeso: 5_000_000,
    state: 'confirmed',
    ...overrides,
  }
}

function renderBossProfitScreen(initialEntries: string[] = ['/profit']): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <BossProfitScreen />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BossProfitScreen', () => {
  it('제목이 "보스 수익"으로 렌더된다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()] })

    renderBossProfitScreen()

    expect(screen.getByRole('heading', { name: '보스 수익' })).toBeInTheDocument()
  })

  it('row.imageUrl이 있으면 캐릭터 아바타에 실제 이미지를 렌더한다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row({ imageUrl: 'https://example.com/ocid-1.png' })],
    })

    renderBossProfitScreen()

    const avatar = screen.getByAltText('낟낟')
    expect(avatar.tagName).toBe('IMG')
    expect(avatar).toHaveAttribute('src', 'https://example.com/ocid-1.png')
  })

  it('row.imageUrl이 null이면 캐릭터 아바타는 이니셜로 폴백한다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row({ imageUrl: null })] })

    renderBossProfitScreen()

    expect(screen.queryByAltText('낟낟')).not.toBeInTheDocument()
    expect(screen.getByText('낟')).toBeInTheDocument()
  })

  it('마운트 시 loadTrackedOcids가 1회 호출된다', () => {
    const loadTrackedOcids = vi.fn()
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()], loadTrackedOcids })

    renderBossProfitScreen()

    expect(loadTrackedOcids).toHaveBeenCalledTimes(1)
  })

  it('trackedOcids가 null이면 빈 상태 안내만 보인다', () => {
    mockStore({ status: 'loaded', trackedOcids: null, rows: [] })

    renderBossProfitScreen()

    expect(screen.getByText('추적 중인 캐릭터가 없습니다')).toBeInTheDocument()
    expect(
      screen.getByText('보스 스케줄러에서 캐릭터를 선택하면 수익 현황을 확인할 수 있습니다'),
    ).toBeInTheDocument()
  })

  it('trackedOcids가 빈 배열이면 빈 상태 안내만 보인다', () => {
    mockStore({ status: 'loaded', trackedOcids: [], rows: [] })

    renderBossProfitScreen()

    expect(screen.getByText('추적 중인 캐릭터가 없습니다')).toBeInTheDocument()
  })

  it('빈 상태의 CTA는 보스 스케줄러의 캐릭터 관리를 자동으로 여는 링크다', () => {
    mockStore({ status: 'loaded', trackedOcids: null, rows: [] })

    renderBossProfitScreen()

    expect(screen.getByRole('link', { name: '캐릭터 선택하러 가기' })).toHaveAttribute(
      'href',
      '/boss?openPicker=1',
    )
  })

  it('주간/월간 탭 클릭 시 setTab이 호출된다', () => {
    const setTab = vi.fn()
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()], setTab })

    renderBossProfitScreen()
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
      periodKey: '2026-07-02',
      goToPreviousPeriod,
      goToNextPeriod,
    })

    renderBossProfitScreen()
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

    renderBossProfitScreen()

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

    renderBossProfitScreen()

    expect(screen.getByRole('button', { name: '다음 기간' })).not.toBeDisabled()
  })

  it('canGoPreviousPeriod가 false면 이전 기간 버튼이 disabled다(#29) — 이전 이동 가능 여부는 store가 판단한다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      canGoPreviousPeriod: false,
    })

    renderBossProfitScreen()

    expect(screen.getByRole('button', { name: '이전 기간' })).toBeDisabled()
  })

  it('canGoPreviousPeriod가 true면 이전 기간 버튼이 활성 상태다(#29)', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      canGoPreviousPeriod: true,
    })

    renderBossProfitScreen()

    expect(screen.getByRole('button', { name: '이전 기간' })).not.toBeDisabled()
  })

  it('isPeriodLoading이 true면 스피너를 보여주고 보스 목록은 렌더되지 않는다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      isPeriodLoading: true,
    })

    renderBossProfitScreen()

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

    renderBossProfitScreen()

    expect(screen.getByText('이 기간을 불러오지 못했습니다 — 다시 시도해주세요')).toBeInTheDocument()
  })

  it('status가 loading이고 캐릭터 그룹이 없으면 로딩 표시를 보여준다', () => {
    mockStore({ status: 'loading', trackedOcids: ['ocid-1'], rows: [] })

    renderBossProfitScreen()

    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('ADR-017: status가 loading이어도 캐시된 rows가 있으면 로딩 표시 대신 목록을 계속 보여준다', () => {
    mockStore({
      status: 'loading',
      trackedOcids: ['ocid-1'],
      rows: [row()],
    })

    renderBossProfitScreen()

    expect(screen.queryByText(/불러오는 중/)).not.toBeInTheDocument()
    expect(screen.getByText(/총 수익/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
  })

  it('status가 error이면 에러 문구를 보여준다', () => {
    mockStore({ status: 'error', trackedOcids: ['ocid-1'], error: { kind: 'invalidApiKey' }, rows: [] })

    renderBossProfitScreen()

    expect(screen.getByText('API 키가 유효하지 않습니다')).toBeInTheDocument()
  })

  it('추적 캐릭터는 있지만 처치한 보스가 없으면 빈 상태 문구를 보여준다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [] })

    renderBossProfitScreen()

    expect(screen.getByText('아직 처치한 보스가 없습니다')).toBeInTheDocument()
  })

  it('weekly 탭: 롤링 윈도우 밖(오늘-13일 이전)이고 rows가 비어있으면 "조회 불가"를 보여준다(ADR-032)', () => {
    // periodKey 2026-07-02의 조회일은 2026-07-08 — 테스트 실행 시점(2026-07-22) 기준 롤링
    // 하한(2026-07-09)보다 이전이라 지금은 API로 조회할 수 없는 기간이다.
    mockStore({ status: 'loaded', tab: 'weekly', periodKey: '2026-07-02', trackedOcids: ['ocid-1'], rows: [] })

    renderBossProfitScreen()

    expect(screen.getByText('조회 불가')).toBeInTheDocument()
    expect(screen.queryByText('아직 처치한 보스가 없습니다')).not.toBeInTheDocument()
  })

  it('현재 기간에서 새로고침 버튼을 클릭하면 refresh가 추적 목록으로 호출된다', () => {
    const refresh = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      periodKey: CURRENT_WEEKLY_PERIOD_KEY,
      refresh,
    })

    renderBossProfitScreen()
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }))

    expect(refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  it('과거 기간에서는 새로고침 버튼도, 마지막 동기화 시각 텍스트도 노출되지 않는다(#30)', () => {
    mockStore({
      status: 'loaded',
      tab: 'weekly',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      periodKey: '2026-07-02', // 과거 기간(현재 주가 아님)
      lastSyncedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    })

    renderBossProfitScreen()

    expect(screen.queryByRole('button', { name: '새로고침' })).not.toBeInTheDocument()
    expect(screen.queryByText('3분 전')).not.toBeInTheDocument() // 동기화 시각 텍스트도 숨김
  })

  it('과거 기간에서는 status가 loading이어도 "조회 중..." 텍스트를 노출하지 않는다(#30)', () => {
    mockStore({
      status: 'loading',
      tab: 'weekly',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      periodKey: '2026-07-02', // 과거 기간
    })

    renderBossProfitScreen()

    expect(screen.queryByText('조회 중...')).not.toBeInTheDocument()
  })

  it('현재 기간에서 status가 loading이면 새로고침 아이콘이 회전하고 조회 중 텍스트를 보여준다', () => {
    mockStore({
      status: 'loading',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      periodKey: CURRENT_WEEKLY_PERIOD_KEY,
    })

    renderBossProfitScreen()

    expect(screen.getByText('조회 중...')).toBeInTheDocument()
    const icon = screen.getByRole('button', { name: '새로고침' }).querySelector('svg')
    expect(icon).toHaveClass('animate-spin')
  })

  it('현재 기간에서 새로고침 아이콘 옆에 마지막 조회 시각을 상대 시간으로 보여준다(컨텐츠/보스 스케줄러와 동일한 formatSyncedAt, ADR-032)', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      periodKey: CURRENT_WEEKLY_PERIOD_KEY,
      lastSyncedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    })

    renderBossProfitScreen()

    expect(screen.getByText('3분 전')).toBeInTheDocument()
  })

  it('현재 기간에서 아직 한 번도 동기화하지 않았으면 "동기화 기록 없음"을 보여준다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      periodKey: CURRENT_WEEKLY_PERIOD_KEY,
      lastSyncedAt: null,
    })

    renderBossProfitScreen()

    expect(screen.getByText('동기화 기록 없음')).toBeInTheDocument()
  })

  it('stale 캐릭터가 있으면 안내 문구가 보인다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      staleCharacterNames: ['낟낟'],
    })

    renderBossProfitScreen()

    expect(screen.getByText(/일부 캐릭터 동기화 실패: 낟낟/)).toBeInTheDocument()
  })

  it('캐릭터별 드롭다운은 기본 상태에서 접혀 있어 보스 행이 보이지 않는다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()] })

    renderBossProfitScreen()

    expect(screen.queryByText('자쿰')).not.toBeInTheDocument()
  })

  it('드롭다운 헤더를 클릭하면 펼쳐져 보스 행이 보이고, 다시 클릭하면 접힌다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()] })

    renderBossProfitScreen()
    const header = screen.getByRole('button', { name: /낟낟/ })

    fireEvent.click(header)
    expect(screen.getByText('자쿰')).toBeInTheDocument()
    // 합계는 sticky 헤더에 상시 표시되므로 하단 소계 footer는 두지 않는다(ADR-047 후속 3)
    expect(screen.queryByText('낟낟 합계')).not.toBeInTheDocument()

    fireEvent.click(header)
    expect(screen.queryByText('자쿰')).not.toBeInTheDocument()
  })

  it('탭 전환 시 펼쳐둔 아코디언 상태가 리셋된다(#27)', () => {
    mockStore({
      status: 'loaded',
      tab: 'weekly',
      periodKey: '2026-07-09',
      trackedOcids: ['ocid-1'],
      rows: [row()],
    })
    const { rerender } = renderBossProfitScreen()

    // weekly 탭에서 아코디언을 펼친다
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))
    expect(screen.getByText('자쿰')).toBeInTheDocument()

    // 월간 탭으로 전환하면 key(`${tab}-${periodKey}-${ocid}`)가 바뀌어 remount → 펼침 상태가 리셋된다
    mockStore({
      status: 'loaded',
      tab: 'monthly',
      periodKey: '2026-07',
      trackedOcids: ['ocid-1'],
      rows: [row({ boss: '검은마법사', difficulty: '익스트림', cycle: 'monthly', periodKey: '2026-07' })],
    })
    rerender(
      <MemoryRouter initialEntries={['/profit']}>
        <BossProfitScreen />
      </MemoryRouter>,
    )

    // 접힌 상태이므로 이전 탭에서 펼쳤던 보스 행도, 새 탭의 보스 행도 보이지 않는다
    expect(screen.queryByText('자쿰')).not.toBeInTheDocument()
    expect(screen.queryByText('검은마법사')).not.toBeInTheDocument()
  })

  it('같은 탭에서 기간 이동 시에도 펼쳐둔 아코디언 상태가 리셋된다(#27)', () => {
    mockStore({
      status: 'loaded',
      tab: 'weekly',
      periodKey: '2026-07-09',
      trackedOcids: ['ocid-1'],
      rows: [row()],
    })
    const { rerender } = renderBossProfitScreen()

    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))
    expect(screen.getByText('자쿰')).toBeInTheDocument()

    // 같은 주간 탭이라도 이전 기간으로 이동하면 key가 바뀌어 remount → 펼침 리셋
    mockStore({
      status: 'loaded',
      tab: 'weekly',
      periodKey: '2026-07-02',
      trackedOcids: ['ocid-1'],
      rows: [row({ periodKey: '2026-07-02' })],
    })
    rerender(
      <MemoryRouter initialEntries={['/profit']}>
        <BossProfitScreen />
      </MemoryRouter>,
    )

    expect(screen.queryByText('자쿰')).not.toBeInTheDocument()
  })

  it('압축 스테퍼의 + 클릭 시 setPartySize가 호출된다', async () => {
    const setPartySize = vi.fn().mockResolvedValue(undefined)
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row({ partySize: 2 })], setPartySize })

    renderBossProfitScreen()
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

    renderBossProfitScreen()
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

    renderBossProfitScreen()
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByText('가격 미확정')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '낟낟 벨로나 카오스 파티원 수 증가' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '낟낟 벨로나 카오스 파티원 수 감소' })).toBeDisabled()
  })

  it('isComplete가 false면 미완료 배지를 보여주고 스테퍼가 비활성화된다(ADR-032)', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row({ isComplete: false, partySize: null, payoutMeso: 0 })],
    })

    renderBossProfitScreen()
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    const badge = screen.getByText('미완료')
    const bossRow = badge.closest('li') as HTMLElement
    expect(within(bossRow).queryByText(/메소/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '낟낟 자쿰 카오스 파티원 수 증가' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '낟낟 자쿰 카오스 파티원 수 감소' })).toBeDisabled()
  })

  it('payoutMeso가 있으면 메소 단위로 표시한다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row({ priceMeso: 10_000_000, partySize: 2, payoutMeso: 5_000_000 })],
    })

    renderBossProfitScreen()
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

    renderBossProfitScreen()

    expect(screen.getByText(/총 수익/)).toBeInTheDocument()
    // 헤드라인은 금액과 단위를 분리해 렌더하므로(ADR-046) getByText는 직계 텍스트("8,000,000")만 잡는다 —
    // 단위까지는 textContent로 확인한다.
    expect(screen.getByText('8,000,000')).toHaveTextContent('8,000,000 메소')
  })

  it('rows가 비어있으면 상단 합계 카드 없이 빈 상태 문구만 보인다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [] })

    renderBossProfitScreen()

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

    renderBossProfitScreen()
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

    renderBossProfitScreen()
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    const upcomingLabel = screen.getByText('예정')
    const upcomingRow = upcomingLabel.closest('li')
    expect(upcomingRow).toHaveClass('opacity-40')
  })

  it('monthly 탭: 조회 자체가 불가능한(MIN_SCHEDULER_DATE 이전이거나 롤링 윈도우 밖) 주는 "0메소"가 아니라 "조회 불가"로 흐리게 표시된다(ADR-032)', () => {
    mockStore({
      status: 'loaded',
      tab: 'monthly',
      periodKey: '2026-07',
      trackedOcids: ['ocid-1'],
      rows: [],
      weeklySubtotals: [subtotal({ periodKey: '2026-06-25', totalMeso: 0, state: 'unavailable' })],
    })

    renderBossProfitScreen()
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    const unavailableLabel = screen.getByText('조회 불가')
    const unavailableRow = unavailableLabel.closest('li')
    expect(unavailableRow).toHaveClass('opacity-40')
    expect(within(unavailableRow as HTMLElement).queryByText(/메소/)).not.toBeInTheDocument()
  })

  it('monthly 탭: 롤링 윈도우 밖의 달이라 월간 보스(검은마법사) 기록이 없으면 "월간 보스 수익" 섹션에 "조회 불가"를 보여준다(ADR-032)', () => {
    // 2026-06월의 조회일(2026-06-30)은 테스트 실행 시점(2026-07-22) 기준 롤링 하한(2026-07-09)보다
    // 이전이라 지금은 API로 조회할 수 없다.
    mockStore({
      status: 'loaded',
      tab: 'monthly',
      periodKey: '2026-06',
      trackedOcids: ['ocid-1'],
      rows: [],
      weeklySubtotals: [subtotal({ periodKey: '2026-06-04', totalMeso: 0, state: 'unavailable' })],
    })

    renderBossProfitScreen()
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByText('월간 보스 수익')).toBeInTheDocument()
    const sectionLabels = screen.getAllByText('조회 불가')
    expect(sectionLabels.length).toBeGreaterThan(0)
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

    renderBossProfitScreen()

    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
    expect(screen.queryByText('아직 처치한 보스가 없습니다')).not.toBeInTheDocument()
  })

  // 고가 아이템 드롭 강조 효과 — valuable-drops.json의 실제 데이터(isValuableDrop)를 그대로 쓴다.
  const VALUABLE_ITEM = '생명의 연마석' // valuable-drops.json items에 포함된 고가 아이템

  it('해당 주차에 고가 아이템 드롭이 기록돼 있으면 캐릭터 카드에 고가 드롭 강조 배지가 표시된다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      dropsByRowKey: {
        'ocid-1|자쿰|카오스|2026-07-09': [{ category: 'consumable', itemName: VALUABLE_ITEM, quantity: 1 }],
      },
    })

    renderBossProfitScreen()

    const badge = screen.getByRole('img', { name: '고가 드롭' })
    expect(badge).toBeInTheDocument()
    // 배지의 z-index(z-10)가 페이지 루트로 새어나가 sticky 헤더·하단 nav·safe-area를 침범하지 않도록,
    // 배지를 감싼 바깥 wrapper가 stacking을 격리(isolate)해야 한다(회귀 가드).
    // 배지가 sticky 레일 안으로 들어가며 부모가 한 겹 깊어져(ADR-047 후속) closest로 확인한다.
    expect(badge.closest('.isolate')).not.toBeNull()
  })

  it('고가 아이템이 아닌 드롭만 있으면 강조 배지가 표시되지 않는다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      dropsByRowKey: {
        'ocid-1|자쿰|카오스|2026-07-09': [{ category: 'consumable', itemName: '평범한 소비 아이템', quantity: 1 }],
      },
    })

    renderBossProfitScreen()

    expect(screen.queryByRole('img', { name: '고가 드롭' })).not.toBeInTheDocument()
  })

  it('고가 드롭이 있는 카드의 바깥 wrapper에 강조 효과 클래스(valuable-drop-card)가 붙는다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      dropsByRowKey: {
        'ocid-1|자쿰|카오스|2026-07-09': [{ category: 'consumable', itemName: VALUABLE_ITEM, quantity: 1 }],
      },
    })

    renderBossProfitScreen()

    const shell = screen.getByRole('button', { name: /낟낟/ }).parentElement
    expect(shell).toHaveClass('valuable-drop-card')
  })

  it('드롭이 전혀 없는 카드에는 강조 효과 클래스가 붙지 않는다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()], dropsByRowKey: {} })

    renderBossProfitScreen()

    const shell = screen.getByRole('button', { name: /낟낟/ }).parentElement
    expect(shell).not.toHaveClass('valuable-drop-card')
  })

  it('카드를 펼치면 글로우 맥동만 멈추고(valuable-drop-card--expanded) 회전 샤인 테두리·글로우·배지는 유지된다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      dropsByRowKey: {
        'ocid-1|자쿰|카오스|2026-07-09': [{ category: 'consumable', itemName: VALUABLE_ITEM, quantity: 1 }],
      },
    })

    renderBossProfitScreen()
    const header = screen.getByRole('button', { name: /낟낟/ })
    expect(header.parentElement).toHaveClass('valuable-drop-card')
    expect(header.parentElement).not.toHaveClass('valuable-drop-card--expanded') // 접힘: 글로우 맥동 동작

    fireEvent.click(header) // 펼침

    expect(header.parentElement).toHaveClass('valuable-drop-card') // 회전 샤인 테두리·글로우 유지
    expect(header.parentElement).toHaveClass('valuable-drop-card--expanded') // 글로우 맥동만 정지
    expect(screen.getByRole('img', { name: '고가 드롭' })).toBeInTheDocument() // 배지 유지
  })

  it('펼치면 고가 아이템을 획득한 보스 행 배경에 강조 효과(valuable-drop-row)가 이동한다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      dropsByRowKey: {
        'ocid-1|자쿰|카오스|2026-07-09': [{ category: 'consumable', itemName: VALUABLE_ITEM, quantity: 1 }],
      },
    })

    renderBossProfitScreen()
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByText('자쿰').closest('li')).toHaveClass('valuable-drop-row')
  })

  it('고가 아이템이 없는 보스 행 배경에는 강조 효과가 적용되지 않는다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row({ boss: '자쿰' }), row({ boss: '벨로나' })],
      dropsByRowKey: {
        'ocid-1|자쿰|카오스|2026-07-09': [{ category: 'consumable', itemName: VALUABLE_ITEM, quantity: 1 }],
      },
    })

    renderBossProfitScreen()
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByText('자쿰').closest('li')).toHaveClass('valuable-drop-row')
    expect(screen.getByText('벨로나').closest('li')).not.toHaveClass('valuable-drop-row')
  })

  it('ADR-047: 페이지 헤더에는 경계 페이드 오버레이를 두지 않는다(stuck된 캐릭터 헤더를 가림 — 회귀 가드)', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()] })

    const { container } = renderBossProfitScreen()

    // 페이드는 페이지 헤더(z-10) 안 top-full h-8 밴드를 bg-bg로 덮는데, 펼친 카드의 sticky 헤더가
    // 멈추는 자리가 바로 그 밴드다(카드는 isolate로 z-10 아래). 다른 4개 화면은 페이드를 유지하므로
    // 공용 레시피를 복사하다 되붙기 쉬워 가드를 둔다. 카드 헤더 자신의 페이드는 별도 테스트에서 검증.
    const pageHeader = container.querySelector('.sticky.top-0')
    expect(pageHeader).not.toBeNull()
    expect(pageHeader?.querySelector('.backdrop-blur-sm')).toBeNull()
    expect(pageHeader?.querySelector('.bg-gradient-to-b')).toBeNull()
  })

  it('ADR-047 후속: stuck 헤더 하단에 경계 페이드(그라데이션+블러)를 둔다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()] })

    // jsdom은 getBoundingClientRect가 모두 0이라 헤더 높이가 측정되지 않는다. 페이드는 측정 전에는
    // 위치를 잡을 수 없어 렌더를 보류하므로(카드 최상단에 깔리는 것 방지), 실제 레이아웃 높이를 주입한다.
    // 접힘 헤더는 border가 있어 66px, 펼침은 테두리가 없어 64px — 이 차이를 재현해 "접힘 시 측정값이
    // 남아 2px 틈이 생기는" 회귀를 잡는다(ResizeObserver는 content-box 관찰이라 테두리 변화를 못 잡는다).
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ height: 66 } as DOMRect)

    renderBossProfitScreen()
    const header = screen.getByRole('button', { name: /낟낟/ })
    const card = header.closest('.isolate')
    expect(card?.querySelector('.bg-gradient-to-b')).toBeNull() // 접힘: 고정 대상이 아니라 페이드도 없음

    rect.mockReturnValue({ height: 64 } as DOMRect) // 펼치면 헤더 border가 없어져 2px 줄어든다
    fireEvent.click(header)

    // 중첩 sticky에서는 콘텐츠가 지나가는 경계가 카드 헤더 아래다. 배경색은 페이지가 아니라
    // 카드 표면색(from-surface).
    const fade = card?.querySelector('.bg-gradient-to-b')
    expect(fade).not.toBeNull()
    expect(fade).toHaveClass('backdrop-blur-sm', 'from-surface', 'sticky')

    // 헤더 자식(top-full)으로 두면 헤더가 카드 끝에서 릴리스될 때 페이드가 카드 밖으로 새어나온다
    // (셸엔 overflow-hidden을 걸 수 없어 클리핑도 불가) — 본문 범위 제약 박스 안의 sticky로 둔다.
    expect(header.querySelector('.bg-gradient-to-b')).toBeNull()
    expect(fade?.parentElement).toHaveClass('absolute', 'pointer-events-none')
    // 카드 테두리(1px)를 덮지 않도록 좌우·하단을 테두리 두께만큼 들인다 — wrapper 기준 inset-x-0이면
    // 테두리까지 포함한 전체 폭을 덮어 테두리가 페이드에 가린다.
    expect(fade?.parentElement).toHaveClass('inset-x-px', 'bottom-px')
    // 제약 박스 top = 헤더 실측 높이 — 0이면 카드 최상단(헤더 위)에 깔린다
    expect(fade?.parentElement?.style.top).toBe('64px')

    rect.mockRestore()
  })

  it('ADR-047 후속: 고가 드롭 배지도 헤더와 함께 고정된다(높이 0 sticky 레일)', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      dropsByRowKey: {
        'ocid-1|자쿰|카오스|2026-07-09': [{ category: 'consumable', itemName: VALUABLE_ITEM, quantity: 1 }],
      },
    })

    renderBossProfitScreen()
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    // 배지를 헤더 안에 넣으면 헤더의 z-[5] 컨텍스트에 갇혀 골드 링(z-6)이 배지 위를 지나간다.
    // 그래서 셸 바깥(z-10)에 남기고 높이 0 sticky 레일에 얹어 헤더와 같은 오프셋으로 고정한다.
    const rail = screen.getByRole('img', { name: '고가 드롭' }).parentElement
    expect(rail).toHaveClass('sticky', 'h-0', 'z-10')

    // 높이 0 레일은 카드 맨 아래까지 붙어 있어, 자기 높이만큼 일찍 떨어지는 헤더와 어긋난다.
    // 그래서 "bottom = 헤더 실측 높이"인 absolute 제약 박스로 고정 범위를 헤더에 맞춘다(레이아웃 영향 없음).
    const constraint = rail?.parentElement
    expect(constraint).toHaveClass('absolute', 'pointer-events-none')
    expect(constraint?.style.bottom).not.toBe('') // 실측값 주입 배선(jsdom에선 0px)
    expect(screen.getByRole('img', { name: '고가 드롭' })).toHaveClass('pointer-events-auto')
  })

  it('ADR-047 후속: 접힘 상태의 배지는 sticky가 아니다(고정할 헤더가 없고 containing block이 헤더 높이뿐)', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      dropsByRowKey: {
        'ocid-1|자쿰|카오스|2026-07-09': [{ category: 'consumable', itemName: VALUABLE_ITEM, quantity: 1 }],
      },
    })

    renderBossProfitScreen()

    // 접힘일 때는 ADR-045 원래 구조 — 레일 없이 카드 wrapper 기준 absolute이고 z-10은 배지 자신이 갖는다
    // (레일이 없으면 정적 요소엔 z-index가 먹지 않아 골드 링 z-6 아래로 내려간다).
    const badge = screen.getByRole('img', { name: '고가 드롭' })
    expect(badge.parentElement).not.toHaveClass('sticky')
    expect(badge).toHaveClass('absolute', 'z-10')
  })

  // 펼친 캐릭터 카드 헤더 sticky 고정(ADR-047)
  it('ADR-047: 카드를 펼치면 헤더(초상화·이름·총액)가 sticky로 고정된다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()] })

    renderBossProfitScreen()
    // 펼치면 파티원 스테퍼(aria-label에 캐릭터명 포함)가 생겨 /낟낟/ 쿼리가 모호해지므로, 헤더 참조를
    // 클릭 전에 잡아 재사용한다(React가 같은 DOM 노드의 className만 갱신 — 기존 강조 효과 테스트와 동일).
    const header = screen.getByRole('button', { name: /낟낟/ })
    expect(header).not.toHaveClass('sticky') // 접힘: 단독 카드라 고정 대상 없음

    fireEvent.click(header)

    expect(header).toHaveClass('sticky')
    // 아래로 지나가는 보스 행을 가려야 하므로 자기 배경이 필요하고, 드롭 아이콘(inline zIndex 1~3)보다
    // 위·고가 드롭 배지(z-10)보다 아래 층이어야 한다.
    expect(header).toHaveClass('bg-surface')
    expect(header).toHaveClass('z-[5]')
  })

  it('ADR-047: 펼침 셸에는 overflow-hidden이 없다(sticky 헤더 무력화 방지 회귀 가드)', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()] })

    renderBossProfitScreen()
    const header = screen.getByRole('button', { name: /낟낟/ })
    fireEvent.click(header)

    // overflow:hidden 조상은 스크롤포트를 만들어 sticky를 죽인다 — 셸에 다시 붙으면 이 테스트가 잡는다.
    expect(header.parentElement).not.toHaveClass('overflow-hidden')
  })

  it('ADR-047 후속 3: 펼쳐도 소계 footer를 렌더하지 않는다(합계는 sticky 헤더에 상시 표시)', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()] })

    renderBossProfitScreen()
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.queryByText(/합계/)).not.toBeInTheDocument()
    // footer가 사라져 셸 하단에 닿는 배경 요소가 없다 — 하단 모서리 보정도 불필요(ADR-047 결정 2 참고).
    expect(document.querySelector('.rounded-b-\\[14px\\]')).toBeNull()
  })

  // 총 수익 헤드라인의 기간 전체 고가 드롭 뱃지(ADR-046) — 캐릭터 카드 배지와 같은 컴포넌트를 쓰되
  // aria-label로 구분한다("고가 드롭" = 캐릭터 카드, "이 기간 고가 드롭" = 헤드라인 요약).
  it('ADR-046: 기간에 고가 드롭이 있으면 총 수익 헤드라인에도 고가 드롭 뱃지가 표시된다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      dropsByRowKey: {
        'ocid-1|자쿰|카오스|2026-07-09': [{ category: 'consumable', itemName: VALUABLE_ITEM, quantity: 1 }],
      },
    })

    renderBossProfitScreen()

    expect(screen.getByRole('img', { name: '이 기간 고가 드롭' })).toBeInTheDocument()
  })

  it('ADR-046: 고가 드롭이 없으면 총 수익 헤드라인에 뱃지를 렌더하지 않는다', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()], dropsByRowKey: {} })

    renderBossProfitScreen()

    expect(screen.getByText(/총 수익/)).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: '이 기간 고가 드롭' })).not.toBeInTheDocument()
  })

  it('ADR-046: 헤드라인 뱃지는 여러 캐릭터의 고가 드롭을 모두 모아 집계한다(최대 3개 + 나머지 개수)', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1', 'ocid-2'],
      rows: [
        row({ ocid: 'ocid-1', characterName: '낟낟', boss: '자쿰' }),
        row({ ocid: 'ocid-2', characterName: '내옆에최성일', boss: '루시드' }),
      ],
      dropsByRowKey: {
        'ocid-1|자쿰|카오스|2026-07-09': [
          { category: 'consumable', itemName: VALUABLE_ITEM, quantity: 1 },
          { category: 'consumable', itemName: '신념의 연마석', quantity: 1 },
        ],
        'ocid-2|루시드|카오스|2026-07-09': [
          { category: 'equipment', itemName: '혼돈의 칠흑 장신구 상자', quantity: 1 },
          { category: 'equipment', itemName: '메이린의 칠흑 장신구 상자', quantity: 1 },
        ],
      },
    })

    renderBossProfitScreen()

    // 캐릭터별 배지(각 2개)와 달리 헤드라인은 4개를 합쳐 3개만 보여주고 나머지는 "+1"로 접는다.
    const headlineBadge = screen.getByRole('img', { name: '이 기간 고가 드롭' })
    expect(within(headlineBadge).getByText('+1')).toBeInTheDocument()
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

    renderBossProfitScreen()

    expect(screen.getByRole('button', { name: /낟낟.*5,000,000 메소/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /내옆에최성일.*3,000,000 메소/ })).toBeInTheDocument()
  })
})
