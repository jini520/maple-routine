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

  it('status가 verifyingApiKey이면 로딩 표시가 렌더링된다', () => {
    mockStore({ status: 'verifyingApiKey' })

    render(<OnboardingScreen />)

    expect(screen.queryByLabelText(/API 키/)).not.toBeInTheDocument()
    expect(screen.getByText(/확인/)).toBeInTheDocument()
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

  it('status가 completed이면 완료 placeholder 텍스트가 렌더링된다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    render(<OnboardingScreen />)

    expect(screen.getByText(/완료/)).toBeInTheDocument()
  })

  it('status가 error이고 accounts가 비어있으면 ApiKeyForm이 에러 메시지와 함께 렌더링된다', () => {
    mockStore({ status: 'error', accounts: [], error: { kind: 'invalidApiKey' } })

    render(<OnboardingScreen />)

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
    expect(screen.getByText('API 키가 유효하지 않습니다')).toBeInTheDocument()
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
