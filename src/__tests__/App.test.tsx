// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../App'
import { useOnboardingStore } from '../features/onboarding/store'
import { useContentSchedulerStore } from '../features/content-scheduler/store'
import { useBossSchedulerStore } from '../features/boss-scheduler/store'
import { useBossProfitStore } from '../features/boss-profit/store'
import { useSettingsStore } from '../features/settings/store'
import { useThemeStore } from '../features/theme/store'
import { useTrackingModeStore } from '../features/tracking-mode/store'

vi.mock('../features/onboarding/store', () => ({
  useOnboardingStore: vi.fn(),
}))

vi.mock('../features/content-scheduler/store', () => ({
  useContentSchedulerStore: vi.fn(),
}))

vi.mock('../features/boss-scheduler/store', () => ({
  useBossSchedulerStore: vi.fn(),
}))

vi.mock('../features/boss-profit/store', () => ({
  useBossProfitStore: vi.fn(),
}))

vi.mock('../features/settings/store', () => ({
  useSettingsStore: vi.fn(),
}))

vi.mock('../features/theme/store', () => ({
  useThemeStore: vi.fn(),
}))

vi.mock('../features/tracking-mode/store', () => ({
  useTrackingModeStore: vi.fn(),
}))

// 네이티브 키보드 이벤트를 테스트에서 흉내내기 위한 구독자 목록.
const { keyboardListeners } = vi.hoisted(() => ({
  keyboardListeners: [] as ((visible: boolean) => void)[],
}))

vi.mock('../native/system-bars', () => ({
  refreshSafeAreaInsets: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../native/keyboard', () => ({
  addKeyboardVisibilityListener: vi.fn(async (onChange: (visible: boolean) => void) => {
    keyboardListeners.push(onChange)
    return () => {
      const index = keyboardListeners.indexOf(onChange)
      if (index >= 0) keyboardListeners.splice(index, 1)
    }
  }),
}))

function emitKeyboardVisibility(visible: boolean): void {
  keyboardListeners.forEach((onChange) => {
    onChange(visible)
  })
}

const mockedUseOnboardingStore = vi.mocked(useOnboardingStore)
const mockedUseContentSchedulerStore = vi.mocked(useContentSchedulerStore)
const mockedUseBossSchedulerStore = vi.mocked(useBossSchedulerStore)
const mockedUseBossProfitStore = vi.mocked(useBossProfitStore)
const mockedUseSettingsStore = vi.mocked(useSettingsStore)
const mockedUseThemeStore = vi.mocked(useThemeStore)
const mockedUseTrackingModeStore = vi.mocked(useTrackingModeStore)

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

mockedUseContentSchedulerStore.mockReturnValue({
  status: 'idle',
  characters: [],
  error: null,
  trackedOcids: null,
  loadTrackedOcids: vi.fn(),
  saveTrackedOcids: vi.fn(),
  refresh: vi.fn(),
})

mockedUseBossSchedulerStore.mockReturnValue({
  status: 'idle',
  characters: [],
  error: null,
  trackedOcids: null,
  loadTrackedOcids: vi.fn(),
  saveTrackedOcids: vi.fn(),
  refresh: vi.fn(),
})

mockedUseBossProfitStore.mockReturnValue({
  status: 'idle',
  rows: [],
  // ADR-083 결정 3: 기간 실패 토스트 훅이 characterGroups를 읽어야 해서 그 계산이 빈 상태 조기
  // 반환보다 위로 올라갔다 — 이 스텁도 순회 대상을 갖고 있어야 한다.
  weeklySubtotals: [],
  error: null,
  staleCharacterNames: [],
  trackedOcids: null,
  loadTrackedOcids: vi.fn(),
  refresh: vi.fn(),
  setPartySize: vi.fn(),
})

mockedUseSettingsStore.mockReturnValue({
  status: 'idle',
  accounts: [],
  error: null,
  prefetchProgress: null,
  changeApiKey: vi.fn(),
  refreshAccounts: vi.fn(),
  selectAccount: vi.fn(),
  disconnect: vi.fn(),
  reset: vi.fn(),
})

mockedUseThemeStore.mockReturnValue({
  theme: '렌',
  restoreFromStorage: vi.fn(),
  selectTheme: vi.fn(),
})

