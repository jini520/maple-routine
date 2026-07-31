import { useEffect, useRef } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { useSettingsStore } from '../../features/settings/store'
import { AccountFlowStatus } from './AccountFlowStatus'

export interface AccountModalProps {
  onClose: () => void
}

// API 키 재입력 없이, 저장된 키로 계정 목록만 재조회하는 진입점(계정 변경) — 열리는 즉시
// refreshAccounts()를 트리거하고, 그 결과(AccountFlowStatus)만 보여준다.
export function AccountModal(props: AccountModalProps): React.JSX.Element {
  const { status, accounts, error, prefetchProgress, refreshAccounts, selectAccount } = useSettingsStore()
  // refreshAccounts()는 첫 await(getAuthConfig) 전까지 status를 바꾸지 않으므로, "제출했다"가
  // 아니라 "status가 idle을 실제로 벗어난 적이 있다"를 기준으로 삼아야 마운트 직후 status가
  // 아직 idle인 순간에 곧바로 onClose가 불리는 경쟁 상태를 피할 수 있다.
  const hasLeftIdleRef = useRef(false)

  useEffect(() => {
    refreshAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status !== 'idle') {
      hasLeftIdleRef.current = true
    } else if (hasLeftIdleRef.current) {
      props.onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  return (
    <Modal onClose={props.onClose} testId="account-modal-overlay" card={false}>
      <AccountFlowStatus
        status={status}
        accounts={accounts}
        error={error}
        prefetchProgress={prefetchProgress}
        onSelectAccount={selectAccount}
        // 이슈 #78 D: `reset` 이었다 — status를 'idle'로 되돌리므로 아래 effect의 닫힘 판정
        // (idle로 복귀 + 한 번은 idle을 벗어난 적 있음)이 걸려 **재조회가 아니라 모달이 닫혔다**.
        // 재시도의 뜻대로 계정 목록을 다시 조회한다(VERIFY_START는 status를 'verifying'으로 바꾸므로
        // 닫힘 판정에 걸리지 않는다).
        onRetry={refreshAccounts}
      />
    </Modal>
  )
}
