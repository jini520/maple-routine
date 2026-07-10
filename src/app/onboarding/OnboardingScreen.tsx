import { useOnboardingStore } from '../../features/onboarding/store'
import { ApiKeyForm } from './ApiKeyForm'
import { AccountSelectionList } from './AccountSelectionList'
import { formatOnboardingError } from './error-message'

export function OnboardingScreen(): React.JSX.Element {
  const { status, accounts, error, submitApiKey, selectAccount } = useOnboardingStore()

  switch (status) {
    case 'awaitingApiKey':
      return <ApiKeyForm isSubmitting={false} errorMessage={null} onSubmit={submitApiKey} />

    case 'verifyingApiKey':
      return <p className="text-sm text-[#8A7362]">확인 중입니다...</p>

    case 'selectingAccount':
      return (
        <AccountSelectionList
          accounts={accounts}
          isSubmitting={false}
          errorMessage={null}
          onSelect={selectAccount}
        />
      )

    case 'completed':
      return <p className="text-sm text-[#8A7362]">연동이 완료됐습니다.</p>

    case 'error':
      if (accounts.length === 0) {
        return (
          <ApiKeyForm
            isSubmitting={false}
            errorMessage={error !== null ? formatOnboardingError(error) : null}
            onSubmit={submitApiKey}
          />
        )
      }
      return (
        <AccountSelectionList
          accounts={accounts}
          isSubmitting={false}
          errorMessage={error !== null ? formatOnboardingError(error) : null}
          onSelect={selectAccount}
        />
      )
  }
}
