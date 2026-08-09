// @vitest-environment jsdom
//
// 라우트 코드 분할(ADR-092)의 회귀 방지.
//
// 이 파일의 핵심은 **Suspense 경계의 위치**다. `<Routes>` 전체를 하나의 <Suspense>로 감싸면
// /profit/drops 청크가 로드되는 동안 부모 BossProfitScreen까지 폴백으로 대체되는데, 그것은
// ADR-077이 중첩 라우트로 막아낸 증상(아코디언 펼침·보던 기간·스크롤 상실, iOS WKWebView의
// stuck sticky 헤더가 빈 화면이 되는 것)을 그대로 되살린다. 로드가 끝난 뒤를 보는 테스트로는
// 이 실수를 잡을 수 없으므로(끝나면 어차피 부모가 돌아온다) **영원히 resolve되지 않는 청크**로
// 서스펜드 상태를 고정해 두고, 그 순간 부모가 살아 있는지를 본다.
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
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

// 드랍 히스토리 화면을 **영원히 서스펜드**시킨다 — resolve되지 않는 프라미스를 throw하는 것이
// React의 서스펜스 프로토콜이라, 이 컴포넌트는 가장 가까운 <Suspense> 폴백을 띄운 채로 멈춘다.
// (모듈 팩토리 자체를 대기시키면 vitest의 모듈 해석이 통째로 멈춰 테스트가 끝나지 않는다.)
vi.mock('../app/boss-profit/DropHistoryScreen', () => ({
  DropHistoryScreen: (): never => {
    throw new Promise<never>(() => {})
  },
}))

vi.mock('../features/onboarding/store', () => ({ useOnboardingStore: vi.fn() }))
vi.mock('../features/content-scheduler/store', () => ({ useContentSchedulerStore: vi.fn() }))
vi.mock('../features/boss-scheduler/store', () => ({ useBossSchedulerStore: vi.fn() }))
vi.mock('../features/boss-profit/store', () => ({ useBossProfitStore: vi.fn() }))
vi.mock('../features/settings/store', () => ({ useSettingsStore: vi.fn() }))
vi.mock('../features/theme/store', () => ({ useThemeStore: vi.fn() }))
vi.mock('../features/tracking-mode/store', () => ({ useTrackingModeStore: vi.fn() }))

vi.mock('../native/system-bars', () => ({
  refreshSafeAreaInsets: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../features/ads/tab-switch-ad', () => ({
  startAds: vi.fn().mockResolvedValue(undefined),
  maybeShowTabSwitchAd: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../native/keyboard', () => ({
  addKeyboardVisibilityListener: vi.fn(async () => () => {}),
}))

vi.mocked(useOnboardingStore).mockReturnValue({
  status: 'completed',
  accounts: [],
  selectedAccountId: 'account-1',
  error: null,
  // ADR-116 결정 1: 이 셸 테스트는 "알림 없음" 상태를 세운다 — 빠뜨리면 ApiKeyNoticeModal 이
  // 모든 라우트 위에 떠서 라우팅 단언이 통째로 어긋난다.
  apiKeyNotice: null,
  restoreFromStorage: vi.fn(),
  submitApiKey: vi.fn(),
  selectAccount: vi.fn(),
  reset: vi.fn(),
})

