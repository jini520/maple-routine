import {
  Suspense,
  createElement,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { ListChecks, Settings, Swords } from 'lucide-react'
import { useOnboardingStore } from './features/onboarding/store'
import { useThemeStore } from './features/theme/store'
import { useTrackingModeStore } from './features/tracking-mode/store'
import { useDropEffectStore } from './features/drop-effect/store'
import { getThemeDefinition } from './lib/theme-registry'
import { consumePendingNotice } from './storage/pending-notice'
import { useToastStore } from './features/toast/store'
import { hideSplashScreen } from './native/splash-screen'
import { notifyLiveUpdateReady } from './native/live-update'
import { refreshSafeAreaInsets } from './native/system-bars'
import { addKeyboardVisibilityListener } from './native/keyboard'
import { useStackLocation } from './lib/use-stack-location'
import { useSystemBack } from './lib/use-system-back'
import { moveAppToBackground } from './native/back-gesture'
import { useDelayed } from './lib/use-delayed'
import { preloadScreen, usePreloadedScreen, type ScreenLoader } from './lib/preloaded-screen'
import { useScreenStackStore } from './features/screen-stack/store'
import {
  resolveBelowTransform,
  resolveLayerAboveProgress,
  resolveParentPath,
  resolveScrimOpacity,
  resolveTabPath,
  STACK_EASING,
} from './lib/stack-transition'
import { maybeShowTabSwitchAd, startAds } from './features/ads/tab-switch-ad'
import { UpdatePromptModal } from './app/UpdatePromptModal'
import { ApiKeyNoticeModal } from './app/ApiKeyNoticeModal'
import { ErrorBoundary } from './components/organisms/ErrorBoundary/ErrorBoundary'
import { LoadingState } from './components/molecules/LoadingState/LoadingState'
import { ProfitIcon } from './components/atoms/ProfitIcon/ProfitIcon'
import { ToastStack } from './components/organisms/Toast/ToastStack'

// 라우트 화면은 지연 로딩한다([[ADR-092]]) — 정적 import 였을 때 8개 화면·모든 store·
// src/data/*.json 이 첫 페인트에 함께 평가돼 메인 청크가 1,019kB(gzip 411kB) 단일 덩어리였다.
// 네이티브에서 청크는 원격이 아니라 WebView 로컬 파일이라 탭 이동에 네트워크 지연이 없다.
// 새 라우트를 더할 때도 이 형태를 유지할 것.
const OnboardingScreen = lazy(() =>
  import('./app/onboarding/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })),
)
const ContentScreen = lazy(() =>
  import('./app/content-scheduler/ContentScreen').then((m) => ({ default: m.ContentScreen })),
)
const loadContentManageScreen: ScreenLoader = () => import('./app/content-scheduler/ContentManageScreen').then((m) => m.ContentManageScreen)
const BossScreen = lazy(() =>
  import('./app/boss-scheduler/BossScreen').then((m) => ({ default: m.BossScreen })),
)
const loadBossManageScreen: ScreenLoader = () => import('./app/boss-scheduler/BossManageScreen').then((m) => m.BossManageScreen)
const BossProfitScreen = lazy(() =>
  import('./app/boss-profit/BossProfitScreen').then((m) => ({ default: m.BossProfitScreen })),
)
const loadDropHistoryScreen: ScreenLoader = () => import('./app/boss-profit/DropHistoryScreen').then((m) => m.DropHistoryScreen)
const loadDropPriceScreen: ScreenLoader = () => import('./app/boss-profit/DropPriceScreen').then((m) => m.DropPriceScreen)

const SettingsScreen = lazy(() =>
  import('./app/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
)
const loadSettingsReleaseNotesScreen: ScreenLoader = () => import('./app/settings/SettingsReleaseNotesScreen').then((m) => m.SettingsReleaseNotesScreen)
const loadSettingsAccountDataScreen: ScreenLoader = () => import('./app/settings/SettingsAccountDataScreen').then((m) => m.SettingsAccountDataScreen)
const loadSettingsAboutScreen: ScreenLoader = () => import('./app/settings/SettingsAboutScreen').then((m) => m.SettingsAboutScreen)
const loadSettingsPrivacyScreen: ScreenLoader = () => import('./app/settings/SettingsPrivacyScreen').then((m) => m.SettingsPrivacyScreen)

// 하위 페이지 청크를 **탭에 들어온 뒤 미리 받아둔다**([[ADR-120]] 결정 13). 그러지 않으면 각 하위
// 페이지 첫 진입에 서스펜드가 일어나 스피너가 전환 없이 툭 떴다가 그제야 화면이 밀려 들어온다
// (계측 2026-08-09: 첫 진입에만, 재진입 0회 — 그런데 화면이 열하나라 "매번"으로 느껴진다).
//
// **탭 단위인 것이 핵심이다.** 일곱을 한꺼번에 받으면 안 열어 볼 화면의 의존 그래프까지 부팅 직후에
// 평가돼 [[ADR-092]] 가 피하려던 상태로 돌아간다. 첫 페인트 이후(passive effect)에 도는 것도 같은
// 이유다 — 그 ADR 이 지키는 것은 첫 페인트 번들의 크기다.
//
// **새 하위 페이지를 더하면 여기에도 넣을 것.** 빠뜨리면 그 화면만 옛 증상으로 돌아간다.
const STACK_PRELOADERS: Record<string, ReadonlyArray<ScreenLoader>> = {
  '/content': [loadContentManageScreen],
  '/boss': [loadBossManageScreen],
  '/profit': [loadDropHistoryScreen, loadDropPriceScreen],
  '/settings': [
    loadSettingsReleaseNotesScreen,
    loadSettingsAccountDataScreen,
    loadSettingsAboutScreen,
    loadSettingsPrivacyScreen,
  ],
}

// 이만큼 기다려도 청크가 안 오면 그때 폴백을 그린다([[ADR-120]] 결정 13). 프리페치가 끝난 청크는
// 서스펜드가 한 프레임뿐이라(계측: +16ms 폴백 → +32ms 화면) 곧바로 그리면 전환 직전의 깜빡임만
// 남는다. 이 값보다 오래 걸리는 진짜 대기에는 그대로 뜬다.
const FALLBACK_DELAY_MS = 200

// 청크가 로드되는 동안의 자리 — 새 로딩 표현을 만들지 않고 [[ADR-061]] 로 확정된 LoadingState 를
// 화면 전체 크기로 재사용한다. 스플래시 시퀀스(MIN_SPLASH_MS)와는 독립이다: 첫 청크는 대개
// 스플래시가 떠 있는 동안 로드돼 사용자가 이 폴백을 보지 못한다.
// **탭 화면 전용이다** — 하위 페이지는 폴백을 그리지 않는다(`fallback={null}`, [[ADR-120]] 결정 13).
// 탭 청크는 보스 수익 142kB 처럼 큰 것이 있어 진짜로 기다릴 수 있고, 그때는 화면이 통째로 비므로
// 알려야 한다. 대신 **짧은 대기는 그리지 않는다** — 아무것도 안 그려도 탭바는 이 경계 **밖**이라
// 남아 있어 "아직 안 바뀌었다"로 읽힌다(스피너가 한 프레임 번쩍이는 것보다 낫다).
function RouteFallback(): React.JSX.Element | null {
  const isSlow = useDelayed(FALLBACK_DELAY_MS)
  if (!isSlow) return null
  return (
    <div className="p-4" data-testid="route-fallback">
      <LoadingState message="불러오는 중" size="page" />
    </div>
  )
}

// 하위 페이지를 서스펜드 없이 그린다([[ADR-120]] 결정 15) — `lazy` 를 쓰지 않는 이유는
// `lib/preloaded-screen` 주석 참고(요약: `lazy` 는 모듈이 이미 있어도 첫 렌더에 서스펜드하고,
// React 는 fallback 을 커밋한 뒤 실제 콘텐츠 공개를 약 300ms 미룬다).
function StackRoute({ load }: { load: ScreenLoader }): React.JSX.Element | null {
  const screen = usePreloadedScreen(load)
  // `createElement` 인 것은 취향이 아니라 필요다 — JSX(`<Screen />`)로 쓰면 지역 변수를 컴포넌트로
  // 쓴다고 보는 린트 규칙(`Cannot create components during render`)에 걸린다. 그 규칙이 겨누는 것은
  // **렌더마다 새로 만들어져 상태가 초기화되는** 컴포넌트인데, 이 값은 로더를 키로 한 캐시에서
  // 나오므로 한 번 정해지면 바뀌지 않는다.
  return screen === null ? null : createElement(screen)
}

// 탭 화면 + 탭바를 한 덩어리로 묶는다([[ADR-120]] 결정 4). 하위 페이지를 밀어 넣을 때 이 래퍼째
// `translateX` 되므로 **탭바가 아래 화면과 함께 밀려 나가고 함께 어두워진다**(iOS
// `hidesBottomBarWhenPushed`). 하위 페이지에는 탭바가 없다.
//
// **`pt-[var(--sa-top)]` 이 여기 있는 것이 중요하다.** 이 값이 바깥(AppShell 루트)에 있으면 이
// 래퍼의 위쪽 모서리가 노치만큼 내려가는데, `transform` 이 걸린 동안 `fixed` 후손은 뷰포트가 아니라
// **이 요소의 패딩 박스**를 기준으로 잡히므로 `ScreenScroll` 의 `top-[var(--sa-top)]` 이 두 번
// 더해져 전환이 시작되는 프레임에 화면이 노치 높이만큼 툭 내려간다. 패딩은 박스 **안**이라 여기
// 두면 패딩 박스가 y=0 에서 시작해 뷰포트와 정확히 겹친다.
//
// `isolate` 는 **항상** 스태킹 컨텍스트이게 하려는 것이다(결정 8) — `transform` 이 걸린 프레임에만
// 컨텍스트가 생기면 탭바(`z-30`)와 오버레이의 상대 순서가 전환 시작·종료 프레임에 뒤집힌다.
function TabLayer({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { depth, progress, isDragging, transitionMs } = useScreenStackStore()
  const transition = isDragging ? 'none' : `transform ${transitionMs}ms ${STACK_EASING}`
  // 탭 레이어는 스택의 맨 아래, 즉 `index: -1` 이다. 오버레이가 없으면 1이 나와 `transform` 이
  // 아예 없고(결정 7), 2단일 때는 0이라 더 밀리지 않는다.
  const aboveProgress = resolveLayerAboveProgress(-1, depth, progress)

  return (
    <div
      data-testid="tab-layer"
      className="isolate min-h-screen pt-[var(--sa-top)]"
      style={{ transform: resolveBelowTransform(aboveProgress), transition }}
    >
      {children}
      {/* 스크림은 탭바(z-30)까지 덮어야 한 덩어리로 읽힌다. 진행률이 1이면 불투명도가 0이라 존재해도
          보이지 않는다 — 조건부 렌더로 DOM 을 붙였다 뗐다 하면 그 프레임에 전환이 끊긴다. */}
      <div
        aria-hidden="true"
        data-testid="tab-layer-scrim"
        className="pointer-events-none fixed inset-0 z-40 bg-black"
        style={{
          opacity: resolveScrimOpacity(aboveProgress),
          transition: isDragging ? 'none' : `opacity ${transitionMs}ms ${STACK_EASING}`,
        }}
      />
    </div>
  )
}

const TAB_ITEMS = [
  { to: '/content', label: '컨텐츠', Icon: ListChecks },
  { to: '/boss', label: '보스', Icon: Swords },
  // 수익만 커스텀 아이콘이다 — lucide 규격을 지켜 그렸으므로 나머지 셋과 굵기·크기가 맞는다(ADR-066).
  { to: '/profit', label: '수익', Icon: ProfitIcon },
  { to: '/settings', label: '설정', Icon: Settings },
] as const

// 네이티브 스플래시가 순식간에 지나가 깜빡이지 않도록, 앱 번들 평가 시점부터 최소 이 시간만큼은 유지한다.
const APP_START_MS = Date.now()
const MIN_SPLASH_MS = 1000

function BottomTabBar(): React.JSX.Element {
  // **이동 전 스크롤 리셋은 더 이상 하지 않는다**([[ADR-098]] 결정 1 폐기 — [[ADR-120]]). 그 처방은
  // 네 탭이 **문서 전체 스크롤 하나를 공유하던** 시절의 것이라(ADR-072 결정 1), 새 화면이 옛 오프셋
  // 으로 마운트되는 것을 막으려던 것이다. [[ADR-099]]·[[ADR-100]] 이 스크롤을 화면 소유로 옮기고
  // [[ADR-120]] 이 마지막 남은 설정 탭까지 옮기면서 `window.scrollTo(0, 0)` 은 아무것도 스크롤하지
  // 않는 무효 호출이 됐다 — 문서는 이제 어느 탭에서도 스크롤되지 않는다.
  const navigate = useNavigate()
  const navRef = useRef<HTMLElement>(null)

  // 탭 이동의 책임은 NavLink가 아니라 이 인터셉터에 있다(NavLink는 활성 스타일·aria-current 담당).
  // iOS WKWebView는 인접한 두 탭을 동시에 누를 때 드물게 클릭 하나를 합성하는데, 그 클릭은 React
  // 이벤트 시스템을 타지 않아 NavLink의 preventDefault가 걸리지 않는다. 그러면 <a href>의 기본
  // 동작이 그대로 실행돼 문서 전체가 다시 로드되고(2026-07-28 실기기 계측: click → PAGEHIDE),
  // 그 리로드는 closeBossProfitDb()를 못 거쳐 네이티브 SQLite 커넥션을 stale하게 남긴다 — 보스
  // 수익의 파티원 수·수익 금액이 앱 재시작 전까지 안 불러와지던 증상의 실제 원인이다([[ADR-050]]).
  // React 안에서는 막을 수 없다(그 핸들러 자체가 안 도는 게 문제다). React 밖의 DOM 리스너를
  // 캡처 단계에 걸어 어떤 경로로 들어온 클릭이든 문서 네비게이션이 되지 않게 하고, 직접
  // navigate해 SPA 라우팅으로 되돌린다. 캡처가 React보다 먼저 도므로 여기서 preventDefault를 하면
  // react-router의 Link는 자기 가드(`if (!event.defaultPrevented)`)에 막혀 이동을 건너뛴다 —
  // 이중 이동은 생기지 않는다.
  useEffect(() => {
    const nav = navRef.current
    if (nav === null) {
      return
    }

    const interceptClick = (event: MouseEvent): void => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      const href = anchor?.getAttribute('href')
      if (href === null || href === undefined) {
        return
      }
      event.preventDefault()

      // 같은 탭을 다시 누른 것은 전환이 아니다(ADR-090). react-router의 location 훅 대신
      // window.location을 읽는 이유는 이 리스너가 React 밖의 DOM 리스너이기 때문이다 —
      // 훅을 걸면 이동마다 재렌더·리스너 재등록이 일어난다.
      const isTabChange = window.location.pathname !== href

      navigate(href)

      // 광고는 이동을 **지연시키지 않는다** — navigate 뒤에 붙여 화면 전환이 먼저 일어나게 하고,
      // 준비된 광고가 없으면 안쪽에서 조용히 건너뛴다(ADR-090 결정 3).
      if (isTabChange) {
        void maybeShowTabSwitchAd()
      }
    }

    nav.addEventListener('click', interceptClick, true)
    return () => {
      nav.removeEventListener('click', interceptClick, true)
    }
  }, [navigate])

  // 탭바가 실제로 차지하는 높이를 --tab-bar-h 로 내보낸다([[ADR-099]] 결정 7). 화면 스크롤 컨테이너가
  // 스크롤포트 하단을 이만큼 줄여야 스크롤 인디케이터가 탭바 뒤로 들어가지 않는다. **실측인 것이
  // 핵심이다** — `4rem` 으로 가정했더니 실제 높이(아이콘+라벨 56px + 보더)와 어긋나 컨테이너와
  // 탭바 사이에 띠가 생겼다(실기기 관측 2026-08-06). 언마운트(온보딩·키보드로 탭바가 사라질 때)에는
  // 0으로 되돌려, 그 상황에서 컨테이너가 화면 바닥까지 쓰게 한다.
  useLayoutEffect(() => {
    const nav = navRef.current
    if (nav === null) return

    const measure = (): void => {
      document.documentElement.style.setProperty('--tab-bar-h', `${nav.getBoundingClientRect().height}px`)
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    return () => {
      observer.disconnect()
      document.documentElement.style.setProperty('--tab-bar-h', '0px')
    }
  }, [])

  return (
    <nav
      ref={navRef}
      // z-30: 히스토리 오버레이(z-20, [[ADR-077]])보다 위라 그 화면에서도 탭바가 보인다(형제 라우트
      // 시절과 같은 모습). 모달(z-50)·토스트(z-[60])보다는 아래다.
      className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-surface pb-[var(--sa-bottom)]"
    >
      {TAB_ITEMS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            isActive
              ? 'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-primary-ink'
              : 'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-text-muted'
          }
        >
          <tab.Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}

// AppShell은 라우터와 분리해 MemoryRouter로도 테스트할 수 있게 한다.
export function AppShell(): React.JSX.Element {
  const { status, restoreFromStorage } = useOnboardingStore()
  const { theme, restoreFromStorage: restoreThemeFromStorage } = useThemeStore()
  const { restoreFromStorage: restoreTrackingModeFromStorage } = useTrackingModeStore()
  const { restoreFromStorage: restoreDropEffectFromStorage } = useDropEffectStore()
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  // 나가는 연출이 도는 동안 라우트를 붙잡아 두는 위치([[ADR-120]] 결정 9-b).
  const displayLocation = useStackLocation()

  // OTA 번들이 "정상"임을 capgo에 알린다([[ADR-117]] 결정 2). 이 호출이 appReadyTimeout(기본 10초,
  // capacitor.config.ts 미설정) 안에 없으면 플러그인이 직전 정상 번들로 자동 롤백한다 — 그 롤백은
  // 피해야 할 사고가 아니라 **깨진 번들에서 빠져나올 유일한 복구 장치**다. 번들 첫 문장
  // (main.tsx)에서 부르던 것을 여기로 옮겨, "정상"의 정의가 "메인 청크가 평가됐다"에서
  // **"React가 마운트에 성공했다"** 로 바뀐다.
  //
  // **App이 아니라 AppShell이어야 한다.** App은 ErrorBoundary를 *렌더하는* 쪽이라, 자식이 렌더
  // 중에 던져도 App 자신은 정상 커밋돼 그 effect가 실행된다 — 부팅 크래시로 죽은 번들을 "정상"으로
  // 찍게 되어 옮긴 의미가 사라진다. AppShell은 ErrorBoundary **안**이라 렌더가 던지면 커밋되지
  // 않고 이 effect도 돌지 않는다.
  //
  // 하이드레이션(prehydrateTabStores) 완료 뒤로는 더 미루지 않는다(같은 결정, 사용자 결정) —
  // 그쪽은 SQLite에 의존하고 이 저장소는 그 호출이 응답 없이 멈춘 사례를 두 번 기록했다
  // ([[ADR-008]]·[[ADR-050]]). 10초를 넘기면 멀쩡한 번들까지 롤백된다.
  useEffect(() => {
    void notifyLiveUpdateReady()
  }, [])

  useEffect(() => {
    restoreFromStorage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    restoreThemeFromStorage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    restoreTrackingModeFromStorage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    restoreDropEffectFromStorage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ADR-090: SDK 초기화 + 첫 광고 사전 로드. 둘 다 실패해도 던지지 않으므로 부팅을 막지 않는다.
  // 스플래시 시퀀스와는 무관하다 — 앱 시작에 광고를 띄우지 않기 때문에 기다릴 이유가 없다.
  useEffect(() => {
    void startAds()
  }, [])

  // ADR-101 결정 2·6: 탭 스토어를 스플래시가 떠 있는 동안 미리 하이드레이션해, 첫 탭 진입이
  // 저장소 읽기를 사용자가 보는 앞에서 치르지 않게 한다. **온보딩 완료 상태에서만 돈다** —
  // `syncSchedules` 는 API 키·계정이 없으면 던지므로, 온보딩 중에 돌리면 스토어가 error 로
  // 시작하고 토스트까지 울린다. 예열 모듈 자체도 동적 import 다([[ADR-092]]).
  useEffect(() => {
    if (status !== 'completed') return
    void import('./features/prehydrate').then((m) => m.prehydrateTabStores())
  }, [status])

  // ADR-065 결정 3: 캐시 데이터 삭제는 실패해도 리로드가 실행돼 화면 신호가 파괴된다 —
  // 삭제 쪽이 남긴 플래그를 부팅 때 읽어 토스트로 알린다(읽으면서 지우므로 한 번만 뜬다).
  useEffect(() => {
    if (consumePendingNotice() === 'cacheClearFailed') {
      useToastStore.getState().showError('캐시를 일부만 삭제했습니다')
    }
  }, [])

  // 안전영역 인셋(--safe-area-inset-*)을 네이티브에서 받아온다. 네이티브의 최초 인셋 적용이 DOM보다
  // 먼저 끝나면 주입이 유실되므로 마운트 직후 한 번 요청한다. 이후 회전·접힘·키보드 변화는
  // 네이티브 리스너가 자동 갱신한다(SystemBarsPlugin.java).
  useEffect(() => {
    void refreshSafeAreaInsets()
  }, [])

  // 키보드가 뜨면 네이티브가 WebView를 그만큼 밀어 올려(입력창이 가리지 않도록) 화면 하단에 고정된
  // 탭바가 키보드 바로 위에 얹힌다 — 입력 중엔 탭 이동이 의미도 없고 시야만 가리므로 그동안 숨긴다.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelled = false

    void addKeyboardVisibilityListener(setIsKeyboardVisible).then((remove) => {
      if (cancelled) {
        remove()
        return
      }
      unsubscribe = remove
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  // 앱 셸이 처음 렌더된 뒤 네이티브 스플래시를 내린다 — 실행부터 이 시점까지 스플래시가 계속 떠 있어
  // 흰 화면 없이 스플래시만 보인다. 콘텐츠가 즉시 준비되면 순식간에 사라지므로, 최소 표시 시간
  // (MIN_SPLASH_MS)을 보장해 스플래시가 충분히 보이게 한다.
  useEffect(() => {
    const remaining = MIN_SPLASH_MS - (Date.now() - APP_START_MS)
    const timer = window.setTimeout(
      () => {
        void hideSplashScreen()
      },
      Math.max(0, remaining),
    )
    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  const isCompleted = status === 'completed'

  // 안드로이드 시스템 뒤로가기([[ADR-120]] 결정 17·18). **여기가 유일한 소유자다** — 탭 최상위에서도
  // 받아야 하므로 `StackScreen`(하위 페이지가 열려 있을 때만 존재)이 가질 수 없다.
  const navigate = useNavigate()
  const popStackScreen = useCallback(() => {
    // 딥링크로 하위 페이지에 직접 들어오면 되돌아갈 항목이 없어 `-1` 이 앱을 벗어난다([[ADR-120]]
    // 결정 9). 그때만 한 단계 위 경로로 `replace` 한다.
    if (displayLocation.key === 'default') {
      navigate(resolveParentPath(displayLocation.pathname), { replace: true })
      return
    }
    navigate(-1)
  }, [navigate, displayLocation.key, displayLocation.pathname])

  // 탭 최상위에서 뒤로가기가 오면 **묻지 않고 백그라운드로 보낸다**([[ADR-120]] 결정 18,
  // 사용자 지정) — 확인 모달을 뒀다가 걷어냈다. 되묻는 창은 안드로이드에서 옛 앱의 인상을 준다.
  const leaveApp = useCallback(() => {
    void moveAppToBackground()
  }, [])

  useSystemBack({ onPop: popStackScreen, onRoot: leaveApp })


  // 지금 탭의 하위 페이지 청크를 미리 받아둔다([[ADR-120]] 결정 13). passive effect 라 첫 페인트
  // 뒤에 돌고, 이미 받은 모듈은 레지스트리가 돌려주므로 재진입에서 공짜다. 실패해도 던지지 않는다 —
  // 못 받으면 그 화면 첫 진입에 폴백이 뜰 뿐 기능은 그대로다.
  useEffect(() => {
    if (!isCompleted) return
    for (const load of STACK_PRELOADERS[resolveTabPath(displayLocation.pathname)] ?? []) {
      void preloadScreen(load)
    }
  }, [isCompleted, displayLocation.pathname])


  // 테마 배경 이미지(ADR-088) — 값을 가진 테마에서만 백드롭 한 장을 깐다. 색만 있는 테마는
  // DOM 자체가 늘지 않는다. 실제 그림은 index.css의 .theme-backdrop이 --theme-bg-*를 읽어 그린다.
  //
  // 배경이 있을 땐 루트에서 bg-bg를 뺀다 — 백드롭의 z-index:-1은 부모가 스태킹 컨텍스트일 때만
  // 부모 배경 위에 오는데 이 div는 아니라서, bg-bg를 칠하면 그 불투명 배경이 백드롭 위에 그려져
  // 이미지가 통째로 사라진다(브라우저 확인, 2026-08-03). 바탕색은 body가 같은 값으로 이미 칠한다.
  const hasThemeBackground = getThemeDefinition(theme).background !== undefined

  // 하위 페이지의 중첩 자식은 **자기 Suspense 경계를 갖는다**([[ADR-092]] 결정 3): React 는 가장
  // 가까운 경계를 쓰므로 자식이 서스펜드해도 바깥 경계까지 올라오지 않고, 그래서 부모 탭 화면이
  // 언마운트되지 않는다([[ADR-077]]).
  //
  // **폴백은 `null` 이다**([[ADR-120]] 결정 13, 사용자 결정 2026-08-09). 이 화면들은 네트워크가
  // 필요 없는데 **코드**를 기다리느라 스피너가 떴다 — 데이터를 기다리는 것처럼 보여 거짓말이었다.
  // 청크가 작고(1.9~11.0 kB) 부모 탭 진입 때 미리 받아두므로(`STACK_PRELOADERS`) 그 사이는
  // 한 프레임 남짓이고, 그동안 **부모 화면이 그대로 보인다** — 빈 화면이 아니라 "아직 안 밀려
  // 들어왔다"로 읽힌다. 오래 걸려도 부모가 남아 있으므로 아무것도 안 그리는 편이 낫다.
  const stackRoute = (load: ScreenLoader): React.JSX.Element => (
    // `Suspense` 경계는 남긴다([[ADR-092]] 결정 3). `StackRoute` 자체는 서스펜드하지 않지만, 하위
    // 페이지 **안**에서 무언가 서스펜드하면 이 경계가 없을 때 최상위 경계까지 올라가 부모 탭 화면이
    // 폴백으로 대체된다 — [[ADR-077]] 이 막은 언마운트가 되살아난다.
    <Suspense fallback={null}>
      <StackRoute load={load} />
    </Suspense>
  )

  return (
    <div className={`min-h-screen text-text${hasThemeBackground ? '' : ' bg-bg'}`}>
      {hasThemeBackground && (
        <div className="theme-backdrop" data-testid="theme-backdrop" aria-hidden="true" />
      )}
      <TabLayer>
        <div className={isCompleted ? 'pb-[calc(4rem+var(--sa-bottom))]' : undefined}>
          {/* 최상위 경계는 화면 전체가 바뀌는 이동(탭 간)만 받는다 — 탭바는 <Routes> 밖이라
              폴백에 덮이지 않는다(그래서 이 경계는 TabLayer 안, 탭바 앞에 있다).

              **`location` 을 명시로 넘긴다**([[ADR-120]] 결정 9-b) — 나가는 연출이 도는 동안
              `useStackLocation` 이 옛 위치를 붙잡아 둬야 오버레이가 언마운트되지 않는다. */}
          <Suspense fallback={<RouteFallback />}>
            <Routes location={displayLocation}>
              <Route
                path="/"
                element={<Navigate to={isCompleted ? '/content' : '/onboarding'} replace />}
              />
              <Route
                path="/onboarding"
                element={isCompleted ? <Navigate to="/content" replace /> : <OnboardingScreen />}
              />
              {/* 하위 페이지는 전부 부모 탭의 **중첩 라우트**다([[ADR-120]] 결정 1). 형제로 두면
                  이동마다 부모가 언마운트돼 상태를 잃을 뿐 아니라, 전환 중 아래에 보여줄 화면
                  자체가 없다. 화면은 부모의 <Outlet /> 자리에서 `StackScreen` 이 포털로 그린다. */}
              <Route
                path="/content"
                element={isCompleted ? <ContentScreen /> : <Navigate to="/onboarding" replace />}
              >
                {/* ADR-035 결정 18: 수동 추적 항목 편집 전용 관리 페이지 — 스케줄러는 읽기 전용. */}
                <Route path="manage" element={stackRoute(loadContentManageScreen)} />
              </Route>
              <Route
                path="/boss"
                element={isCompleted ? <BossScreen /> : <Navigate to="/onboarding" replace />}
              >
                {/* ADR-035 결정 18: 보스 추적+파티 인원 통합 관리 페이지(파티 관리 모달 대체). */}
                <Route path="manage" element={stackRoute(loadBossManageScreen)} />
              </Route>
              <Route
                path="/profit"
                element={isCompleted ? <BossProfitScreen /> : <Navigate to="/onboarding" replace />}
              >
                {/* 드롭 획득 히스토리(전 기간) — 보스 수익의 서브 화면([[ADR-071]] 결정 7, 이슈 #54).
                    이 앱에서 중첩 라우트를 처음 쓴 자리이고([[ADR-077]]), [[ADR-120]] 이 그 형태를
                    나머지 여섯에 넓혔다. */}
                <Route path="drops" element={stackRoute(loadDropHistoryScreen)} />
                {/* 가격 기록([[ADR-124]] 결정 8, 이슈 #185) — 히스토리의 형제다. 저쪽은 전 기간
                    읽기 전용, 이쪽은 한 주를 놓고 값을 매기는 쓰기 화면이다. */}
                <Route path="prices" element={stackRoute(loadDropPriceScreen)} />
              </Route>
              <Route
                path="/settings"
                element={isCompleted ? <SettingsScreen /> : <Navigate to="/onboarding" replace />}
              >
                {/* 설정 하위 페이지 넷([[ADR-118]] 결정 2 + [[ADR-120]] 결정 11 의 처방침).
                    형제였던 것을 중첩으로 옮긴다 — 근거는 [[ADR-077]] 의 "부모 상태 보존"이 아니라
                    **전환 중 아래 화면이 보여야 한다**는 것이다. 가드는 부모가 대신 건다: 부모가
                    `/onboarding` 으로 리다이렉트되면 중첩 자식은 매칭될 자리가 사라진다. */}
                <Route path="release-notes" element={stackRoute(loadSettingsReleaseNotesScreen)} />
                <Route path="account-data" element={stackRoute(loadSettingsAccountDataScreen)} />
                <Route path="about" element={stackRoute(loadSettingsAboutScreen)}>
                  {/* **`/settings/about` 의 자식**이다 — 이 화면의 행에서 열리므로 스택이 2단이
                      된다(이 앱에서 유일하다). 형제로 두면 about 이 즉시 사라진 자리에 처방침이
                      밀려 들어와, 밀려 나가는 화면 없이 배경만 바뀌는 프레임이 보인다. */}
                  <Route path="privacy" element={stackRoute(loadSettingsPrivacyScreen)} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </div>
        {isCompleted && !isKeyboardVisible && <BottomTabBar />}
      </TabLayer>
      {/* 스택 오버레이의 포털 루트([[ADR-120]] 결정 3) — `TabLayer` 의 **형제**여야 그 요소의
          `transform` 에 딸려 밀리지 않는다. 비어 있을 때 레이아웃에 영향을 주지 않는 빈 div 다. */}
      <div id="stack-root" data-testid="stack-root" />
      {/* 사용자 동의형 업데이트 모달 — 실행 시(또는 설정에서 수동 확인 시) 새 버전이 있으면 뜬다(ADR-027). */}
      <UpdatePromptModal />
      {/* ADR-115 결정 10 · ADR-116 결정 1: 저장된 키가 무효화되거나 호출 한도를 넘기면 원래 화면
          위에 닫을 수 없는 안내 모달이 덮이고, "확인"을 눌러야 키 입력 화면으로 이동한다.
          라우트 밖이라 어느 화면에서 감지되든 뜬다. */}
      <ApiKeyNoticeModal />
      <ToastStack hasTabBar={isCompleted && !isKeyboardVisible} />
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    // ADR-065 결정 5: 라우터 바깥에 둬 라우팅 자체가 터져도 폴백이 뜬다. 폴백의 '다시 시작'은
    // 리로드라 라우터 상태를 되살릴 필요가 없다.
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
