import { useEffect, useRef } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { useSettingsStore } from '../../features/settings/store'
import { ApiKeyForm } from '../onboarding/ApiKeyForm'
import { AccountFlowStatus } from './AccountFlowStatus'

export interface ApiKeyModalProps {
  onClose: () => void
}

export function ApiKeyModal(props: ApiKeyModalProps): React.JSX.Element {
  const { status, accounts, error, prefetchProgress, changeApiKey, selectAccount, reset } = useSettingsStore()
  // status가 idle을 실제로 벗어난 적이 있을 때만 idle 복귀를 "완료"로 해석한다(AccountModal과
  // 동일한 이유 — 마운트 직후의 idle과 완료 후의 idle을 구분하기 위함).
  const hasLeftIdleRef = useRef(false)

  useEffect(() => {
    if (status !== 'idle') {
      hasLeftIdleRef.current = true
    } else if (hasLeftIdleRef.current) {
      props.onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  function handleSubmit(apiKey: string): void {
    changeApiKey(apiKey)
  }

  return (
    <Modal onClose={props.onClose} testId="api-key-modal-overlay" card={false}>
      {status === 'idle' && <ApiKeyForm isSubmitting={false} errorMessage={null} onSubmit={handleSubmit} />}

      <AccountFlowStatus
        status={status}
        accounts={accounts}
        error={error}
        prefetchProgress={prefetchProgress}
        onSelectAccount={selectAccount}
        onRetry={reset}
      />
    </Modal>
  )
}
