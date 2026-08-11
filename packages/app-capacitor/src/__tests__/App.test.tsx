/// <reference types="node" />
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App, { AppShell } from '../App'
import { notifyLiveUpdateReady } from '@core/native/live-update'
import { useOnboardingStore } from '@core/features/onboarding/store'
import { useContentSchedulerStore } from '@core/features/content-scheduler/store'
import { useBossSchedulerStore } from '@core/features/boss-scheduler/store'
import { useBossProfitStore } from '@core/features/boss-profit/store'
import { useSettingsStore } from '@core/features/settings/store'
import { useThemeStore } from '@core/features/theme/store'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { getThemeDefinition } from '@core/lib/theme-registry'
import jobThemes from '@core/data/job-themes.json'
import type { ThemeDefinition, ThemeName } from '@core/types/theme'

// 배경 있는 테마 정의를 주입하기 위한 부분 모킹(ADR-106 결정 3) — 지금은 배경을 선언한 테마가
// 0개라 테마 이름으로는 "있음" 분기를 못 태운다. 나머지 export 는 실물 그대로다.
vi.mock('@core/lib/theme-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@core/lib/theme-registry')>()
  return { ...actual, getThemeDefinition: vi.fn(actual.getThemeDefinition) }
})

vi.mock('@core/features/onboarding/store', () => ({
  useOnboardingStore: vi.fn(),
}))

vi.mock('@core/features/content-scheduler/store', () => ({
  useContentSchedulerStore: vi.fn(),
}))

vi.mock('@core/features/boss-scheduler/store', () => ({
  useBossSchedulerStore: vi.fn(),
}))

vi.mock('@core/features/boss-profit/store', () => ({
  useBossProfitStore: vi.fn(),
}))

vi.mock('@core/features/settings/store', () => ({
  useSettingsStore: vi.fn(),
}))

vi.mock('@core/features/theme/store', () => ({
  useThemeStore: vi.fn(),
}))

vi.mock('@core/features/tracking-mode/store', () => ({
  useTrackingModeStore: vi.fn(),
}))

// 네이티브 키보드 이벤트를 테스트에서 흉내내기 위한 구독자 목록.
const { keyboardListeners } = vi.hoisted(() => ({
  keyboardListeners: [] as ((visible: boolean) => void)[],
}))

vi.mock('@core/native/system-bars', () => ({
  refreshSafeAreaInsets: vi.fn().mockResolvedValue(undefined),
}))

// [[ADR-117]] 결정 2: notifyAppReady 호출 시점을 검사하려면 이 한 함수만 가로채면 된다 —
// 나머지 export 는 실물 그대로다(같은 모듈을 live-update 스토어가 쓴다).
vi.mock('@core/native/live-update', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@core/native/live-update')>()
  return { ...actual, notifyLiveUpdateReady: vi.fn(async () => {}) }
})

vi.mock('@core/features/ads/tab-switch-ad', () => ({
  startAds: vi.fn().mockResolvedValue(undefined),
  maybeShowTabSwitchAd: vi.fn().mockResolvedValue(undefined),
}))

// [[ADR-101]] 결정 2·6: 부팅 선하이드레이션. 실물은 세 스토어 모듈을 동적 import 하는데 이 파일이
// 그 셋을 훅으로 모킹해 `getState` 가 없으므로, 여기서는 호출 여부만 본다.
const { prehydrateTabStoresMock } = vi.hoisted(() => ({
  prehydrateTabStoresMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@core/features/prehydrate', () => ({
  prehydrateTabStores: prehydrateTabStoresMock,
}))

