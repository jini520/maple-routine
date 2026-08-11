// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapleAccount } from '@core/types'
import { OnboardingScreen } from '../OnboardingScreen'
import { useOnboardingStore } from '@core/features/onboarding/store'

vi.mock('@core/features/onboarding/store', () => ({
  useOnboardingStore: vi.fn(),
}))

// ContentCharacterStep이 마운트 시 호출한다 — 후보 목록은 비워둔다(렌더 확인만).
vi.mock('@core/features/schedule-sync/schedule-sync', () => ({
  getCharacterPickerRoster: vi.fn().mockResolvedValue(undefined),
}))

// ADR-113 결정 3: AccountSelectionList는 프로브가 settle 하기 전에는 목록 대신 진행률만 그린다.
// 이 파일이 보는 것은 "어느 status에서 어떤 화면이 오는가"이므로 프로브는 끝난 것으로 둔다.
vi.mock('@core/features/onboarding/use-account-probes', () => ({
  useAccountProbes: vi.fn(() => ({
    probes: {},
    isSettled: true,
    progress: { completed: 1, total: 1 },
  })),
}))

const mockedUseOnboardingStore = vi.mocked(useOnboardingStore)

const account: MapleAccount = {
  accountId: 'account-1',
  characters: [{ ocid: 'ocid-1', name: '낟낟', world: '엘리시움', jobClass: '렌', level: 293 }],
}

function mockStore(overrides: Partial<ReturnType<typeof useOnboardingStore>>): void {
  mockedUseOnboardingStore.mockReturnValue({
    status: 'awaitingApiKey',
    accounts: [],
    selectedAccountId: null,
    error: null,
    prefetchProgress: null,
    restoreFromStorage: vi.fn(),
    submitApiKey: vi.fn(),
    selectAccount: vi.fn(),
    selectTrackingMode: vi.fn(),
    submitContentCharacters: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('OnboardingScreen', () => {
  it('status가 awaitingApiKey이면 ApiKeyForm이 렌더링된다', () => {
    mockStore({ status: 'awaitingApiKey' })

    render(<OnboardingScreen />)

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  it('status가 verifyingApiKey이면 API 키 폼이 유지되고 제출 버튼이 로딩 상태가 된다', () => {
    mockStore({ status: 'verifyingApiKey' })

    render(<OnboardingScreen />)

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
    const button = screen.getByRole('button', { name: '확인 중' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
    expect(screen.queryByText(/확인하고 있어요/)).not.toBeInTheDocument()
  })

  it('status가 prefetching이면 진행률 바와 문구가 렌더링된다', () => {
    mockStore({ status: 'prefetching', prefetchProgress: { completed: 3, total: 10 } })

    render(<OnboardingScreen />)

    expect(screen.getByText(/캐릭터 정보를 준비하고 있어요/)).toBeInTheDocument()
    expect(screen.getByText(/3\/10/)).toBeInTheDocument()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '30')
  })

  it('status가 prefetching이고 진행률 정보가 아직 없으면 0%로 렌더링된다', () => {
    mockStore({ status: 'prefetching', prefetchProgress: null })

    render(<OnboardingScreen />)

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '0')
  })

  it('status가 selectingAccount이면 AccountSelectionList가 렌더링된다', () => {
    mockStore({ status: 'selectingAccount', accounts: [account] })

    render(<OnboardingScreen />)

    expect(screen.getByText(/메이플 ID를 선택/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
  })

  // AccountSelectionList 의 프로브 대기는 `m-auto` 로 세로 중앙에 서는데, 자동 여백은 **부모가
  // 남는 세로 공간을 줄 때만** 작동한다 — 이 min-h 가 없으면 대기가 화면 상단에 붙는다
  // (사용자 보고 2026-08-09). 둘은 한 쌍이라 한쪽만 있으면 의미가 없다.
  it('selectingAccount 컨테이너가 화면 높이를 줘서 프로브 대기가 중앙에 설 수 있다', () => {
    mockStore({ status: 'selectingAccount', accounts: [account] })

    const { container } = render(<OnboardingScreen />)

    expect(container.firstElementChild).toHaveClass(
      'min-h-[calc(100dvh-var(--sa-top)-var(--sa-bottom))]',
    )
  })

  it('status가 selectingTrackingMode이면 TrackingModeStep이 렌더링된다', () => {
    mockStore({ status: 'selectingTrackingMode' })

    render(<OnboardingScreen />)

    expect(screen.getByText('스케줄러를 어떻게 관리할까요?')).toBeInTheDocument()
    // 수동 옵션의 주의 문구에 "자동으로 추가되지 않아요"가 들어가 /자동/ 은 두 버튼 모두에
    // 걸린다(ADR-035 결정 22) — 접근 가능한 이름이 제목으로 시작하므로 앵커로 좁힌다.
    expect(screen.getByRole('button', { name: /^자동/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^수동/ })).toBeInTheDocument()
  })

  it('status가 selectingContentCharacters이면 ContentCharacterStep이 렌더링된다', () => {
    mockStore({ status: 'selectingContentCharacters' })

    render(<OnboardingScreen />)

    expect(screen.getByText('추적할 캐릭터를 선택해주세요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '계속하기' })).toBeInTheDocument()
  })

  it('status가 seedingTracking이면 시드 준비 스피너와 문구가 렌더링된다', () => {
    mockStore({ status: 'seedingTracking' })

    render(<OnboardingScreen />)

    expect(screen.getByText('체크리스트를 준비하고 있어요')).toBeInTheDocument()
    // ADR-061 결정 1: 24px 이상 자리는 스윕 스피너.
    expect(screen.getByTestId('maple-sweep-spinner')).toBeInTheDocument()
  })

  it('status가 completed이면 완료 placeholder 텍스트가 렌더링된다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    render(<OnboardingScreen />)

    expect(screen.getByText(/완료/)).toBeInTheDocument()
  })

  // 실패 피드백은 토스트(features/onboarding/store.ts의 showError)로 옮겨서, 여기서는 폼이
  // 그대로 남아 재입력할 수 있는지만 확인한다 — 인라인 에러 문구는 더 이상 없다(제거).
  it('status가 error이고 accounts가 비어있으면 ApiKeyForm이 다시 렌더링된다', () => {
    mockStore({ status: 'error', accounts: [], error: { kind: 'invalidApiKey' } })

    render(<OnboardingScreen />)

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  // ADR-083 결정 4: 실패는 토스트가 알린다(스토어가 띄운다) — 목록은 고를 수 있는 상태 그대로
  // 남아야 하므로 화면은 인라인 문구를 그리지 않는다.
  it('status가 error이고 accounts가 비어있지 않으면 인라인 문구 없이 AccountSelectionList만 렌더링된다', () => {
    mockStore({
      status: 'error',
      accounts: [account],
      error: { kind: 'storageWriteFailed' },
    })

    render(<OnboardingScreen />)

    expect(screen.getByText(/메이플 ID를 선택/)).toBeInTheDocument()
    expect(screen.queryByText('기기에 저장하지 못했습니다. 다시 시도해주세요')).not.toBeInTheDocument()
  })
})