const restoreTrackingModeFromStorage = vi.fn()
mockedUseTrackingModeStore.mockReturnValue({
  mode: 'auto',
  restoreFromStorage: restoreTrackingModeFromStorage,
  setMode: vi.fn(),
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

  it('마운트 시 트래킹 모드 restoreFromStorage가 정확히 1번 호출된다', () => {
    mockStore({})

    renderAt('/')

    expect(restoreTrackingModeFromStorage).toHaveBeenCalledTimes(1)
  })

  it('status가 completed가 아닐 때 /content로 접근하면 온보딩으로 리다이렉트된다', () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/content')

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  it('status가 completed가 아닐 때 /boss로 접근하면 온보딩으로 리다이렉트된다', () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/boss')

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  it('status가 completed가 아닐 때 /profit으로 접근하면 온보딩으로 리다이렉트된다', () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/profit')

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  it('status가 completed일 때 /profit으로 접근하면 보스 수익 계산기 화면이 보인다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/profit')

    expect(screen.getByRole('heading', { name: '보스 수익' })).toBeInTheDocument()
  })

  it('status가 completed가 아닐 때 /settings로 접근하면 온보딩으로 리다이렉트된다', () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/settings')

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  it('status가 completed일 때 /settings로 접근하면 설정 화면이 보인다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/settings')

    expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument()
  })

  it('status가 completed일 때 /onboarding으로 접근하면 /content로 리다이렉트된다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/onboarding')

    expect(screen.getByRole('heading', { name: '컨텐츠 스케줄러' })).toBeInTheDocument()
  })

  it('status가 completed일 때 하단 탭바(컨텐츠/보스/수익/설정 탭)가 보인다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/content')

    expect(screen.getByRole('link', { name: '컨텐츠' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '보스' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '수익' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '설정' })).toBeInTheDocument()
  })

  it('"수익" 탭 아이콘은 공용 ProfitIcon이다(ADR-066 — 세 자리 통일)', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/content')

    // 나머지 세 탭은 lucide 그대로다 — 수익 탭만 커스텀 아이콘을 쓴다.
    expect(
      screen.getByRole('link', { name: '수익' }).querySelector('[data-testid="profit-icon"]'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '보스' }).querySelector('[data-testid="profit-icon"]'),
    ).not.toBeInTheDocument()
  })

  it('status가 completed가 아닐 때는 탭바가 렌더링되지 않는다', () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/')

    expect(screen.queryByRole('link', { name: '컨텐츠' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '보스' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '수익' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '설정' })).not.toBeInTheDocument()
  })

  it('status가 completed이고 현재 경로가 /content이면 "컨텐츠" 탭이 활성 스타일이다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/content')

    expect(screen.getByRole('link', { name: '컨텐츠' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '보스' })).not.toHaveAttribute('aria-current')
  })

  it('status가 completed이고 현재 경로가 /boss이면 "보스" 탭이 활성 스타일이다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/boss')

    expect(screen.getByRole('link', { name: '보스' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '컨텐츠' })).not.toHaveAttribute('aria-current')
  })

  it('status가 completed이고 현재 경로가 /profit이면 "수익" 탭이 활성 스타일이다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/profit')

    expect(screen.getByRole('link', { name: '수익' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '컨텐츠' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: '보스' })).not.toHaveAttribute('aria-current')
  })

  it('탭바에 "타이머"/"드랍" 텍스트가 없다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/content')

    expect(screen.queryByText('타이머')).not.toBeInTheDocument()
    expect(screen.queryByText('드랍')).not.toBeInTheDocument()
  })

  it('status가 completed가 아닐 때 /로 접근하면 온보딩으로 리다이렉트된다', () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/')

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  it('status가 completed일 때 /로 접근하면 /content로 리다이렉트된다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/')

    expect(screen.getByRole('heading', { name: '컨텐츠 스케줄러' })).toBeInTheDocument()
  })

  it('최상단 컨테이너에 top safe-area padding이 적용된다', () => {
    mockStore({ status: 'awaitingApiKey' })

    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(container.firstChild).toHaveClass('pt-[var(--sa-top)]')
  })

  it('하단 탭바에 bottom safe-area padding이 적용된다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/content')

    expect(screen.getByRole('navigation')).toHaveClass('pb-[var(--sa-bottom)]')
  })

  it('status가 completed일 때 컨텐츠 래퍼의 하단 padding이 탭바 높이와 safe-area를 함께 반영한다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    const { container } = render(
      <MemoryRouter initialEntries={['/content']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(container.firstChild?.firstChild).toHaveClass('pb-[calc(4rem+var(--sa-bottom))]')
  })

  // 키보드가 뜨면 네이티브가 WebView를 그만큼 밀어 올려 탭바가 키보드 바로 위에 얹힌다 → 그동안 숨긴다.
  describe('키보드가 올라왔을 때', () => {
    it('하단 탭바를 숨긴다', async () => {
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })

      renderAt('/content')
      expect(screen.getByRole('navigation')).toBeInTheDocument()

      await act(async () => {
        emitKeyboardVisibility(true)
      })

      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    })

    it('키보드가 내려가면 탭바를 다시 보여준다', async () => {
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })

      renderAt('/content')

      await act(async () => {
        emitKeyboardVisibility(true)
      })
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()

      await act(async () => {
        emitKeyboardVisibility(false)
      })

      expect(screen.getByRole('navigation')).toBeInTheDocument()
    })
  })

  /**
   * 테마 배경 이미지([[ADR-088]] 결정 4) — 값을 가진 테마에서만 백드롭을 렌더한다.
   * 나머지 네 테마에는 DOM 자체가 늘지 않아야 한다.
   */
  describe('테마 배경 백드롭', () => {
    // vi.clearAllMocks() 는 반환값을 지우지 않는다 — 바꾼 테마가 다음 테스트로 새지 않게 되돌린다.
    afterEach(() => {
      mockedUseThemeStore.mockReturnValue({
        theme: '렌',
        restoreFromStorage: vi.fn(),
        selectTheme: vi.fn(),
      })
    })

    it('배경이 없는 테마에서는 백드롭을 렌더하지 않는다', () => {
      mockedUseThemeStore.mockReturnValue({
        theme: '렌',
        restoreFromStorage: vi.fn(),
        selectTheme: vi.fn(),
      })
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })

      renderAt('/content')

      expect(screen.queryByTestId('theme-backdrop')).not.toBeInTheDocument()
    })

    it('배경이 있는 테마에서는 백드롭을 렌더한다', () => {
      mockedUseThemeStore.mockReturnValue({
        theme: '혼테일',
        restoreFromStorage: vi.fn(),
        selectTheme: vi.fn(),
      })
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })

      renderAt('/content')

      expect(screen.getByTestId('theme-backdrop')).toBeInTheDocument()
    })

    /**
     * 백드롭은 `z-index: -1` 인데, **음수 z-index 는 부모가 스태킹 컨텍스트를 만들 때만** 부모
     * 배경 위에 온다. 앱 루트(`div.min-h-screen`)는 스태킹 컨텍스트가 아니라서, 루트가 `bg-bg` 로
     * 칠하면 그 배경이 백드롭 **위**에 그려져 이미지가 통째로 사라진다(브라우저에서 실제로 확인,
     * 2026-08-03). 바탕색은 `body` 가 이미 같은 값으로 칠하므로 루트에서 뺀다.
     */
    it('배경이 있는 테마에서는 루트가 배경색을 칠하지 않는다 — 칠하면 백드롭이 그 밑에 깔린다', () => {
      mockedUseThemeStore.mockReturnValue({
        theme: '혼테일',
        restoreFromStorage: vi.fn(),
        selectTheme: vi.fn(),
      })
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })

      renderAt('/content')

      const root = screen.getByTestId('theme-backdrop').parentElement
      expect(root).not.toBeNull()
      expect(root!.className).not.toContain('bg-bg')
    })

    it('배경이 없는 테마에서는 루트가 그대로 bg-bg 를 칠한다', () => {
      mockedUseThemeStore.mockReturnValue({
        theme: '렌',
        restoreFromStorage: vi.fn(),
        selectTheme: vi.fn(),
      })
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })

      const { container } = render(
        <MemoryRouter initialEntries={['/content']}>
          <AppShell />
        </MemoryRouter>,
      )

      expect(container.querySelector('div.min-h-screen')?.className).toContain('bg-bg')
    })
  })

  // ADR-050: iOS WKWebView가 두 손가락 동시 탭에서 드물게 합성하는 클릭은 React 이벤트 시스템을
  // 타지 않아 NavLink의 preventDefault가 걸리지 않는다. 그대로 두면 <a href>의 기본 동작이 실행돼
  // 문서 전체가 다시 로드되고(2026-07-28 실기기 계측: click → PAGEHIDE), 그 리로드가
  // closeBossProfitDb를 못 거쳐 네이티브 SQLite 커넥션이 stale하게 남는다.
  describe('하단 탭바 클릭 인터셉터 (ADR-050)', () => {
    function navBubbleDefaultPrevented(link: HTMLElement): { read: () => boolean | null } {
      const nav = link.closest('nav')
      if (nav === null) throw new Error('탭바 <nav>를 찾지 못했습니다')
      let prevented: boolean | null = null
      // <nav>의 버블 리스너는 React(#root에 위임)보다 먼저 돈다 — 여기서 이미 차단돼 있다는 것은
      // React 바깥(캡처 단계)에서 막혔다는 뜻이고, 그래야 React를 안 타는 클릭도 막힌다.
      nav.addEventListener('click', (event) => {
        prevented = event.defaultPrevented
      })
      return { read: () => prevented }
    }

    it('탭 클릭의 기본 동작이 React보다 먼저 차단된다', () => {
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })
      renderAt('/content')

      const bossLink = screen.getByRole('link', { name: '보스' })
      const probe = navBubbleDefaultPrevented(bossLink)

      act(() => {
        bossLink.click()
      })

      expect(probe.read()).toBe(true)
    })

    it('네 탭 모두 기본 동작이 차단된다', () => {
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })
      renderAt('/content')

      for (const name of ['컨텐츠', '보스', '수익', '설정']) {
        const link = screen.getByRole('link', { name })
        const probe = navBubbleDefaultPrevented(link)

        act(() => {
          link.click()
        })

        expect(probe.read(), `${name} 탭`).toBe(true)
      }
    })

    it('기본 동작을 막아도 탭 이동은 정상 동작한다', () => {
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })
      renderAt('/content')

      act(() => {
        screen.getByRole('link', { name: '보스' }).click()
      })

      expect(screen.getByRole('heading', { name: '보스 스케줄러' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '보스' })).toHaveAttribute('aria-current', 'page')
    })
  })
})