vi.mock('@core/native/keyboard', () => ({
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
  trackedOcids: [], // ADR-101: 셸 테스트는 화면을 "읽었고 0명"인 빈 상태로 세운다(null 은 "아직 안 읽음"이라 본 화면이 그려진다)
  loadTrackedOcids: vi.fn(),
  saveTrackedOcids: vi.fn(),
  refresh: vi.fn(),
})

mockedUseBossSchedulerStore.mockReturnValue({
  status: 'idle',
  characters: [],
  error: null,
  trackedOcids: [], // ADR-101: 셸 테스트는 화면을 "읽었고 0명"인 빈 상태로 세운다(null 은 "아직 안 읽음"이라 본 화면이 그려진다)
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
  trackedOcids: [], // ADR-101: 셸 테스트는 화면을 "읽었고 0명"인 빈 상태로 세운다(null 은 "아직 안 읽음"이라 본 화면이 그려진다)
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

// 테마 스토어는 **셀렉터로도** 읽힌다 — `PageHeader` 안의 `ThemeHeaderBackdrop` 이
// `useThemeStore((state) => state.theme)` 로 구독한다. 통짜 `mockReturnValue` 는 셀렉터를 무시하고
// 상태 객체를 그대로 돌려줘, 그 객체가 `getThemeDefinition` 에 들어가 터진다(설정 하위 페이지 셋이
// 그 헤더를 쓰면서 드러났다). 셀렉터가 오면 적용하고, 없으면 상태를 그대로 준다.
function mockThemeStore(theme: ThemeName = '렌'): void {
  const state = { theme, restoreFromStorage: vi.fn(), selectTheme: vi.fn() }
  mockedUseThemeStore.mockImplementation(((selector?: (s: typeof state) => unknown) =>
    selector === undefined ? state : selector(state)) as typeof useThemeStore)
}

mockThemeStore()

const restoreTrackingModeFromStorage = vi.fn()
mockedUseTrackingModeStore.mockReturnValue({
  mode: 'auto',
  restoreFromStorage: restoreTrackingModeFromStorage,
  setMode: vi.fn(),
})

// 라우트 화면은 lazy 라(ADR-092) 렌더 직후가 아니라 청크 해석 뒤에 나타난다. 전체 스위트를
// 병렬로 돌리면 그 해석이 findBy 기본 타임아웃(1s)을 간헐적으로 넘겨 이 파일이 흔들렸다
// (2026-08-05 관측 — 단독 실행은 항상 통과). 흔들리는 테스트는 "또 그거네" 하고 무시당해
// 정작 진짜 회귀를 놓치게 만들므로 넉넉히 준다.
const LAZY_SCREEN_TIMEOUT = { timeout: 5000 }

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

  // [[ADR-101]] 결정 2: 탭 첫 진입이 저장소 읽기를 사용자가 보는 앞에서 치르지 않도록 미리 돌린다.
  it('온보딩이 완료돼 있으면 부팅 때 탭 스토어를 선하이드레이션한다', async () => {
    mockStore({ status: 'completed' })

    renderAt('/')

    await waitFor(() => {
      expect(prehydrateTabStoresMock).toHaveBeenCalledTimes(1)
    })
  })

  // 결정 6: `syncSchedules` 가 API 키·계정 없이 던지므로, 온보딩 중에 돌리면 스토어가 error 로
  // 시작하고 토스트까지 울린다.
  it('온보딩이 완료되지 않았으면 선하이드레이션을 돌리지 않는다', async () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/')
    await act(async () => {
      await Promise.resolve()
    })

    expect(prehydrateTabStoresMock).not.toHaveBeenCalled()
  })

  it('status가 completed가 아닐 때 /content로 접근하면 온보딩으로 리다이렉트된다', async () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/content')

    expect(await screen.findByLabelText(/API 키/, {}, LAZY_SCREEN_TIMEOUT)).toBeInTheDocument()
  })

  it('status가 completed가 아닐 때 /boss로 접근하면 온보딩으로 리다이렉트된다', async () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/boss')

    expect(await screen.findByLabelText(/API 키/, {}, LAZY_SCREEN_TIMEOUT)).toBeInTheDocument()
  })

  it('status가 completed가 아닐 때 /profit으로 접근하면 온보딩으로 리다이렉트된다', async () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/profit')

    expect(await screen.findByLabelText(/API 키/, {}, LAZY_SCREEN_TIMEOUT)).toBeInTheDocument()
  })

  it('status가 completed일 때 /profit으로 접근하면 보스 수익 계산기 화면이 보인다', async () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/profit')

    expect(
      await screen.findByRole('heading', { name: '보스 수익' }, LAZY_SCREEN_TIMEOUT),
    ).toBeInTheDocument()
  })

  it('status가 completed가 아닐 때 /settings로 접근하면 온보딩으로 리다이렉트된다', async () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/settings')

    expect(await screen.findByLabelText(/API 키/, {}, LAZY_SCREEN_TIMEOUT)).toBeInTheDocument()
  })

  it('status가 completed일 때 /settings로 접근하면 설정 화면이 보인다', async () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/settings')

    expect(
      await screen.findByRole('heading', { name: '설정' }, LAZY_SCREEN_TIMEOUT),
    ).toBeInTheDocument()
  })

  // ADR-118 결정 2: 설정 하위 페이지 셋은 `/settings` 의 **형제** 라우트이고, 가드도 똑같이 건다.
  it.each([
    ['/settings/guide', '기능 설명'],
    ['/settings/guide/boss-party', '파티 인원 관리'],
    ['/settings/release-notes', '개발 노트'],
    ['/settings/release-notes/boss-party', '파티 인원 관리'],
    ['/settings/account-data', '계정 및 데이터'],
    ['/settings/about', '앱 정보'],
  ])('status가 completed일 때 %s 로 접근하면 그 화면이 보인다', async (path, heading) => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt(path)

    expect(
      await screen.findByRole('heading', { name: heading }, LAZY_SCREEN_TIMEOUT),
    ).toBeInTheDocument()
  })

  // 가드가 없으면 `연결 해제`(온보딩 복귀)를 이 화면들에서 했을 때 리다이렉트가 걸리지 않는다.
  it.each(['/settings/release-notes', '/settings/account-data', '/settings/about'])(
    'status가 completed가 아닐 때 %s 로 접근하면 온보딩으로 리다이렉트된다',
    async (path) => {
      mockStore({ status: 'awaitingApiKey' })

      renderAt(path)

      expect(await screen.findByLabelText(/API 키/, {}, LAZY_SCREEN_TIMEOUT)).toBeInTheDocument()
    },
  )

  // 여기서 처음으로 화면이 이어진다 — 본화면의 이동 행이 실제로 그 화면을 띄우고, 그 화면의
  // `뒤로` 가 설정으로 돌아온다(ADR-118 결정 1·2).
  it.each([
    ['개발 노트', '개발 노트'],
    ['계정 및 데이터', '계정 및 데이터'],
    ['앱 정보', '앱 정보'],
  ])(
    '설정에서 "%s" 행을 누르면 그 화면이 뜨고, 뒤로를 누르면 설정으로 돌아온다',
    async (label, heading) => {
      const user = userEvent.setup()
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })

      renderAt('/settings')

      await user.click(
        await screen.findByRole('button', { name: new RegExp(label) }, LAZY_SCREEN_TIMEOUT),
      )
      expect(
        await screen.findByRole('heading', { name: heading }, LAZY_SCREEN_TIMEOUT),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '뒤로' }))
      expect(
        await screen.findByRole('heading', { name: '설정' }, LAZY_SCREEN_TIMEOUT),
      ).toBeInTheDocument()
    },
  )

  it('status가 completed일 때 /onboarding으로 접근하면 /content로 리다이렉트된다', async () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/onboarding')

    expect(
      await screen.findByRole('heading', { name: '컨텐츠 스케줄러' }, LAZY_SCREEN_TIMEOUT),
    ).toBeInTheDocument()
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

  it('status가 completed가 아닐 때 /로 접근하면 온보딩으로 리다이렉트된다', async () => {
    mockStore({ status: 'awaitingApiKey' })

    renderAt('/')

    expect(await screen.findByLabelText(/API 키/, {}, LAZY_SCREEN_TIMEOUT)).toBeInTheDocument()
  })

  it('status가 completed일 때 /로 접근하면 /content로 리다이렉트된다', async () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/')

    expect(
      await screen.findByRole('heading', { name: '컨텐츠 스케줄러' }, LAZY_SCREEN_TIMEOUT),
    ).toBeInTheDocument()
  })

  // top safe-area padding 은 **탭 레이어**가 갖는다([[ADR-120]] 결정 4). 바깥 루트에 두면 그
  // 레이어의 위쪽 모서리가 노치만큼 내려가는데, 전환 중 `transform` 이 걸리면 `fixed` 후손이
  // 뷰포트가 아니라 그 요소의 패딩 박스를 기준으로 잡혀 안전영역이 두 번 더해진다.
  it('탭 레이어에 top safe-area padding이 적용된다', () => {
    mockStore({ status: 'awaitingApiKey' })

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('tab-layer')).toHaveClass('pt-[var(--sa-top)]')
  })

  // 겹침 순서를 위해 **항상** 스태킹 컨텍스트여야 한다([[ADR-120]] 결정 8) — `transform` 이 걸린
  // 프레임에만 컨텍스트가 생기면 탭바(z-30)와 오버레이의 상대 순서가 전환 시작·종료에 뒤집힌다.
  it('탭 레이어는 isolate 로 스태킹 컨텍스트를 고정한다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/content')

    expect(screen.getByTestId('tab-layer')).toHaveClass('isolate')
  })

  // 오버레이는 탭 레이어 **밖**에 붙어야 그 요소의 transform 에 딸려 밀리지 않는다(결정 3).
  it('스택 오버레이의 포털 루트가 탭 레이어의 형제로 존재한다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/content')

    const stackRoot = screen.getByTestId('stack-root')
    expect(stackRoot).toBeInTheDocument()
    expect(stackRoot.parentElement).toBe(screen.getByTestId('tab-layer').parentElement)
  })

  it('하단 탭바에 bottom safe-area padding이 적용된다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    renderAt('/content')

    expect(screen.getByRole('navigation')).toHaveClass('pb-[var(--sa-bottom)]')
  })

  it('status가 completed일 때 컨텐츠 래퍼의 하단 padding이 탭바 높이와 safe-area를 함께 반영한다', () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    render(
      <MemoryRouter initialEntries={['/content']}>
        <AppShell />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('tab-layer').firstChild).toHaveClass(
      'pb-[calc(4rem+var(--sa-bottom))]',
    )
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
   * 배경 없는 테마에는 DOM 자체가 늘지 않아야 한다.
   *
   * "있음" 쪽은 **정의를 주입해** 태운다([[ADR-106]] 결정 3) — 지금은 배경을 선언한 테마가 0개라
   * 테마 이름으로는 이 분기에 못 들어가는데, 여기서 볼 것은 어느 테마가 배경을 갖느냐가 아니라
   * `AppShell` 이 `background` 유무로 백드롭과 `bg-bg` 를 가르느냐다.
   */
  describe('테마 배경 백드롭', () => {
    // vi.clearAllMocks() 는 반환값을 지우지 않는다 — 바꾼 테마가 다음 테스트로 새지 않게 되돌린다.
    afterEach(() => {
      mockThemeStore()
      vi.mocked(getThemeDefinition).mockReset()
    })

    function withThemeBackground(): void {
      vi.mocked(getThemeDefinition).mockReturnValue({
        ...(jobThemes.혼테일 as ThemeDefinition),
        background: {
          image: 'hontail-cave',
          size: 'cover',
          position: 'center',
          dim: 0.82,
          fadeTop: '0px',
        },
      })
    }

    it('배경이 없는 테마에서는 백드롭을 렌더하지 않는다', () => {
      mockThemeStore()
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })

      renderAt('/content')

      expect(screen.queryByTestId('theme-backdrop')).not.toBeInTheDocument()
    })

    it('배경이 있는 테마에서는 백드롭을 렌더한다', () => {
      withThemeBackground()
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
      withThemeBackground()
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })

      renderAt('/content')

      const root = screen.getByTestId('theme-backdrop').parentElement
      expect(root).not.toBeNull()
      expect(root!.className).not.toContain('bg-bg')
    })

    it('배경이 없는 테마에서는 루트가 그대로 bg-bg 를 칠한다', () => {
      mockThemeStore()
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

    it('기본 동작을 막아도 탭 이동은 정상 동작한다', async () => {
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })
      renderAt('/content')

      act(() => {
        screen.getByRole('link', { name: '보스' }).click()
      })

      // 도착 화면은 lazy 청크라 동기 플러시에 안 잡힌다 — 이 파일의 다른 이동 테스트와 같이 기다린다.
      expect(await screen.findByRole('heading', { name: '보스 스케줄러' }, LAZY_SCREEN_TIMEOUT)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '보스' })).toHaveAttribute('aria-current', 'page')
    })
  })

  // ADR-099 결정 7: 화면 스크롤 컨테이너가 스크롤포트 하단을 탭바 높이만큼 줄여야 인디케이터가
  // 탭바 뒤로 들어가지 않는다. 그 값은 가정이 아니라 실측이다 — `4rem` 으로 가정했더니 실제
  // 높이와 어긋나 컨테이너와 탭바 사이에 띠가 생겼다(실기기 관측).
  describe('탭바 높이 실측 (ADR-099)', () => {
    it('탭바가 보이면 --tab-bar-h 를 실측값으로 내보낸다', () => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        height: 90, width: 0, top: 0, left: 0, right: 0, bottom: 90, x: 0, y: 0, toJSON: () => ({}),
      })
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })

      renderAt('/content')

      expect(document.documentElement.style.getPropertyValue('--tab-bar-h')).toBe('90px')
    })

    it('탭바가 사라지면(온보딩·키보드) 0으로 되돌린다 — 컨테이너가 화면 바닥까지 쓴다', async () => {
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })
      renderAt('/content')

      act(() => {
        emitKeyboardVisibility(true)
      })

      await waitFor(() => {
        expect(document.documentElement.style.getPropertyValue('--tab-bar-h')).toBe('0px')
      })
    })
  })

  // [[ADR-120]] 이 [[ADR-098]] 결정 1(이동 전 `scrollTo(0, 0)`)을 폐기했다. 그 처방은 네 탭이
  // **문서 전체 스크롤 하나를 공유하던** 시절의 것이고([[ADR-072]] 결정 1), [[ADR-099]]·[[ADR-100]]
  // 이 스크롤을 화면 소유로 옮기고 [[ADR-120]] 이 마지막 남은 설정 탭까지 옮기면서 무효 호출이 됐다.
  //
  // 그래서 이 절이 지키는 것이 뒤집혔다 — "옮기는가"가 아니라 **"옮기지 않는가"**, 그리고 그것을
  // 안전하게 만드는 전제(**모든 탭 화면이 자기 스크롤을 소유한다**)가 성립하는가다. 전제가 깨지면
  // 리셋을 지운 것이 회귀가 되므로, 그 전제 쪽이 진짜 가드다.
  describe('탭 이동과 스크롤 (ADR-120 — ADR-098 결정 1 폐기)', () => {
    it('탭을 눌러도 문서 스크롤을 건드리지 않는다', async () => {
      mockStore({ status: 'completed', selectedAccountId: 'account-1' })
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      renderAt('/content')

      act(() => {
        screen.getByRole('link', { name: '보스' }).click()
      })

      expect(scrollTo).not.toHaveBeenCalled()
      // 도착 화면이 실제로 그려졌는지까지 봐야 "스크롤을 안 건드렸다"가 의미를 갖는다(lazy 청크).
      expect(await screen.findByRole('heading', { name: '보스 스케줄러' }, LAZY_SCREEN_TIMEOUT)).toBeInTheDocument()
      expect(scrollTo).not.toHaveBeenCalled()
      scrollTo.mockRestore()
    })

  })
})

