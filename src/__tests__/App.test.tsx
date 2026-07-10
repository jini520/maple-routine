// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../App'
import { useOnboardingStore } from '../features/onboarding/store'

vi.mock('../features/onboarding/store', () => ({
  useOnboardingStore: vi.fn(),
}))

const mockedUseOnboardingStore = vi.mocked(useOnboardingStore)

function mockStore(overrides: Partial<ReturnType<typeof useOnboardingStore>>): void {
  mockedUseOnboardingStore.mockReturnValue({
    status: 'awaitingApiKey',
    accounts: [],
    selectedAccountId: null,
    error: null,
    restoreFromStorage: vi.fn(),
    submitApiKey: vi.fn(),
    selectAccount: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  })
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AppShell', () => {
  it('마운트 시 restoreFromStorage가 정확히 1번 호출된다', () => {
    const restoreFromStorage = vi.fn()
    mockStore({ restoreFromStorage })

    renderAt('/')

    expect(restoreFromStorage).toHaveBeenCalledTimes(1)
  })

  it('status가 completed가 아닐 때 /daily로 접근하면 온보딩으로 리다이렉트된다', () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/daily')

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  it('status가 completed가 아닐 때 /weekly로 접근하면 온보딩으로 리다이렉트된다', () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/weekly')

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  it('status가 completed일 때 /onboarding으로 접근하면 /daily로 리다이렉트된다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/onboarding')

    expect(screen.getByText(/일간 화면 준비 중/)).toBeInTheDocument()
  })

  it('status가 completed일 때 내비게이션(일간/주간 링크)이 보인다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/daily')

    expect(screen.getByRole('link', { name: '일간' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '주간' })).toBeInTheDocument()
  })

  it('status가 completed가 아닐 때는 내비게이션이 보이지 않는다', () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/')

    expect(screen.queryByRole('link', { name: '일간' })).not.toBeInTheDocument()
  })

  it('status가 completed가 아닐 때 /로 접근하면 온보딩으로 리다이렉트된다', () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/')

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  it('status가 completed일 때 /로 접근하면 /daily로 리다이렉트된다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/')

    expect(screen.getByText(/일간 화면 준비 중/)).toBeInTheDocument()
  })
})
