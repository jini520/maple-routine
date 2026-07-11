import { useEffect } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { Coins, ListChecks, Swords } from 'lucide-react'
import { useOnboardingStore } from './features/onboarding/store'
import { OnboardingScreen } from './app/onboarding/OnboardingScreen'
import { ContentScreen } from './app/content-scheduler/ContentScreen'
import { BossScreen } from './app/boss-scheduler/BossScreen'
import { BossProfitScreen } from './app/boss-profit/BossProfitScreen'

const TAB_ITEMS = [
  { to: '/content', label: '컨텐츠', Icon: ListChecks },
  { to: '/boss', label: '보스', Icon: Swords },
  { to: '/profit', label: '수익', Icon: Coins },
] as const

function BottomTabBar(): React.JSX.Element {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-[#F0DFD1] bg-white">
      {TAB_ITEMS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            isActive
              ? 'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-[#C2410C]'
              : 'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-[#B7A490]'
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

  useEffect(() => {
    restoreFromStorage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isCompleted = status === 'completed'

  return (
    <div className="min-h-screen bg-[#FFF9F4] text-[#2B1B10]">
      <div className={isCompleted ? 'pb-16' : undefined}>
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
