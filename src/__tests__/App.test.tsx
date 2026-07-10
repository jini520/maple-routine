// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../App'
import { useOnboardingStore } from '../features/onboarding/store'
import { useDailySchedulerStore } from '../features/daily-scheduler/store'

vi.mock('../features/onboarding/store', () => ({
  useOnboardingStore: vi.fn(),
}))

vi.mock('../features/daily-scheduler/store', () => ({
  useDailySchedulerStore: vi.fn(),
}))

const mockedUseOnboardingStore = vi.mocked(useOnboardingStore)
const mockedUseDailySchedulerStore = vi.mocked(useDailySchedulerStore)

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

mockedUseDailySchedulerStore.mockReturnValue({
  status: 'idle',
  characters: [],
  error: null,
  refresh: vi.fn(),
})

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

    expect(screen.getByRole('heading', { name: '일간 스케줄러' })).toBeInTheDocument()
  })

  it('status가 completed일 때 하단 탭바(일간/주간 탭)가 보인다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/daily')

    expect(screen.getByRole('link', { name: '일간' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '주간' })).toBeInTheDocument()
  })

  it('status가 completed가 아닐 때는 탭바가 렌더링되지 않는다', () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/')

    expect(screen.queryByRole('link', { name: '일간' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '주간' })).not.toBeInTheDocument()
  })

  it('status가 completed이고 현재 경로가 /daily이면 "일간" 탭이 활성 스타일이다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/daily')

    expect(screen.getByRole('link', { name: '일간' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '주간' })).not.toHaveAttribute('aria-current')
  })

  it('status가 completed이고 현재 경로가 /weekly이면 "주간" 탭이 활성 스타일이다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/weekly')

    expect(screen.getByRole('link', { name: '주간' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '일간' })).not.toHaveAttribute('aria-current')
  })

  it('탭바에 "타이머"/"수익"/"드랍" 텍스트가 없다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/daily')

    expect(screen.queryByText('타이머')).not.toBeInTheDocument()
    expect(screen.queryByText('수익')).not.toBeInTheDocument()
    expect(screen.queryByText('드랍')).not.toBeInTheDocument()
  })

  it('status가 completed가 아닐 때 /로 접근하면 온보딩으로 리다이렉트된다', () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/')

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  it('status가 completed일 때 /로 접근하면 /daily로 리다이렉트된다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/')

    expect(screen.getByRole('heading', { name: '일간 스케줄러' })).toBeInTheDocument()
  })
})
