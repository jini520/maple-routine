/**
 * 삭제를 예약한 계정으로 다시 들어온 사람에게 취소를 묻는 모달. 앱을 켤 때와 로그인할 때 모두 `signedIn` 으로 와서 한 번 묻는다.
 *
 * **닫는 수단이 없다.** 고르지 않고 닫으면 서버가 쓰기를 거절하는 채로 앱을 쓰게 된다.
 * 주 버튼이 `삭제 취소` 인 것은 같은 계정으로 돌아온 사람이 대개 계속 쓰려는 사람이라서다.
 */
import { useEffect, useState } from 'react'

import { CalendarClockIcon } from '../../components/atoms'
import { InsetNote } from '../../components/molecules/InsetRow/InsetRow'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import {
  cancelPendingAccountDeletion,
  deletionDateText,
  pendingAccountDeletion,
} from '../../features/auth/account-deletion'
import { useAuthStore } from '../../features/auth/store'
import { useToastStore } from '../../features/toast/store'

export function AccountDeletionPrompt(): React.JSX.Element | null {
  const status = useAuthStore((state) => state.status)
  const signOut = useAuthStore((state) => state.signOut)
  const [deletesAt, setDeletesAt] = useState<Date | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (status !== 'signedIn') return
    let alive = true
    void pendingAccountDeletion().then((date) => {
      if (alive) setDeletesAt(date)
    })
    return () => {
      alive = false
    }
  }, [status])

  if (status !== 'signedIn' || deletesAt === null) return null

  async function cancel(): Promise<void> {
    setBusy(true)
    const cancelled = await cancelPendingAccountDeletion()
    setBusy(false)
    if (cancelled) setDeletesAt(null)
    else useToastStore.getState().showError('삭제를 취소하지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
  }

  return (
    <NoticeModal
      icon={CalendarClockIcon}
      tone="primary"
      title="삭제 예정인 계정이에요"
      content={<InsetNote>{`${deletionDateText(deletesAt)}에 삭제돼요. 계속 쓰려면 삭제를 취소해 주세요.`}</InsetNote>}
      action={{ label: '삭제 취소', onPress: () => void cancel(), busy, disabled: busy }}
      secondaryAction={{
        label: '로그아웃',
        onPress: () => {
          setDeletesAt(null)
          void signOut()
        },
        disabled: busy,
      }}
      onClose={() => {}}
      testId="account-deletion-prompt-overlay"
    />
  )
}
