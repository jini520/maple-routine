/**
 * 유예 중에 다시 로그인한 사람에게 삭제 예약을 묻고 취소하는 일.
 *
 * @see docs/features/auth.md 로그아웃과 계정 삭제
 */
import { cancelAccountDeletion, fetchAccountDeletion } from '../../server/account-deletion'
import { serverIdentityHeaders } from './server-identity'

/** 지울 날. 예약이 없거나 묻지 못하면 `null` 이다. 서버가 꺼졌다고 앱을 막지 않고, 다음에 앱을 켤 때 다시 묻는다. */
export async function pendingAccountDeletion(): Promise<Date | null> {
  try {
    const headers = await serverIdentityHeaders()
    if (headers === null) return null
    const deletion = await fetchAccountDeletion(headers)
    return deletion === null ? null : new Date(deletion.deletesAt)
  } catch {
    return null
  }
}

/** 서버가 취소를 받았을 때만 `true` 다. 던지지 않는다. */
export async function cancelPendingAccountDeletion(): Promise<boolean> {
  try {
    const headers = await serverIdentityHeaders()
    if (headers === null) return false
    return (await cancelAccountDeletion(headers)).outcome === 'sent'
  } catch {
    return false
  }
}

/** 확인 창의 지울 날. 30일 뒤가 해를 넘길 수 있어 연도까지 적는다. */
export function deletionDateText(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
}
