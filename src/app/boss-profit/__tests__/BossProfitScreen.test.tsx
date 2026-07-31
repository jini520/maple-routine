// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BossProfitScreen } from '../BossProfitScreen'
import {
  useBossProfitStore,
  type BossProfitRow,
  type BossProfitWeeklySubtotal,
  type WeeklySubtotalState,
} from '../../../features/boss-profit/store'
import { getCurrentBossProfitPeriod } from '../../../lib/boss-profit-period'
import { WEEKLY_BOSS_CLEAR_LIMIT, WEEKLY_CRYSTAL_SALE_LIMIT } from '../../../lib/boss-matching'
import weeklyBossesData from '../../../data/weekly-bosses.json'
// ADR-063: 동기화 실패·일부 캐릭터 실패·파티원 수 저장 실패는 인라인 문단이 아니라 토스트로 알린다.
const { showErrorMock } = vi.hoisted(() => ({ showErrorMock: vi.fn() }))
vi.mock('../../../features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: showErrorMock, showSuccess: vi.fn(), showInfo: vi.fn() }) },
}))


// 월간 링의 분모는 게임 한도가 아니라 "우리가 추적하는 월간 보스 종류 수"라 참조 데이터에서 파생한다
// ([[ADR-059]] 결정 4) — 화면과 같은 소스를 봐야 월간 보스가 늘 때 테스트가 조용히 어긋나지 않는다.
const MONTHLY_BOSS_COUNT = weeklyBossesData.monthly.length

// 새로고침 버튼·다음 기간 버튼은 "현재 기간"에서만 각각 노출/비활성되므로, 실행 시점과 무관하게
// 항상 현재 기간을 가리키도록 실제 계산값을 쓴다.
const CURRENT_WEEKLY_PERIOD_KEY = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
const CURRENT_MONTHLY_PERIOD_KEY = getCurrentBossProfitPeriod('monthly', new Date()).periodKey

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
    periodState: 'confirmedEmpty' as const,
    canGoPreviousPeriod: true,
    error: null,
    staleCharacterNames: [],
    characterIssues: {},
    trackedOcids: null,
    lastSyncedAt: null,
    loadTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    setTab: vi.fn(),
    goToPreviousPeriod: vi.fn(),
    goToNextPeriod: vi.fn(),
    retryPeriod: vi.fn(),
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
    world: null,
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
    state: 'recorded',
    ...overrides,
  }
}

