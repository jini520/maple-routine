/**
 * 이 기기에 쓸 수 있는 키가 없는 부계정의 흐린 기록을 누르면 뜨는 모달. 키를 다시 등록하거나 그 계정의 기록을 이 기기에서만 지운다.
 *
 * @example
 * {keyLostMapleId !== null && <KeyLostRecordModal mapleId={keyLostMapleId} onClose={() => setKeyLostMapleId(null)} />}
 *
 * @see docs/foundation/server-sync.md `키 없는 부계정의 기록`
 */
import { useState } from 'react'

import { KeyRoundIcon } from '../components/atoms'
import { NoticeModal } from '../components/organisms/NoticeModal/NoticeModal'
import { useAccountManageOpenStore } from '../features/account-manage/open-request'
import { discardKeyLostMapleId } from '../features/server-sync/discard'
import { loadKeyRegisterTarget } from '../features/server-sync/keyless'
import { useToastStore } from '../features/toast/store'

/** 올리지 못한 기록이 남아 지우지 않았을 때의 토스트. 원본을 지우면 서버와 다른 기기의 기록까지 지워져서 지우지 않는다 */
export const KEY_LOST_DISCARD_PENDING_MESSAGE = '아직 서버에 올리지 못한 기록이 있어 지우지 못했습니다. 잠시 뒤 다시 시도해 주세요.'

/** 지우다 실패했을 때의 토스트. 대기 줄이 남은 것과 갈라야 다시 시도할 까닭을 맞게 말한다 */
export const KEY_LOST_DISCARD_FAILED_MESSAGE = '기록을 지우지 못했습니다. 잠시 뒤 다시 시도해 주세요.'

export function KeyLostRecordModal(props: { mapleId: string; onClose: () => void }): React.JSX.Element {
  const [busy, setBusy] = useState(false)

  async function register(): Promise<void> {
    setBusy(true)
    const accountKey = await loadKeyRegisterTarget(props.mapleId).catch(() => null)
    setBusy(false)
    props.onClose()
    useAccountManageOpenStore.getState().open({ accountKey, openKeySheet: true })
  }

  async function discard(): Promise<void> {
    setBusy(true)
    const result = await discardKeyLostMapleId(props.mapleId).catch(() => 'failed' as const)
    setBusy(false)
    props.onClose()
    if (result === 'pending') useToastStore.getState().showError(KEY_LOST_DISCARD_PENDING_MESSAGE)
    else if (result === 'failed') useToastStore.getState().showError(KEY_LOST_DISCARD_FAILED_MESSAGE)
  }

  return (
    <NoticeModal
      icon={KeyRoundIcon}
      tone="primary"
      title="키가 없는 계정의 기록이에요"
      description="이 계정의 API 키가 없거나 유효하지 않아 합계에서 뺐어요."
      action={{ label: 'API 키 등록', onPress: () => void register(), disabled: busy }}
      secondaryAction={{ label: '기록 삭제', onPress: () => void discard(), danger: true, busy, disabled: busy }}
      onClose={props.onClose}
      showCloseButton
      closeDisabled={busy}
      testId="key-lost-record-modal"
    />
  )
}