const emptySchedulerStore = {
  status: 'idle',
  characters: [],
  error: null,
  trackedOcids: [], // ADR-101: 셸 테스트는 화면을 "읽었고 0명"인 빈 상태로 세운다(null 은 "아직 안 읽음"이라 본 화면이 그려진다)
  loadTrackedOcids: vi.fn(),
  saveTrackedOcids: vi.fn(),
  refresh: vi.fn(),
}
vi.mocked(useContentSchedulerStore).mockReturnValue(emptySchedulerStore)
vi.mocked(useBossSchedulerStore).mockReturnValue(emptySchedulerStore)
// App.test.tsx 와 같은 스텁 형태 — ADR-083 결정 3 이후 기간 실패 토스트 훅이 characterGroups 를
// 읽어서, 그 계산이 빈 상태 조기 반환보다 위에 있다(순회 대상이 없으면 터진다).
vi.mocked(useBossProfitStore).mockReturnValue({
  status: 'idle',
  rows: [],
  weeklySubtotals: [],
  error: null,
  staleCharacterNames: [],
  trackedOcids: [], // ADR-101: 셸 테스트는 화면을 "읽었고 0명"인 빈 상태로 세운다(null 은 "아직 안 읽음"이라 본 화면이 그려진다)
  loadTrackedOcids: vi.fn(),
  refresh: vi.fn(),
  setPartySize: vi.fn(),
})
vi.mocked(useSettingsStore).mockReturnValue({
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
vi.mocked(useThemeStore).mockReturnValue({
  theme: '렌',
  restoreFromStorage: vi.fn(),
  selectTheme: vi.fn(),
})
vi.mocked(useTrackingModeStore).mockReturnValue({
  mode: 'auto',
  restoreFromStorage: vi.fn(),
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
})

describe('라우트 코드 분할 (ADR-092)', () => {
  describe('Suspense 경계 위치 — ADR-077 회귀 방지', () => {
    it('/profit/drops 청크가 로드되는 동안에도 부모 보스 수익 화면은 언마운트되지 않는다', async () => {
      renderAt('/profit/drops')

      // 부모(BossProfitScreen)도 lazy라 자기 청크를 먼저 받는다 — 그 사이는 최상위 폴백이다.
      // 부모가 그려진 뒤 자식이 서스펜드하는데, 자식 경계가 부모 안쪽에 있으면 부모는 그대로 남는다.
      // 최상위 경계 하나였다면 자식의 서스펜드가 부모까지 걷어내므로 이 헤딩은 **영영 나타나지 않고**
      // findBy가 타임아웃한다 — 그것이 곧 ADR-077이 막은 언마운트다.
      // 타임아웃을 기본값(1s)보다 넉넉히 준다 — 전체 스위트를 병렬로 돌리면 lazy 청크 해석이
      // 간헐적으로 1s를 넘겨 이 가드가 흔들렸다(2026-08-05, 4회 중 1회). 흔들리는 가드는
      // "또 그거네" 하고 무시당해 정작 진짜 회귀를 놓치게 만든다.
      expect(
        await screen.findByRole('heading', { name: '보스 수익' }, { timeout: 5000 }),
      ).toBeInTheDocument()

      // 그동안 자식 자리에는 **아무것도 그려지지 않는다**([[ADR-120]] 결정 13, 사용자 결정
      // 2026-08-09) — 하위 페이지의 폴백은 `null` 이다. 그 화면들은 네트워크가 필요 없는데 코드를
      // 기다리느라 스피너가 떠서 데이터를 기다리는 것처럼 보였다. 부모가 그대로 남아 있으므로
      // 빈 화면이 아니라 "아직 안 밀려 들어왔다"로 읽힌다.
      //
      // 자식이 영영 서스펜드하는 이 상황에서도 폴백이 없다는 것이 계약이다. 부모 헤딩이 살아 있고
      // 오버레이가 없다 = 자식은 아직 안 왔는데 부모는 안 걷혔다 = 경계가 부모 안쪽에 있다.
      expect(screen.queryByTestId('route-fallback')).not.toBeInTheDocument()
      expect(screen.queryByTestId('stack-screen')).not.toBeInTheDocument()
    })
  })

  describe('디버그 라우트 제거 (ADR-092 결정 1)', () => {
    it.each([
      '/debug/boss-cards',
      '/debug/quest-cards',
      '/debug/boss-portrait-size',
      '/debug/loading',
      '/debug/theme-background',
    ])('%s 는 등록된 라우트가 아니다', (path) => {
      renderAt(path)

      // 매칭되는 라우트가 없으면 <Routes>는 아무것도 그리지 않는다 — 탭바만 남는다.
      expect(screen.queryByTestId('route-fallback')).not.toBeInTheDocument()
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })
  })
})
