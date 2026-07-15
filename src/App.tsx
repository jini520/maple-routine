import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { Coins, ListChecks, Settings, Swords } from 'lucide-react'
import { useOnboardingStore } from './features/onboarding/store'
import { useThemeStore } from './features/theme/store'
import { hideSplashScreen } from './native/splash-screen'
import { refreshSafeAreaInsets } from './native/system-bars'
import { addKeyboardVisibilityListener } from './native/keyboard'
import { OnboardingScreen } from './app/onboarding/OnboardingScreen'
import { ContentScreen } from './app/content-scheduler/ContentScreen'
import { BossScreen } from './app/boss-scheduler/BossScreen'
import { BossProfitScreen } from './app/boss-profit/BossProfitScreen'
import { SettingsScreen } from './app/settings/SettingsScreen'
import { BossCardPreview } from './app/boss-scheduler/BossCardPreview'
import { DailyQuestCardPreview } from './app/content-scheduler/DailyQuestCardPreview'
import { BossPortraitSizePreview } from './app/boss-profit/BossPortraitSizePreview'
import { UpdatePromptModal } from './app/UpdatePromptModal'

const TAB_ITEMS = [
  { to: '/content', label: '컨텐츠', Icon: ListChecks },
  { to: '/boss', label: '보스', Icon: Swords },
  { to: '/profit', label: '수익', Icon: Coins },
  { to: '/settings', label: '설정', Icon: Settings },
] as const

// 네이티브 스플래시가 순식간에 지나가 깜빡이지 않도록, 앱 번들 평가 시점부터 최소 이 시간만큼은 유지한다.
const APP_START_MS = Date.now()
const MIN_SPLASH_MS = 1000

function BottomTabBar(): React.JSX.Element {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-border bg-surface pb-[var(--sa-bottom)]">
      {TAB_ITEMS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            isActive
              ? 'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-primary'
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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

  useEffect(() => {
    restoreFromStorage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    restoreThemeFromStorage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <Route
            path="/boss"
            element={isCompleted ? <BossScreen /> : <Navigate to="/onboarding" replace />}
          />
          <Route
            path="/profit"
            element={isCompleted ? <BossProfitScreen /> : <Navigate to="/onboarding" replace />}
          />
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
        </Routes>
      </div>
      {isCompleted && !isKeyboardVisible && <BottomTabBar />}
      {/* 사용자 동의형 업데이트 모달 — 실행 시(또는 설정에서 수동 확인 시) 새 버전이 있으면 뜬다(ADR-027). */}
      <UpdatePromptModal />
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

export default App
