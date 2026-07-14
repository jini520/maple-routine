import { useEffect } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { Coins, ListChecks, Settings, Swords } from 'lucide-react'
import { useOnboardingStore } from './features/onboarding/store'
import { useThemeStore } from './features/theme/store'
import { OnboardingScreen } from './app/onboarding/OnboardingScreen'
import { ContentScreen } from './app/content-scheduler/ContentScreen'
import { BossScreen } from './app/boss-scheduler/BossScreen'
import { BossProfitScreen } from './app/boss-profit/BossProfitScreen'
import { SettingsScreen } from './app/settings/SettingsScreen'
import { BossCardPreview } from './app/boss-scheduler/BossCardPreview'
import { DailyQuestCardPreview } from './app/content-scheduler/DailyQuestCardPreview'
import { BossPortraitSizePreview } from './app/boss-profit/BossPortraitSizePreview'

const TAB_ITEMS = [
  { to: '/content', label: '컨텐츠', Icon: ListChecks },
  { to: '/boss', label: '보스', Icon: Swords },
  { to: '/profit', label: '수익', Icon: Coins },
  { to: '/settings', label: '설정', Icon: Settings },
] as const

function BottomTabBar(): React.JSX.Element {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
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

  useEffect(() => {
    restoreFromStorage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    restoreThemeFromStorage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isCompleted = status === 'completed'

  return (
    <div className="min-h-screen bg-bg text-text pt-[env(safe-area-inset-top)]">
      <div className={isCompleted ? 'pb-[calc(4rem+env(safe-area-inset-bottom))]' : undefined}>
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
      {isCompleted && <BottomTabBar />}
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