// 빈 상태 CTA가 실제로 이동시키는 경로(쿼리 포함)를 확인하기 위한 목적지 프로브.
function LocationProbe(): React.JSX.Element {
  const location = useLocation()
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>
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

  // ADR-060으로 공용 EmptyState를 쓰면서 <Link> 가 버튼+navigate 로 바뀌었다 — 목적지는 그대로다.
  it('빈 상태의 CTA는 보스 스케줄러의 캐릭터 관리를 자동으로 여는 곳으로 보낸다', () => {
    mockStore({ status: 'loaded', trackedOcids: null, rows: [] })

    render(
      <MemoryRouter initialEntries={['/profit']}>
        <Routes>
          <Route path="/profit" element={<BossProfitScreen />} />
          <Route path="/boss" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '캐릭터 선택하러 가기' }))

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/boss?openPicker=1')
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

    expect(screen.getByText(/기록을 불러오고 있어요/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /낟낟/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/총 수익/)).not.toBeInTheDocument()
  })

  // ADR-068 결정 3: 동기화가 실패한 캐릭터를 카드에서 식별한다 — 전에는 토스트가 인원 수만 알려
  // 어느 카드인지 알 수 없었다(이슈 #78 B).
  describe('캐릭터 카드의 실패 표식 (ADR-068 결정 3)', () => {
    it('실패한 캐릭터 카드에만 배지를 붙인다', () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1', 'ocid-2'],
        rows: [row({ ocid: 'ocid-1', characterName: '낟낟' }), row({ ocid: 'ocid-2', characterName: '잠수깨비' })],
        periodState: 'recorded',
        characterIssues: { 'ocid-2': 'failed' },
      })

      renderBossProfitScreen()

      expect(screen.getAllByTestId('character-issue-badge')).toHaveLength(1)
      const failedCard = screen.getByRole('button', { name: /잠수깨비/ })
      // 아이콘만 남아(라벨 없음) 스크린리더에는 role="img" + aria-label이 유일한 원천이다.
      expect(within(failedCard).getByRole('img', { name: '실패' })).toBeInTheDocument()
    })

    it('조회 불가는 영구라 다른 문구·톤을 쓴다', () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        rows: [row({ ocid: 'ocid-1', characterName: '또삭제될제로' })],
        periodState: 'recorded',
        characterIssues: { 'ocid-1': 'unavailable' },
      })

      renderBossProfitScreen()

      expect(screen.getByRole('img', { name: '조회 불가' })).toBeInTheDocument()
      expect(screen.queryByRole('img', { name: '실패' })).not.toBeInTheDocument()
    })

    // 실물 확인 후 확정(2026-07-31): 라벨 배지는 6자 이름부터 잘라먹어(내옆에최성일 → 내옆에…)
    // 아이콘만 남겼다. 이름·금액·헤드라인 합계가 모두 온전하다.
    // 사용자 지정(2026-07-31): 아이콘만으로는 원인을 말할 수 없으므로 탭하면 설명이 나와야 한다.
    // 겹침·z-index 주의사항도 함께 검증한다 — 실물에서 팝오버가 아래 카드에 가려지는 것을 확인했다.
    describe('설명 팝오버', () => {
      function renderWithIssue(): void {
        mockStore({
          status: 'loaded',
          trackedOcids: ['ocid-1'],
          rows: [row({ ocid: 'ocid-1', characterName: '잠수깨비', payoutMeso: 8_080_000 })],
          periodState: 'recorded',
          characterIssues: { 'ocid-1': 'failed' },
        })
        renderBossProfitScreen()
      }

      it('배지를 탭하면 이유를 설명하고, 아코디언은 펼쳐지지 않는다', () => {
        renderWithIssue()

        expect(screen.queryByTestId('character-issue-popover')).not.toBeInTheDocument()
        fireEvent.click(screen.getByTestId('character-issue-badge'))

        expect(screen.getByText('동기화하지 못했습니다')).toBeInTheDocument()
        // 카드 헤더 자체가 버튼이라 stopPropagation이 없으면 함께 펼쳐진다
        expect(screen.queryByText('자쿰')).not.toBeInTheDocument()
      })

      it('다시 탭하면 닫힌다', () => {
        renderWithIssue()

        fireEvent.click(screen.getByTestId('character-issue-badge'))
        fireEvent.click(screen.getByTestId('character-issue-badge'))

        expect(screen.queryByTestId('character-issue-popover')).not.toBeInTheDocument()
      })

      it('스크롤이 시작되면 닫는다 — 스크롤 중 다른 컨텐츠를 덮지 않게 한다', () => {
        renderWithIssue()

        fireEvent.click(screen.getByTestId('character-issue-badge'))
        expect(screen.getByTestId('character-issue-popover')).toBeInTheDocument()

        fireEvent.scroll(window)
        expect(screen.queryByTestId('character-issue-popover')).not.toBeInTheDocument()
      })

      it('바깥을 누르면 닫힌다', () => {
        renderWithIssue()

        fireEvent.click(screen.getByTestId('character-issue-badge'))
        fireEvent.pointerDown(document.body)

        expect(screen.queryByTestId('character-issue-popover')).not.toBeInTheDocument()
      })

      it('열린 동안만 그 카드를 형제 카드 위로 올린다 — 페이지 헤더(z-10)보다는 낮게', () => {
        renderWithIssue()
        const card = screen.getByTestId('character-issue-badge').closest('.isolate') as HTMLElement

        expect(card.className).not.toContain('z-[9]')
        fireEvent.click(screen.getByTestId('character-issue-badge'))
        expect(card.className).toContain('z-[9]')
      })

      it('조회 불가는 다른 설명을 준다 — 추적 해제 경로를 알린다', () => {
        mockStore({
          status: 'loaded',
          trackedOcids: ['ocid-1'],
          rows: [row({ ocid: 'ocid-1', characterName: '또삭제될제로' })],
          periodState: 'recorded',
          characterIssues: { 'ocid-1': 'unavailable' },
        })
        renderBossProfitScreen()

        fireEvent.click(screen.getByTestId('character-issue-badge'))

        expect(screen.getByText('조회할 수 없는 캐릭터입니다')).toBeInTheDocument()
        expect(screen.getByText(/캐릭터 관리에서 추적을 해제/)).toBeInTheDocument()
      })
    })

    it('이름과 금액을 둘 다 가리지 않는다', () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        rows: [row({ ocid: 'ocid-1', characterName: '잠수깨비', payoutMeso: 8_080_000 })],
        periodState: 'recorded',
        characterIssues: { 'ocid-1': 'failed' },
      })

      renderBossProfitScreen()

      const card = screen.getByRole('button', { name: /잠수깨비/ })
      expect(within(card).getByRole('img', { name: '실패' })).toBeInTheDocument()
      expect(within(card).getByText('잠수깨비')).toBeInTheDocument()
      expect(within(card).getByText('8,080,000 메소')).toBeInTheDocument()
    })
  })

  // ADR-068 결정 2: 월간 주차 행은 **행동이 있는 상태에만** 버튼을 준다. 조회한 적 없는 주를
  // 0메소(확정)로 위장하던 것이 이 결정의 출발점이다.
  describe('월간 주차 행의 상태별 표현 (ADR-068 결정 2)', () => {
    function monthlyWith(state: WeeklySubtotalState, retryPeriod = vi.fn()): ReturnType<typeof vi.fn> {
      mockStore({
        status: 'loaded',
        tab: 'monthly',
        periodKey: '2026-07',
        trackedOcids: ['ocid-1'],
        rows: [],
        periodState: 'recorded',
        weeklySubtotals: [subtotal({ periodKey: '2026-07-09', state, totalMeso: 0 })],
        retryPeriod,
      })
      renderBossProfitScreen()
      fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))
      return retryPeriod
    }

    it('notChecked에는 "조회" 버튼을 주고 금액을 쓰지 않는다 — 0은 "0원 벌었다"로 읽힌다', () => {
      const retryPeriod = monthlyWith('notChecked')

      const button = screen.getByRole('button', { name: '조회' })
      expect(button).toBeInTheDocument()
      // 그 행 안에는 금액이 없다(카드 헤더 합계와 구분해 행 범위로 좁힌다)
      const row = screen.getByText('7월 2주차').closest('li') as HTMLElement
      expect(within(row).queryByText(/메소/)).not.toBeInTheDocument()

      fireEvent.click(button)
      expect(retryPeriod).toHaveBeenCalled()
    })

    it('failed에는 "다시 시도" 버튼을 준다', () => {
      const retryPeriod = monthlyWith('failed')

      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
      expect(retryPeriod).toHaveBeenCalled()
    })

    it('confirmedEmpty는 "0 메소"다 — 조회해서 확인한 사실이라 금액을 말할 수 있다', () => {
      monthlyWith('confirmedEmpty')

      const row = screen.getByText('7월 2주차').closest('li') as HTMLElement
      expect(within(row).getByText('0 메소')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '조회' })).not.toBeInTheDocument()
    })

    it.each([
      ['notCollected', '집계 전'],
      ['outOfRange', '조회 불가'],
    ] as const)('%s는 비활성 배지이고 버튼이 없다 — 사용자가 할 일이 없다', (state, label) => {
      monthlyWith(state)

      expect(screen.getByText(label)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '조회' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    })
  })

  // ADR-068 결정 1: 여섯 상태가 서로 다른 얼굴을 갖는다. 전에는 periodUnavailable(boolean) 하나로
  // "집계 전"과 "그 외 실패"를 같은 문구로 말했다.
  describe('기간 상태별 표현 (ADR-068 결정 1)', () => {
    it('failed는 실패 상태 + 재시도 액션을 준다', () => {
      const retryPeriod = vi.fn()
      mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [], periodState: 'failed', retryPeriod })

      renderBossProfitScreen()

      expect(screen.getByTestId('error-state')).toBeInTheDocument()
      expect(screen.getByText('이 기간을 불러오지 못했습니다')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
      expect(retryPeriod).toHaveBeenCalled()
    })

    it('notCollected는 "아직 집계되지 않았습니다"이고 재시도 버튼이 없다 — 사용자가 할 일이 없다', () => {
      mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [], periodState: 'notCollected' })

      renderBossProfitScreen()

      expect(screen.getByText('아직 집계되지 않았습니다')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
      expect(screen.queryByTestId('error-state')).not.toBeInTheDocument()
    })

    it('outOfRange는 조회 불가 고지이고 기간 문구는 14일이다(넥슨 한도)', () => {
      mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [], periodState: 'outOfRange' })

      renderBossProfitScreen()

      expect(screen.getByTestId('unavailable-notice')).toBeInTheDocument()
      expect(screen.getByTestId('unavailable-notice-description').textContent).toContain('14일')
    })

    it('confirmedEmpty는 빈 상태다 — 조회 불가와 디자인을 공유하지 않는다(ADR-060)', () => {
      mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [], periodState: 'confirmedEmpty' })

      renderBossProfitScreen()

      expect(screen.getByText('아직 처치한 보스가 없습니다')).toBeInTheDocument()
      expect(screen.queryByTestId('unavailable-notice')).not.toBeInTheDocument()
    })

    it('recorded면 기록이 화면의 주인이라 어떤 고지도 띄우지 않는다(결정 7)', () => {
      mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()], periodState: 'recorded' })

      renderBossProfitScreen()

      expect(screen.queryByTestId('unavailable-notice')).not.toBeInTheDocument()
      expect(screen.queryByTestId('error-state')).not.toBeInTheDocument()
      expect(screen.queryByText(/아직 집계되지 않았습니다/)).not.toBeInTheDocument()
    })
  })

  it('status가 loading이고 캐릭터 그룹이 없으면 로딩 표시를 보여준다', () => {
    mockStore({ status: 'loading', trackedOcids: ['ocid-1'], rows: [] })

    renderBossProfitScreen()

    expect(screen.getByText(/불러오고 있어요/)).toBeInTheDocument()
  })

  it('ADR-017: status가 loading이어도 캐시된 rows가 있으면 로딩 표시 대신 목록을 계속 보여준다', () => {
    mockStore({
      status: 'loading',
      trackedOcids: ['ocid-1'],
      rows: [row()],
    })

    renderBossProfitScreen()

    expect(screen.queryByText(/불러오고 있어요/)).not.toBeInTheDocument()
    expect(screen.getByText(/총 수익/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
  })

  // ADR-063: 인라인 문단을 걷어내고 토스트로 알린다.
  it('status가 error이면 인라인 문단이 아니라 토스트로 알린다', async () => {
    mockStore({ status: 'error', trackedOcids: ['ocid-1'], error: { kind: 'invalidApiKey' }, rows: [] })

    renderBossProfitScreen()

    await waitFor(() => expect(showErrorMock).toHaveBeenCalled())
    expect(showErrorMock.mock.calls[0][0]).toBe('API 키가 유효하지 않습니다')
    expect(screen.queryByText('API 키가 유효하지 않습니다')).not.toBeInTheDocument()
  })

  // ADR-067 결정 2로 판정 주체가 옮겨졌다: 전에는 이 화면이 periodKey로 isPeriodQueryable을 직접
  // 계산했는데, 백필은 target별로 따로 판정해 둘이 어긋났다(이슈 #78 E — 두 문구 동시 출현).
  // 이제 store가 계산한 periodState 하나를 화면과 백필이 공유한다.
  it('weekly 탭: outOfRange이고 rows가 비어있으면 "조회 불가"를 보여준다(ADR-032)', () => {
    mockStore({
      status: 'loaded',
      tab: 'weekly',
      periodKey: '2026-07-02',
      trackedOcids: ['ocid-1'],
      rows: [],
      periodState: 'outOfRange',
    })

    renderBossProfitScreen()

    // ADR-060: 확정된 빈 상태("아직 처치한 보스가 없습니다")와 디자인·문구를 공유하지 않는다.
    expect(screen.getByText('이 기간은 조회할 수 없습니다')).toBeInTheDocument()
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

  // ADR-063: Toast 본문이 truncate라 이름 나열 대신 인원 수를 싣는다.
  it('stale 캐릭터가 있으면 인원 수를 담은 토스트로 알린다', async () => {
    const refresh = vi.fn()
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      staleCharacterNames: ['낟낟', '내옆에최성일'],
      refresh,
    })

    renderBossProfitScreen()

    await waitFor(() => expect(showErrorMock).toHaveBeenCalled())
    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('일부 캐릭터를 불러오지 못했습니다 (2명)')
    expect(action.label).toBe('다시 시도')
    expect(screen.queryByText(/일부 캐릭터 동기화 실패/)).not.toBeInTheDocument()

    action.onClick()
    expect(refresh).toHaveBeenCalledWith(['ocid-1'])
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

  // ADR-063: 예외 메시지를 그대로 렌더하던 자리였다 — 개발자용 문구가 사용자에게 새지 않는지
  // 함께 검증한다(스토어는 'setPartySize: …' 형태로 던진다).
  it('압축 스테퍼의 - 클릭이 실패하면 원문 대신 사용자 문구 토스트를 띄운다', async () => {
    const setPartySize = vi
      .fn()
      .mockRejectedValue(new Error('setPartySize: 파티원 수는 1 이상 6 이하의 정수여야 합니다'))
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row({ partySize: 2 })], setPartySize })

    renderBossProfitScreen()
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))
    fireEvent.click(screen.getByRole('button', { name: '낟낟 자쿰 카오스 파티원 수 감소' }))

    await waitFor(() => expect(showErrorMock).toHaveBeenCalledWith('파티원 수를 저장하지 못했습니다'))
    expect(screen.queryByText(/setPartySize:/)).not.toBeInTheDocument()
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
        subtotal({ periodKey: '2026-07-02', totalMeso: 5_000_000, state: 'recorded' }),
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
      weeklySubtotals: [subtotal({ periodKey: '2026-06-25', totalMeso: 0, state: 'outOfRange' })],
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
      weeklySubtotals: [subtotal({ periodKey: '2026-06-04', totalMeso: 0, state: 'outOfRange' })],
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
      weeklySubtotals: [subtotal({ periodKey: '2026-07-02', totalMeso: 5_000_000, state: 'recorded' })],
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

  // 레이아웃 유격 정리(ADR-049) — jsdom엔 레이아웃이 없어 픽셀을 잴 수 없으므로, 높이를 결정하는
  // 클래스 배선을 회귀 가드로 고정한다(수치 근거는 ADR-049 표 참고).
  it('ADR-049: 동기화 상태 영역(시각 텍스트·새로고침)이 주간/월간 탭과 같은 줄에 있고 버튼 높이가 30px다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      periodKey: CURRENT_WEEKLY_PERIOD_KEY,
    })

    renderBossProfitScreen()

    const refresh = screen.getByRole('button', { name: '새로고침' })
    // 같은 줄 = 주간 탭 버튼과 같은 flex 컨테이너 안. 제목(h1) 줄에 남아 있으면 실패한다.
    const tabRow = screen.getByRole('button', { name: '주간' }).parentElement
    expect(tabRow).not.toBeNull()
    expect(tabRow?.contains(refresh)).toBe(true)
    // 제목은 별개 줄로 남는다 — 탭 줄로 끌려오면 실패한다.
    expect(tabRow?.contains(screen.getByRole('heading', { name: '보스 수익' }))).toBe(false)
    // 탭은 좌측, 동기화 상태는 우측(ml-auto)
    expect(refresh.parentElement).toHaveClass('ml-auto')

    // 활성 탭 pill이 30px(py-[5px] + text-sm 20px)라 버튼도 30px여야 한다 — 기본 p-2(32px)면
    // 새로고침이 없는 과거 기간과 2px 어긋난다.
    expect(refresh).toHaveClass('h-[30px]', 'w-[30px]')
    expect(refresh).not.toHaveClass('p-2')
  })

  it('ADR-049: 총 수익 헤드라인의 고가 드롭 뱃지는 absolute라 라벨행 높이에 영향을 주지 않는다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      dropsByRowKey: {
        'ocid-1|자쿰|카오스|2026-07-09': [{ category: 'consumable', itemName: VALUABLE_ITEM, quantity: 1 }],
      },
    })

    renderBossProfitScreen()

    // 흐름에 있으면 뱃지(24px)가 라벨(16px)보다 커서 줄 높이가 튄다. 뱃지에 붙일 탭 확대 애니메이션도
    // 주변 레이아웃을 밀게 되므로 흐름 밖(absolute)에 둔다.
    const badge = screen.getByRole('img', { name: '이 기간 고가 드롭' })
    expect(badge).toHaveClass('absolute')
    expect(badge.parentElement).toHaveClass('relative')
  })

  it('ADR-049: 펼침 셸은 overflow-clip으로 모서리를 잘라낸다(overflow-hidden은 여전히 금지)', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], rows: [row()] })

    renderBossProfitScreen()
    const header = screen.getByRole('button', { name: /낟낟/ })
    fireEvent.click(header)

    // clip은 스크롤 컨테이너를 만들지 않아 sticky 헤더가 살아 있다 — hidden과 달리 함께 쓸 수 있다.
    // 이 클리핑이 stuck 헤더 모서리로 보스 행이 비치는 문제와, 카드 끝에서 헤더 하단 모서리가
    // 뾰족해지는 문제를 동시에 없앤다.
    expect(header.parentElement).toHaveClass('overflow-clip')
    expect(header.parentElement).not.toHaveClass('overflow-hidden')
    // 헤더 자신은 사각이어야 한다 — rounded-t-*를 주면 stuck 상태에서 모서리 안쪽이 투명이라
    // 그 아래를 지나가는 보스 행이 비친다(브라우저 hit-test로 재현 확인). 셸 클리핑은 카드 모서리
    // 에서만 일어나므로 카드 중간에 멈춘 헤더의 라운딩은 덮어주지 못한다.
    expect(header.className).not.toMatch(/rounded-t-/)
  })

  it('ADR-049: 보스 행 높이가 드롭 유무·마지막 행 여부와 무관하게 고정된다', () => {
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

    // 마지막 행만 테두리를 없애면(last:border-b-0) 1px 짧아진다 — 색만 지워 박스는 남긴다.
    const lastRow = screen.getByText('벨로나').closest('li')
    expect(lastRow).toHaveClass('last:border-b-transparent')
    expect(lastRow).not.toHaveClass('last:border-b-0')

    // 이름 줄은 자식(칩 vs 아이콘 스택)에 높이를 맡기지 않고 h-6으로 고정한다.
    const withDrop = screen.getByRole('button', { name: /자쿰 카오스 드롭 아이템 관리/ })
    const withoutDrop = screen.getByRole('button', { name: /벨로나 카오스 드롭 아이템 관리/ })
    expect(withDrop).toHaveClass('h-6')
    expect(withoutDrop).toHaveClass('h-6')

    // "＋ 드롭 추가" 칩도 아이콘 스택과 같은 24px — 세로 패딩으로 높이를 만들면 line-height에 휘둘린다.
    const addChip = within(withoutDrop).getByText(/드롭 추가/)
    expect(addChip).toHaveClass('h-6')
    expect(addChip).not.toHaveClass('py-1')
  })

  // 보스 행 드롭 지시자의 반지 등급 뱃지(2026-07-30) — 반지 상자 드릴다운 결과(ADR-041)만
  // ringLevel이 있고, 그 드롭에만 아이콘 우측 하단 lvN 뱃지가 붙는다.
  it('특수 스킬 반지 드롭은 아이콘 우측 하단에 lvN 뱃지를 표시한다', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      rows: [row()],
      dropsByRowKey: {
        'ocid-1|자쿰|카오스|2026-07-09': [
          { category: 'equipment', itemName: '리스트레인트 링', boxOrigin: '백옥의 보스 반지 상자', ringLevel: 4, quantity: 1 },
          { category: 'consumable', itemName: VALUABLE_ITEM, quantity: 1 },
        ],
      },
    })

    renderBossProfitScreen()
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    const indicator = screen.getByRole('button', { name: /자쿰 카오스 드롭 아이템 관리/ })
    // 반지 하나만 등급이 있으므로 뱃지도 하나 — 등급 없는 드롭에는 붙지 않는다.
    const badges = within(indicator).getAllByText('lv4')
    expect(badges).toHaveLength(1)
    expect(badges[0]).toHaveClass('absolute', '-bottom-1', '-right-0.5')
  })

  it('등급 없는 드롭만 있으면 lv 뱃지를 렌더하지 않는다', () => {
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

    const indicator = screen.getByRole('button', { name: /자쿰 카오스 드롭 아이템 관리/ })
    expect(within(indicator).queryByText(/^lv/)).not.toBeInTheDocument()
  })

  // 수익 아이콘은 세 자리(탭바·헤드라인 엠블럼·빈 상태)가 한 컴포넌트를 공유한다(ADR-066).
  // 탭바는 App 테스트가 잠그고, 이 화면의 두 자리를 여기서 잠근다 — 셋이 같은 아이콘이었던 것은
  // 원래 우연이라, 공유가 깨지면 한쪽만 조용히 옛 아이콘으로 남는다.
  describe('수익 아이콘(ADR-066)', () => {
    it('총 수익 헤드라인의 엠블럼이 공용 ProfitIcon이다', () => {
      mockStore({
        status: 'loaded',
        trackedOcids: ['ocid-1'],
        rows: [row({ payoutMeso: 5_000_000 })],
      })

      renderBossProfitScreen()

      // 금액행(엠블럼 + 금액)만 훑는다 — 화면 어딘가에 아이콘이 있다는 확인으로는 자리가 안 잡힌다.
      const amountRow = screen.getByText('5,000,000').closest('div')
      expect(amountRow?.querySelector('[data-testid="profit-icon"]')).toBeInTheDocument()
    })

    it('처치 0건 빈 상태의 배지도 같은 ProfitIcon이다', () => {
      // 조회 가능한 기간이어야 "조회 불가"가 아니라 확정된 빈 상태가 뜬다(ADR-060).
      mockStore({
        status: 'loaded',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [],
      })

      renderBossProfitScreen()

      expect(screen.getByText('아직 처치한 보스가 없습니다')).toBeInTheDocument()
      expect(within(screen.getByTestId('empty-state-badge')).getByTestId('profit-icon')).toBeInTheDocument()
    })
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

  // 보스 처치 진행 링(ADR-054 #52, 정정 7로 n/12 텍스트는 보류 / 표시 범위는 ADR-059) — 처치 수는
  // store 필드가 아니라 rows에서 파생하므로 모든 케이스를 rows 구성만으로 재현한다. 링이 진행률의
  // 유일한 표현이라 수치는 링의 접근성 레이블로 확인한다.
  describe('보스 처치 진행 링(ADR-054, #52 / ADR-059)', () => {
    function clearProgress(): HTMLElement | null {
      return screen.queryByRole('img', { name: /주간 보스 처치/ })
    }

    function monthlyClearProgress(): HTMLElement | null {
      return screen.queryByRole('img', { name: /월간 보스 처치/ })
    }

    it('주간 탭·현재 기간에서 완료한 주간 보스 수를 아바타 링으로 보여준다', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [
          row({ boss: '자쿰', periodKey: CURRENT_WEEKLY_PERIOD_KEY }),
          row({ boss: '루시드', periodKey: CURRENT_WEEKLY_PERIOD_KEY }),
          row({ boss: '윌', periodKey: CURRENT_WEEKLY_PERIOD_KEY }),
        ],
      })

      renderBossProfitScreen()

      expect(clearProgress()).toHaveAccessibleName(`주간 보스 처치 3 / ${WEEKLY_BOSS_CLEAR_LIMIT}`)
      // 정정 7: 카드에는 n/12 텍스트를 두지 않는다(캐릭터명과 가로폭을 다투는 배치를 아직 못 찾음).
      expect(screen.queryByText(`3/${WEEKLY_BOSS_CLEAR_LIMIT}`)).not.toBeInTheDocument()
    })

    it('시즌 보스(메이린)는 주간 12마리 제한 예외라 처치 수에 포함하지 않는다', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [
          row({ boss: '자쿰', periodKey: CURRENT_WEEKLY_PERIOD_KEY }),
          row({ boss: '시즌 보스 메이린', periodKey: CURRENT_WEEKLY_PERIOD_KEY }),
        ],
      })

      renderBossProfitScreen()

      expect(clearProgress()).toHaveAccessibleName(`주간 보스 처치 1 / ${WEEKLY_BOSS_CLEAR_LIMIT}`)
    })

    it('미완료 placeholder 행(isComplete: false)은 처치 수에 포함하지 않는다', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [
          row({ boss: '자쿰', periodKey: CURRENT_WEEKLY_PERIOD_KEY }),
          row({ boss: '루시드', periodKey: CURRENT_WEEKLY_PERIOD_KEY, isComplete: false, payoutMeso: 0 }),
        ],
      })

      renderBossProfitScreen()

      expect(clearProgress()).toHaveAccessibleName(`주간 보스 처치 1 / ${WEEKLY_BOSS_CLEAR_LIMIT}`)
    })

    it('같은 보스를 여러 난이도로 완료해도 1로만 센다(보스명 distinct)', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [
          row({ boss: '자쿰', difficulty: '카오스', periodKey: CURRENT_WEEKLY_PERIOD_KEY }),
          row({ boss: '자쿰', difficulty: '하드', periodKey: CURRENT_WEEKLY_PERIOD_KEY }),
        ],
      })

      renderBossProfitScreen()

      expect(clearProgress()).toHaveAccessibleName(`주간 보스 처치 1 / ${WEEKLY_BOSS_CLEAR_LIMIT}`)
    })

    it('월간 탭에서는 주간 링 대신 월간 보스(검은마법사) 처치 링을 보여준다(ADR-059 결정 3)', () => {
      mockStore({
        status: 'loaded',
        tab: 'monthly',
        periodKey: CURRENT_MONTHLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [
          row({
            boss: '검은마법사',
            difficulty: '익스트림',
            cycle: 'monthly',
            periodKey: CURRENT_MONTHLY_PERIOD_KEY,
          }),
        ],
      })

      renderBossProfitScreen()

      // 주간 처치 수를 월간으로 끌어오지 않는다 — 월간 탭 rows엔 주간 행 자체가 없다.
      expect(clearProgress()).not.toBeInTheDocument()
      expect(monthlyClearProgress()).toHaveAccessibleName(`월간 보스 처치 1 / ${MONTHLY_BOSS_COUNT}`)
    })

    it('월간 보스를 아직 안 잡았으면(미완료 placeholder) 월간 링이 비어 있다', () => {
      mockStore({
        status: 'loaded',
        tab: 'monthly',
        periodKey: CURRENT_MONTHLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [
          row({
            boss: '검은마법사',
            difficulty: '익스트림',
            cycle: 'monthly',
            periodKey: CURRENT_MONTHLY_PERIOD_KEY,
            isComplete: false,
            payoutMeso: 0,
          }),
        ],
      })

      const { container } = renderBossProfitScreen()

      expect(monthlyClearProgress()).toHaveAccessibleName(`월간 보스 처치 0 / ${MONTHLY_BOSS_COUNT}`)
      expect(container.querySelectorAll('svg.-rotate-90 circle.stroke-primary')).toHaveLength(0)
    })

    it('월간 링의 칸 수는 리터럴이 아니라 weekly-bosses.json의 monthly 항목 수를 따른다(ADR-059 결정 4)', () => {
      mockStore({
        status: 'loaded',
        tab: 'monthly',
        periodKey: CURRENT_MONTHLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [
          row({
            boss: '검은마법사',
            difficulty: '하드',
            cycle: 'monthly',
            periodKey: CURRENT_MONTHLY_PERIOD_KEY,
          }),
        ],
      })

      renderBossProfitScreen()

      const ring = screen.getByRole('img', { name: /월간 보스 처치/ })
      expect(ring.querySelectorAll('circle')).toHaveLength(MONTHLY_BOSS_COUNT)
    })

    it('칸이 하나뿐인 월간 링은 간격 없이 온전한 원으로 그린다(ADR-059 정정 1)', () => {
      mockStore({
        status: 'loaded',
        tab: 'monthly',
        periodKey: CURRENT_MONTHLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [
          row({
            boss: '검은마법사',
            difficulty: '익스트림',
            cycle: 'monthly',
            periodKey: CURRENT_MONTHLY_PERIOD_KEY,
          }),
        ],
      })

      renderBossProfitScreen()

      // dash 보정은 "칸 사이"를 벌리기 위한 장치라, 칸이 하나면 그 틈이 나눔이 아니라 결손으로 보인다.
      const segments = screen.getByRole('img', { name: /월간 보스 처치/ }).querySelectorAll('circle')
      expect(segments).toHaveLength(1)
      expect(segments[0]).not.toHaveAttribute('stroke-dasharray')
      expect(segments[0]).not.toHaveAttribute('stroke-dashoffset')
    })

    it('링은 12시에서 반시계 방향으로 찬다(ADR-059 정정 2)', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [row({ boss: '자쿰' })],
      })

      renderBossProfitScreen()

      // 좌우 반전이 경로 진행 방향(circle은 3시에서 시작해 시계방향)을 뒤집고 시작점을 9시로 옮기므로,
      // 시작점을 12시에 되돌리려면 회전이 -90도가 아니라 +90도여야 한다. 둘 중 하나만 있으면 방향이나
      // 시작점 중 하나가 틀어지므로 세 조건을 함께 잠근다.
      const classes = clearProgress()?.getAttribute('class')?.split(/\s+/) ?? []
      expect(classes).toContain('rotate-90')
      expect(classes).toContain('-scale-x-100')
      expect(classes).not.toContain('-rotate-90')
    })

    it('과거 기간에서도 주간 링을 렌더한다(ADR-059 결정 2 — ADR-054 결정 4 폐기)', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: '2026-07-02', // 현재 기간이 아님
        trackedOcids: ['ocid-1'],
        rows: [
          row({ boss: '자쿰', periodKey: '2026-07-02' }),
          row({ boss: '루시드', periodKey: '2026-07-02' }),
        ],
      })

      renderBossProfitScreen()

      expect(clearProgress()).toHaveAccessibleName(`주간 보스 처치 2 / ${WEEKLY_BOSS_CLEAR_LIMIT}`)
    })

    it('분모는 weekly-bosses.json의 WEEKLY_BOSS_CLEAR_LIMIT을 따른다(리터럴 12 금지)', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [row({ boss: '자쿰', periodKey: CURRENT_WEEKLY_PERIOD_KEY })],
      })

      renderBossProfitScreen()

      // queryBy가 아니라 getBy — 없으면 여기서 바로 실패시키고 타입도 non-null로 좁힌다.
      const ring = screen.getByRole('img', { name: /주간 보스 처치/ })
      expect(ring).toHaveAccessibleName(`주간 보스 처치 1 / ${WEEKLY_BOSS_CLEAR_LIMIT}`)
      // 칸 수도 상수를 따라야 한다 — 링과 레이블이 서로 다른 분모를 쓰면 안 된다.
      expect(ring.querySelectorAll('circle')).toHaveLength(WEEKLY_BOSS_CLEAR_LIMIT)
    })

    it('카드에는 n/12 텍스트를 두지 않는다 — 링이 유일한 표현이다(ADR-054 정정 7, 보류)', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [row({ boss: '자쿰', periodKey: CURRENT_WEEKLY_PERIOD_KEY })],
      })

      renderBossProfitScreen()

      // 헤더 가로폭을 두고 캐릭터명과 경합하지 않는 배치를 찾을 때까지 수치 표기는 보류한다.
      // 되살릴 때는 이 테스트를 지우고 배치 계약을 새로 적을 것.
      // 제거 전 배지가 렌더하던 문자열 그대로 — 정규식으로 쓰면 이스케이프가 어긋나도 조용히
      // 통과해(무엇과도 매칭 안 됨) 삭제 검증이 공허해진다.
      expect(screen.queryByText(`1/${WEEKLY_BOSS_CLEAR_LIMIT}`)).not.toBeInTheDocument()
      // 진행률 자체는 남아 있어야 한다(스크린리더는 링의 레이블로 읽는다).
      expect(clearProgress()).toBeInTheDocument()
    })

    it('아바타 테두리가 한도(12)만큼 쪼개진 진행 링이고 처치한 만큼만 채워진다(ADR-054 정정 1)', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [
          row({ boss: '자쿰', periodKey: CURRENT_WEEKLY_PERIOD_KEY }),
          row({ boss: '루시드', periodKey: CURRENT_WEEKLY_PERIOD_KEY }),
        ],
      })

      renderBossProfitScreen()

      // 링은 변환 클래스가 아니라 역할·레이블로 찾는다 — 방향(ADR-059 정정 2)이 바뀌어도
      // 이 테스트가 대상을 놓치지 않게. 방향 자체는 전용 테스트가 잠근다.
      const segments = screen
        .getByRole('img', { name: /주간 보스 처치/ })
        .querySelectorAll('circle')
      expect(segments).toHaveLength(WEEKLY_BOSS_CLEAR_LIMIT)
      // 처치한 2칸만 primary, 나머지는 border — 링이 진행률을 그대로 반영한다.
      const filled = [...segments].filter((segment) => segment.classList.contains('stroke-primary'))
      expect(filled).toHaveLength(2)
      // 칸이 여럿일 때는 dash 간격이 반드시 있어야 한다 — 없으면 12칸이 하나의 원으로 뭉갠다
      // (ADR-059 정정 1의 "칸 하나면 간격 없음"이 여기까지 번지지 않게 막는 가드).
      expect(segments[0]).toHaveAttribute('stroke-dasharray')
    })

    it('과거 월간 기간에서도 월간 링을 렌더한다', () => {
      mockStore({
        status: 'loaded',
        tab: 'monthly',
        periodKey: '2026-06', // 현재 기간이 아님
        trackedOcids: ['ocid-1'],
        rows: [row({ boss: '검은마법사', difficulty: '하드', cycle: 'monthly', periodKey: '2026-06' })],
      })

      renderBossProfitScreen()

      expect(monthlyClearProgress()).toHaveAccessibleName(`월간 보스 처치 1 / ${MONTHLY_BOSS_COUNT}`)
      expect(monthlyClearProgress()?.querySelectorAll('circle.stroke-primary')).toHaveLength(1)
    })
  })

  // 총 수익 헤드라인의 결정석 판매 현황 줄(ADR-054, #53) — 주간 한도 90은 "월드당"이라 캐릭터별
  // 처치 수(위 n/12와 같은 파생값)를 월드로 묶어 합산한다. rows의 world 필드만으로 재현한다.
  describe('월드별 주간 결정석 판매 현황(ADR-054, #53)', () => {
    function crystalRow(): HTMLElement | null {
      return screen.queryByLabelText(/결정석/)
    }

    // 한 캐릭터가 서로 다른 보스 n종을 완료한 행들 — 처치 수 n이 되도록 보스명만 바꿔 만든다.
    function clearedRows(
      ocid: string,
      characterName: string,
      world: string | null,
      bosses: string[],
    ): BossProfitRow[] {
      return bosses.map((boss) =>
        row({ ocid, characterName, world, boss, periodKey: CURRENT_WEEKLY_PERIOD_KEY }),
      )
    }

    it('월드가 하나면 그 월드의 캐릭터 처치 수를 합산해 "n / 90" 한 줄로 보여준다', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1', 'ocid-2'],
        rows: [
          ...clearedRows('ocid-1', '낟낟', '스카니아', ['자쿰', '루시드', '윌']),
          ...clearedRows('ocid-2', '내옆에최성일', '스카니아', ['자쿰', '루시드']),
        ],
      })

      renderBossProfitScreen()

      expect(crystalRow()).toHaveAccessibleName(`주간 결정석 판매 5 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)
      // 단일 월드는 펼칠 것이 없다 — 월드 수 표기도, 토글 버튼도 두지 않는다.
      expect(screen.queryByText(/개 월드/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /결정석/ })).not.toBeInTheDocument()
    })

    it('월드가 여러 개면 분모가 90 × 월드 수가 되고 펼침 토글이 붙는다', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1', 'ocid-2'],
        rows: [
          ...clearedRows('ocid-1', '낟낟', '스카니아', ['자쿰', '루시드', '윌']),
          ...clearedRows('ocid-2', '내옆에최성일', '루나', ['자쿰', '루시드']),
        ],
      })

      renderBossProfitScreen()

      const toggle = screen.getByRole('button', {
        name: `주간 결정석 판매 5 / ${WEEKLY_CRYSTAL_SALE_LIMIT * 2}`,
      })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      // ADR-054 정정 2: 칩에는 수치만 남기고 월드 수·월드명 같은 부가 정보는 팝오버로 넘겼다
      // ("화면에는 간단히, 터치하면 추가 정보" — 사용자 요청). 접힘 상태에서 월드명이 보이면
      // 그만큼 sticky 헤더 가로/세로를 다시 먹는다는 뜻이다.
      expect(screen.queryByText('스카니아')).not.toBeInTheDocument()
      expect(screen.queryByText('루나')).not.toBeInTheDocument()
    })

    it('복수 월드에서 줄을 탭하면 월드별 줄이 펼쳐지고 다시 탭하면 접힌다', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1', 'ocid-2'],
        rows: [
          ...clearedRows('ocid-1', '낟낟', '스카니아', ['자쿰', '루시드', '윌']),
          ...clearedRows('ocid-2', '내옆에최성일', '루나', ['자쿰', '루시드']),
        ],
      })

      renderBossProfitScreen()
      const toggle = screen.getByRole('button', { name: /주간 결정석 판매/ })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText('스카니아')).not.toBeInTheDocument()

      fireEvent.click(toggle)

      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByText('스카니아')).toBeInTheDocument()
      expect(screen.getByText('루나')).toBeInTheDocument()
      // 월드별 분모는 각 월드가 각자 갖는 90 그대로(합산 분모 180이 아니다)
      expect(screen.getByText(`3 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)).toBeInTheDocument()
      expect(screen.getByText(`2 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)).toBeInTheDocument()

      fireEvent.click(toggle)

      expect(screen.queryByText('스카니아')).not.toBeInTheDocument()
    })

    it('월드를 모르는 캐릭터(world: null)의 처치 수는 합계에서 제외한다(ADR-054 결정 6)', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1', 'ocid-2'],
        rows: [
          ...clearedRows('ocid-1', '낟낟', '스카니아', ['자쿰', '루시드']),
          ...clearedRows('ocid-2', '내옆에최성일', null, ['자쿰', '루시드', '윌']),
        ],
      })

      renderBossProfitScreen()

      // "미분류" 줄을 만들지 않고 조용히 뺀다 — 월드는 스카니아 하나뿐이다.
      expect(crystalRow()).toHaveAccessibleName(`주간 결정석 판매 2 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)
      expect(screen.queryByText(/개 월드/)).not.toBeInTheDocument()
    })

    it('모든 캐릭터의 월드를 모르면 결정석 줄 자체를 렌더하지 않는다', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: clearedRows('ocid-1', '낟낟', null, ['자쿰', '루시드']),
      })

      renderBossProfitScreen()

      expect(crystalRow()).not.toBeInTheDocument()
    })

    it('시즌 보스(메이린)는 월드 합계에도 포함하지 않는다', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: clearedRows('ocid-1', '낟낟', '스카니아', ['자쿰', '시즌 보스 메이린']),
      })

      renderBossProfitScreen()

      expect(crystalRow()).toHaveAccessibleName(`주간 결정석 판매 1 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)
    })

    it('월드는 알지만 처치 수가 0이면 "0 / 90"을 그대로 보여준다', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [
          row({
            world: '스카니아',
            periodKey: CURRENT_WEEKLY_PERIOD_KEY,
            isComplete: false,
            partySize: null,
            payoutMeso: 0,
          }),
        ],
      })

      renderBossProfitScreen()

      expect(crystalRow()).toHaveAccessibleName(`주간 결정석 판매 0 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)
    })

    it('월간 탭에서는 분모 없이 월간 결정석 개수만 보여준다(90은 주간 전용 한도)', () => {
      mockStore({
        status: 'loaded',
        tab: 'monthly',
        periodKey: CURRENT_MONTHLY_PERIOD_KEY,
        trackedOcids: ['ocid-1', 'ocid-2'],
        rows: [
          row({
            ocid: 'ocid-1',
            characterName: '낟낟',
            world: '스카니아',
            boss: '검은마법사',
            difficulty: '익스트림',
            cycle: 'monthly',
            periodKey: CURRENT_MONTHLY_PERIOD_KEY,
          }),
          row({
            ocid: 'ocid-2',
            characterName: '내옆에최성일',
            world: '루나',
            boss: '검은마법사',
            difficulty: '익스트림',
            cycle: 'monthly',
            periodKey: CURRENT_MONTHLY_PERIOD_KEY,
          }),
        ],
      })

      renderBossProfitScreen()

      expect(crystalRow()).toHaveAccessibleName('월간 결정석 2개')
      expect(crystalRow()).toHaveTextContent('2개')
      expect(screen.queryByText(new RegExp(`/ ${WEEKLY_CRYSTAL_SALE_LIMIT}`))).not.toBeInTheDocument()
      expect(screen.queryByText(/개 월드/)).not.toBeInTheDocument()
    })

    it('과거 주간 기간에서도 그 주의 결정석 판매 현황을 보여준다(ADR-059 결정 1)', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: '2026-07-02', // 현재 기간이 아님
        trackedOcids: ['ocid-1'],
        rows: [
          row({ world: '스카니아', boss: '자쿰', periodKey: '2026-07-02' }),
          row({ world: '스카니아', boss: '루시드', periodKey: '2026-07-02' }),
        ],
      })

      renderBossProfitScreen()

      // 이월되지 않는 한도라(ADR-054 결정 1) 지난 주 수치는 그 주로 완결된 사실이다.
      expect(crystalRow()).toHaveAccessibleName(`주간 결정석 판매 2 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)
    })

    it('과거 월간 기간에서도 월간 결정석 개수를 보여준다', () => {
      mockStore({
        status: 'loaded',
        tab: 'monthly',
        periodKey: '2026-06', // 현재 기간이 아님
        trackedOcids: ['ocid-1'],
        rows: [
          row({
            world: '스카니아',
            boss: '검은마법사',
            difficulty: '익스트림',
            cycle: 'monthly',
            periodKey: '2026-06',
          }),
        ],
      })

      renderBossProfitScreen()

      expect(crystalRow()).toHaveAccessibleName('월간 결정석 1개')
    })

    it('분모는 weekly-bosses.json의 WEEKLY_CRYSTAL_SALE_LIMIT을 따른다(리터럴 90 금지)', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: clearedRows('ocid-1', '낟낟', '스카니아', ['자쿰', '루시드', '윌']),
      })

      renderBossProfitScreen()

      expect(crystalRow()).toHaveTextContent(`3 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)
    })

    it('ADR-049 회귀 가드: 라벨행에 들어간 결정석 칩은 h-4라 줄 높이를 밀지 않는다(고가 드롭 뱃지는 그대로 absolute)', () => {
      mockStore({
        status: 'loaded',
        tab: 'weekly',
        periodKey: CURRENT_WEEKLY_PERIOD_KEY,
        trackedOcids: ['ocid-1'],
        rows: [row({ world: '스카니아', periodKey: CURRENT_WEEKLY_PERIOD_KEY })],
        dropsByRowKey: {
          [`ocid-1|자쿰|카오스|${CURRENT_WEEKLY_PERIOD_KEY}`]: [
            { category: 'consumable', itemName: VALUABLE_ITEM, quantity: 1 },
          ],
        },
      })

      renderBossProfitScreen()

      // 뱃지는 여전히 라벨행에 absolute로 떠 있어야 한다 — 결정석 줄이 그 자리를 흐름으로 차지하면
      // 뱃지 유무로 헤드라인이 8px 튀는 회귀가 되살아난다.
      const badge = screen.getByRole('img', { name: '이 기간 고가 드롭' })
      expect(badge).toHaveClass('absolute')
      expect(badge.parentElement).toHaveClass('relative')

      // ADR-054 정정 3·4: 칩은 라벨 텍스트 옆(= 라벨행 흐름 안)에 산다. 줄 높이는 라벨의 우연한
      // 높이가 아니라 h-6(24px) 명시 고정이 보장한다 — 그래야 뱃지·칩 유무와 무관하게 항상 같다.
      const chip = crystalRow()
      const labelRow = screen.getByText(/총 수익/).parentElement
      expect(labelRow).toHaveClass('h-6')
      expect(labelRow?.contains(chip)).toBe(true)
      // 칩은 줄 높이(24px)를 넘지 않아야 한다 — 넘으면 h-6 고정이 무의미해지고 줄이 다시 커진다.
      expect(chip).toHaveClass('h-5')
      // 칩은 흐름 안에 있어야 한다 — absolute로 빼면 라벨과 겹친다(뱃지와 달리 좌측에 붙기 때문).
      expect(chip?.className).not.toContain('absolute')
    })
  })
})

