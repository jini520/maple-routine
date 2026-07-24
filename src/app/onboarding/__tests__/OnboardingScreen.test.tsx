// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapleAccount } from '../../../types'
import { OnboardingScreen } from '../OnboardingScreen'
import { useOnboardingStore } from '../../../features/onboarding/store'

vi.mock('../../../features/onboarding/store', () => ({
  useOnboardingStore: vi.fn(),
}))

// ContentCharacterStep이 마운트 시 호출한다 — 후보 목록은 비워둔다(렌더 확인만).
vi.mock('../../../features/schedule-sync/schedule-sync', () => ({
  getCharacterPickerRoster: vi.fn().mockResolvedValue(undefined),
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

  it('status가 selectingTrackingMode이면 TrackingModeStep이 렌더링된다', () => {
    mockStore({ status: 'selectingTrackingMode' })

    render(<OnboardingScreen />)

    expect(screen.getByText('스케줄러를 어떻게 관리할까요?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /자동/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /수동/ })).toBeInTheDocument()
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
    expect(screen.getByTestId('maple-spinner')).toBeInTheDocument()
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

  it('status가 error이고 accounts가 비어있지 않으면 AccountSelectionList가 에러 메시지와 함께 렌더링된다', () => {
    mockStore({
      status: 'error',
      accounts: [account],
      error: { kind: 'storageWriteFailed' },
    })

    render(<OnboardingScreen />)

    expect(screen.getByText(/메이플 ID를 선택/)).toBeInTheDocument()
    expect(screen.getByText('기기에 저장하지 못했습니다. 다시 시도해주세요')).toBeInTheDocument()
  })
})
