import { useOnboardingStore } from '../../features/onboarding/store'
import { ApiKeyForm } from './ApiKeyForm'
import { AccountSelectionList } from './AccountSelectionList'
import { formatOnboardingError } from './error-message'

export function OnboardingScreen(): React.JSX.Element {
  const { status, accounts, error, prefetchProgress, submitApiKey, selectAccount } = useOnboardingStore()

  switch (status) {
    case 'awaitingApiKey':
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <ApiKeyForm isSubmitting={false} errorMessage={null} onSubmit={submitApiKey} />
        </div>
      )

    case 'verifyingApiKey':
      return <p className="text-sm text-text-muted">캐릭터 목록을 확인하고 있어요...</p>

    // ADR-016: 계정 확정 직후 전체 캐릭터의 정보·일정을 예열하는 동안 보여주는 진행률 화면.
    case 'prefetching': {
      const percent =
        prefetchProgress !== null && prefetchProgress.total > 0
          ? Math.round((prefetchProgress.completed / prefetchProgress.total) * 100)
          : 0
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full space-y-2">
            <p className="text-sm text-text-muted">
              캐릭터 정보를 준비하고 있어요
              {prefetchProgress !== null ? ` (${prefetchProgress.completed}/${prefetchProgress.total})` : ''}
            </p>
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
            >
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>
      )
    }

    case 'selectingAccount':
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <AccountSelectionList
            accounts={accounts}
            isSubmitting={false}
            errorMessage={null}
            onSelect={selectAccount}
          />
        </div>
      )

    case 'completed':
      return <p className="text-sm text-text-muted">연동이 완료됐습니다.</p>

    case 'error':
      if (accounts.length === 0) {
        return (
          <div className="flex min-h-screen items-center justify-center p-4">
            <ApiKeyForm
              isSubmitting={false}
              errorMessage={error !== null ? formatOnboardingError(error) : null}
              onSubmit={submitApiKey}
            />
          </div>
        )
      }
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <AccountSelectionList
            accounts={accounts}
            isSubmitting={false}
            errorMessage={error !== null ? formatOnboardingError(error) : null}
            onSelect={selectAccount}
          />
        </div>
      )
  }
}
