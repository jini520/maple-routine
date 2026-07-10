import { useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { useOnboardingStore } from './features/onboarding/store'
import { OnboardingScreen } from './app/onboarding/OnboardingScreen'
import { DailyScreen } from './app/daily/DailyScreen'
import { WeeklyScreen } from './app/weekly/WeeklyScreen'

// AppShell은 라우터와 분리해 MemoryRouter로도 테스트할 수 있게 한다.
export function AppShell(): React.JSX.Element {
  const { status, restoreFromStorage } = useOnboardingStore()

  useEffect(() => {
    restoreFromStorage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isCompleted = status === 'completed'

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {isCompleted && (
        <nav className="flex gap-4 p-4">
          <Link to="/daily">일간</Link>
          <Link to="/weekly">주간</Link>
        </nav>
      )}
      <Routes>
        <Route path="/" element={<Navigate to={isCompleted ? '/daily' : '/onboarding'} replace />} />
        <Route
          path="/onboarding"
          element={isCompleted ? <Navigate to="/daily" replace /> : <OnboardingScreen />}
        />
        <Route
          path="/daily"
          element={isCompleted ? <DailyScreen /> : <Navigate to="/onboarding" replace />}
        />
        <Route
          path="/weekly"
          element={isCompleted ? <WeeklyScreen /> : <Navigate to="/onboarding" replace />}
        />
      </Routes>
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