/**
 * notifyAppReady 호출 시점([[ADR-117]] 결정 2).
 *
 * capgo 의 유일한 안전망은 *"appReadyTimeout(기본 10초) 안에 notifyAppReady 가 없으면 직전 정상
 * 번들로 되돌린다"* 이고, 한 번 SUCCESS 로 찍힌 번들은 이후 어떤 실행에서도 롤백되지 않는다.
 * 그래서 이 호출은 **"React 가 마운트에 성공했다"** 를 뜻해야 한다 — 번들 첫 문장에서 부르면
 * 렌더가 죽는 번들이 SUCCESS 로 찍혀 영구히 박힌다(이슈 #175 의 안전망 ①).
 */
describe('notifyAppReady 호출 시점 (ADR-117 결정 2)', () => {
  // 던지는 구현이 다음 테스트로 새지 않게 되돌린다 — vi.clearAllMocks() 는 구현을 지우지 않는다.
  afterEach(() => {
    mockedUseOnboardingStore.mockReset()
  })

  it('정상 마운트되면 notifyAppReady 를 1번 호출한다', async () => {
    mockStore({ status: 'awaitingApiKey' })

    render(<App />)

    await waitFor(() => {
      expect(vi.mocked(notifyLiveUpdateReady)).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * 이 케이스가 이 결정의 전부다. 호출을 App(ErrorBoundary 를 **렌더하는** 쪽)에 두면 자식이
   * 렌더 중에 던져도 App 자신은 정상 커밋돼 effect 가 돌아, **부팅 크래시로 죽은 번들이
   * "정상"으로 찍힌다.** AppShell 은 ErrorBoundary 안이라 렌더가 던지면 커밋되지 않는다.
   */
  it('부팅 렌더가 던지면 호출하지 않는다 — 그래야 capgo 가 직전 번들로 롤백한다', () => {
    // React 는 바운더리가 잡은 예외를 콘솔에 한 번 더 뱉는다(ErrorBoundary 의 console.error 와 별개).
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockedUseOnboardingStore.mockImplementation(() => {
      throw new Error('부팅 크래시')
    })

    render(<App />)

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument()
    expect(vi.mocked(notifyLiveUpdateReady)).not.toHaveBeenCalled()

    consoleError.mockRestore()
  })

  // main.tsx 는 사이드이펙트 모듈이라 import 로 검사하기 까다롭다 — 소스를 읽어 단언한다
  // (index-html-analytics.test.ts 와 같은 계열). 경로를 문자열로 푸는 이유는
  // index-html-boot-cover.test.ts 와 같다 — jsdom 전역 URL 을 node 의 fileURLToPath 가 안 받는다.
  it('main.tsx 는 더 이상 부팅 첫 문장에서 부르지 않는다', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../main.tsx'),
      'utf8',
    )

    expect(source).not.toContain('notifyLiveUpdateReady')
    // 부팅 백그라운드 체크([[ADR-026]])는 이 결정과 무관하므로 그대로 남아 있어야 한다.
    expect(source).toContain('checkOnBoot')
  })
})
