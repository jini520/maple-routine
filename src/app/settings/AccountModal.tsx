import { useEffect, useRef, useState } from 'react'
import { Modal } from '../../components/organisms/Modal/Modal'
import { useSettingsStore } from '../../features/settings/store'
import { AccountFlowStatus } from './AccountFlowStatus'

export interface AccountModalProps {
  onClose: () => void
}

// API 키 재입력 없이, 저장된 키로 계정 목록만 재조회하는 진입점(계정 변경) — 열리는 즉시
// refreshAccounts()를 트리거하고, 그 결과(AccountFlowStatus)만 보여준다.
export function AccountModal(props: AccountModalProps): React.JSX.Element {
  const {
    status,
    accounts,
    error,
    prefetchProgress,
    pendingAccountId,
    refreshAccounts,
    selectAccount,
    commitAccountChange,
    reset,
  } = useSettingsStore()
  // ADR-086 결정 6: 커밋(두 쓰기 + 수동 모드 시드)이 끝나 status가 idle로 돌아가기 전까지의
  // 구간 동안 저장 버튼을 스피너로 바꿔 중복 클릭을 막는다 — 전용 status가 없어 로컬 상태로 다룬다.
  const [isCommitting, setIsCommitting] = useState(false)

  async function handleCommit(ocids: string[]): Promise<void> {
    setIsCommitting(true)
    try {
      await commitAccountChange(ocids)
    } finally {
      setIsCommitting(false)
    }
  }
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
    <Modal onClose={props.onClose} testId="account-modal-overlay">
      <Modal.Panel>
        <AccountFlowStatus
          status={status}
          accounts={accounts}
          error={error}
          prefetchProgress={prefetchProgress}
          pendingAccountId={pendingAccountId}
          isCommitting={isCommitting}
          onSelectAccount={selectAccount}
          onCommitCharacters={handleCommit}
          // ADR-086 결정 6: 취소는 아무것도 되돌릴 필요가 없다 — 아직 아무것도 쓰지 않았다.
          // status가 idle로 돌아가면 아래 effect가 모달을 닫는다.
          onCancel={reset}
          // 이슈 #78 D: `reset` 이었다 — status를 'idle'로 되돌리므로 아래 effect의 닫힘 판정
          // (idle로 복귀 + 한 번은 idle을 벗어난 적 있음)이 걸려 **재조회가 아니라 모달이 닫혔다**.
          // 재시도의 뜻대로 계정 목록을 다시 조회한다(VERIFY_START는 status를 'verifying'으로 바꾸므로
          // 닫힘 판정에 걸리지 않는다).
          onRetry={refreshAccounts}
        />
      </Modal.Panel>
    </Modal>
  )
}
