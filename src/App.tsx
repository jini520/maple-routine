import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { ListChecks, Settings, Swords } from 'lucide-react'
import { useOnboardingStore } from './features/onboarding/store'
import { useThemeStore } from './features/theme/store'
import { useTrackingModeStore } from './features/tracking-mode/store'
import { useDropEffectStore } from './features/drop-effect/store'
import { getThemeDefinition } from './lib/theme-registry'
import { consumePendingNotice } from './storage/pending-notice'
import { useToastStore } from './features/toast/store'
import { hideSplashScreen } from './native/splash-screen'
import { refreshSafeAreaInsets } from './native/system-bars'
import { addKeyboardVisibilityListener } from './native/keyboard'
import { useScreenNavigate } from './lib/use-screen-navigate'
import { maybeShowTabSwitchAd, startAds } from './features/ads/tab-switch-ad'
import { UpdatePromptModal } from './app/UpdatePromptModal'
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
const ContentManageScreen = lazy(() =>
  import('./app/content-scheduler/ContentManageScreen').then((m) => ({
    default: m.ContentManageScreen,
  })),
)
const BossScreen = lazy(() =>
  import('./app/boss-scheduler/BossScreen').then((m) => ({ default: m.BossScreen })),
)
const BossManageScreen = lazy(() =>
  import('./app/boss-scheduler/BossManageScreen').then((m) => ({ default: m.BossManageScreen })),
)
const BossProfitScreen = lazy(() =>
  import('./app/boss-profit/BossProfitScreen').then((m) => ({ default: m.BossProfitScreen })),
)
const DropHistoryScreen = lazy(() =>
  import('./app/boss-profit/DropHistoryScreen').then((m) => ({ default: m.DropHistoryScreen })),
)
const SettingsScreen = lazy(() =>
  import('./app/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
)

// 청크가 로드되는 동안의 자리 — 새 로딩 표현을 만들지 않고 [[ADR-061]] 로 확정된 LoadingState 를
// 화면 전체 크기로 재사용한다. 스플래시 시퀀스(MIN_SPLASH_MS)와는 독립이다: 첫 청크는 대개
// 스플래시가 떠 있는 동안 로드돼 사용자가 이 폴백을 보지 못한다.
function RouteFallback(): React.JSX.Element {
  return (
    <div className="p-4" data-testid="route-fallback">
      <LoadingState message="불러오는 중" size="page" />
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
  // 탭 이동은 화면을 통째로 바꾸므로 **이동 전에 스크롤을 최상단으로 옮긴다**([[ADR-098]] 결정 1).
  // 네 탭이 문서 전체 스크롤 하나를 공유해(ADR-072 결정 1) 그러지 않으면 새 화면이 옛 오프셋으로
  // 마운트되고, 문서 높이가 다르면 클램프 프레임이 생긴다.
  const navigateToScreen = useScreenNavigate()
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

      navigateToScreen(href)

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
  }, [navigateToScreen])

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

  // 테마 배경 이미지(ADR-088) — 값을 가진 테마에서만 백드롭 한 장을 깐다. 색만 있는 테마는
  // DOM 자체가 늘지 않는다. 실제 그림은 index.css의 .theme-backdrop이 --theme-bg-*를 읽어 그린다.
  //
  // 배경이 있을 땐 루트에서 bg-bg를 뺀다 — 백드롭의 z-index:-1은 부모가 스태킹 컨텍스트일 때만
  // 부모 배경 위에 오는데 이 div는 아니라서, bg-bg를 칠하면 그 불투명 배경이 백드롭 위에 그려져
  // 이미지가 통째로 사라진다(브라우저 확인, 2026-08-03). 바탕색은 body가 같은 값으로 이미 칠한다.
  const hasThemeBackground = getThemeDefinition(theme).background !== undefined

  return (
    <div
      className={`min-h-screen text-text pt-[var(--sa-top)]${hasThemeBackground ? '' : ' bg-bg'}`}
    >
      {hasThemeBackground && (
        <div className="theme-backdrop" data-testid="theme-backdrop" aria-hidden="true" />
      )}
      <div className={isCompleted ? 'pb-[calc(4rem+var(--sa-bottom))]' : undefined}>
        {/* 최상위 경계는 화면 전체가 바뀌는 이동(탭 간)만 받는다 — 탭바는 <Routes> 밖이라
            폴백에 덮이지 않는다. 중첩 자식(/profit/drops)은 **자기 경계를 따로 갖는다**([[ADR-092]]
            결정 3): React 는 가장 가까운 경계를 쓰므로 자식이 서스펜드해도 이 바깥 경계까지
            올라오지 않고, 그래서 부모 BossProfitScreen 이 언마운트되지 않는다([[ADR-077]]). */}
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route
              path="/"
              element={<Navigate to={isCompleted ? '/content' : '/onboarding'} replace />}
            />
            <Route
              path="/onboarding"
              element={isCompleted ? <Navigate to="/content" replace /> : <OnboardingScreen />}
            />
            <Route
              path="/content"
              element={isCompleted ? <ContentScreen /> : <Navigate to="/onboarding" replace />}
            />
            {/* ADR-035 결정 18: 수동 추적 항목 편집 전용 관리 페이지 — 스케줄러 화면은 읽기 전용. */}
            <Route
              path="/content/manage"
              element={isCompleted ? <ContentManageScreen /> : <Navigate to="/onboarding" replace />}
            />
            <Route
              path="/boss"
              element={isCompleted ? <BossScreen /> : <Navigate to="/onboarding" replace />}
            />
            {/* ADR-035 결정 18: 보스 추적+파티 인원 통합 관리 페이지(두 모드 공통, 파티 관리 모달 대체). */}
            <Route
              path="/boss/manage"
              element={isCompleted ? <BossManageScreen /> : <Navigate to="/onboarding" replace />}
            />
            <Route
              path="/profit"
              element={isCompleted ? <BossProfitScreen /> : <Navigate to="/onboarding" replace />}
            >
              {/* 드롭 획득 히스토리(전 기간) — 보스 수익의 서브 화면([[ADR-071]] 결정 7, 이슈 #54).
                  **형제가 아니라 중첩 라우트**다([[ADR-077]]) — 히스토리는 독립 페이지가 아니라 보스
                  수익 위에 얹히는 스택 화면이라, 이동해도 아래 화면이 언마운트되면 안 된다. 형제였을 땐
                  이동마다 언마운트돼 아코디언 펼침·보던 기간·스크롤을 전부 잃었고, 그 언마운트가
                  iOS WKWebView에서 stuck sticky 헤더를 빈 화면으로 만들었다. 화면은
                  BossProfitScreen의 <Outlet />에 오버레이로 그려진다.

                  **자기 Suspense 경계를 갖는다**([[ADR-092]] 결정 3) — 이 element 는 그 <Outlet />
                  자리에 그려지므로 경계가 부모 서브트리 안쪽에 생긴다. 최상위 경계 하나로 처리하면
                  이 청크를 받는 동안 부모까지 폴백으로 대체돼, 위 언마운트가 그대로 되살아난다. */}
              <Route
                path="drops"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <DropHistoryScreen />
                  </Suspense>
                }
              />
            </Route>
            <Route
              path="/settings"
              element={isCompleted ? <SettingsScreen /> : <Navigate to="/onboarding" replace />}
            />
          </Routes>
        </Suspense>
      </div>
      {isCompleted && !isKeyboardVisible && <BottomTabBar />}
      {/* 사용자 동의형 업데이트 모달 — 실행 시(또는 설정에서 수동 확인 시) 새 버전이 있으면 뜬다(ADR-027). */}
      <UpdatePromptModal />
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
