import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { ListChecks, Settings, Swords } from 'lucide-react'
import { useOnboardingStore } from './features/onboarding/store'
import { useThemeStore } from './features/theme/store'
import { useTrackingModeStore } from './features/tracking-mode/store'
import { useDropEffectStore } from './features/drop-effect/store'
import { consumePendingNotice } from './storage/pending-notice'
import { useToastStore } from './features/toast/store'
import { hideSplashScreen } from './native/splash-screen'
import { refreshSafeAreaInsets } from './native/system-bars'
import { addKeyboardVisibilityListener } from './native/keyboard'
import { OnboardingScreen } from './app/onboarding/OnboardingScreen'
import { ContentScreen } from './app/content-scheduler/ContentScreen'
import { ContentManageScreen } from './app/content-scheduler/ContentManageScreen'
import { BossScreen } from './app/boss-scheduler/BossScreen'
import { BossManageScreen } from './app/boss-scheduler/BossManageScreen'
import { BossProfitScreen } from './app/boss-profit/BossProfitScreen'
import { DropHistoryScreen } from './app/boss-profit/DropHistoryScreen'
import { SettingsScreen } from './app/settings/SettingsScreen'
import { BossCardPreview } from './app/boss-scheduler/BossCardPreview'
import { DailyQuestCardPreview } from './app/content-scheduler/DailyQuestCardPreview'
import { BossPortraitSizePreview } from './app/boss-profit/BossPortraitSizePreview'
import { UpdatePromptModal } from './app/UpdatePromptModal'
import { LoadingPreview } from './app/LoadingPreview'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'
import { ProfitIcon } from './components/ProfitIcon/ProfitIcon'
import { ToastStack } from './components/Toast/ToastStack'

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
      navigate(href)
    }

    nav.addEventListener('click', interceptClick, true)
    return () => {
      nav.removeEventListener('click', interceptClick, true)
    }
  }, [navigate])

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
  const { restoreFromStorage: restoreThemeFromStorage } = useThemeStore()
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

  return (
    <div className="min-h-screen bg-bg text-text pt-[var(--sa-top)]">
      <div className={isCompleted ? 'pb-[calc(4rem+var(--sa-bottom))]' : undefined}>
        <Routes>
          <Route path="/" element={<Navigate to={isCompleted ? '/content' : '/onboarding'} replace />} />
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
                BossProfitScreen의 <Outlet />에 오버레이로 그려진다. */}
            <Route path="drops" element={<DropHistoryScreen />} />
          </Route>
          <Route
            path="/settings"
            element={isCompleted ? <SettingsScreen /> : <Navigate to="/onboarding" replace />}
          />
          {/* 임시 — 보스 카드 크롭 조정용 디버그 라우트. 온보딩/API 데이터 없이 접근 가능.
              크롭 조정이 끝나면 이 라우트와 BossCardPreview.tsx를 삭제할 것 */}
          <Route path="/debug/boss-cards" element={<BossCardPreview />} />
          {/* 임시 — 일일퀘스트 카드 지역 배경 크롭 조정용 디버그 라우트. 온보딩/API 데이터 없이 접근 가능.
              크롭 조정이 끝나면 이 라우트와 DailyQuestCardPreview.tsx를 삭제할 것 (ADR-020) */}
          <Route path="/debug/quest-cards" element={<DailyQuestCardPreview />} />
          {/* 임시 — 보스 수익 화면 BossPortrait 크기 조정용 디버그 라우트. 온보딩/API 데이터 없이 접근 가능.
              크기 조정이 끝나면 이 라우트와 BossPortraitSizePreview.tsx를 삭제할 것 */}
          <Route path="/debug/boss-portrait-size" element={<BossPortraitSizePreview />} />
          {/* 임시 — 로딩 표현 선택지 비교용 디버그 라우트([[ADR-061]]). 온보딩/API 데이터 없이 접근 가능.
              선택이 확정되면 이 라우트와 LoadingPreview.tsx를 삭제할 것 */}
          <Route path="/debug/loading" element={<LoadingPreview />} />
        </Routes>
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
