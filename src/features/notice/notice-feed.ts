/**
 * 소식을 받는 자리. 앱 공지는 우리 서버, 넥슨 네 분류는 넥슨 Open API 다. 목록은 `notice-query.ts` 의 쿼리가 이것으로 받는다.
 *
 * 실패는 던지지 않고 `null` · `failed` 로 돌려준다. 키 오류 안내 모달도 띄우지 않는다. 더보기에 들어올 때마다 부르므로 키가
 * 죽은 날 탭을 오갈 때마다 뜨고, 그 안내는 동기화가 한다.
 */
import { fetchNexonNotice, fetchNexonNoticeList, nexonNoticeRef } from '../../nexon/notice/client'
import { currentCredential } from '../auth/current-credential'
import { fetchNotice, fetchNotices } from '../../server/notices'
import type { NexonCredential } from '../../types/auth'
import { NOTICE_KINDS, type Notice, type NoticeKind, type NoticeLookup } from '../../types/notice'

/** 저장된 자격. 넥슨 공지는 이것 없이는 못 받는다. */
async function savedCredential(): Promise<NexonCredential | null> {
  return currentCredential()
}

/** 한 분류를 받는다. 실패면 `null`. 빈 배열은 지금 게시 중인 글이 없다는 답이다. */
export async function receiveNoticeKind(kind: NoticeKind): Promise<Notice[] | null> {
  // 앱 공지만 묻는다. 분류 없이 20건을 받으면 넥슨 공지가 몰린 날 앱 공지가 그 밖으로 밀린다.
  if (kind === 'app') return fetchNotices(20, ['app']).catch(() => null)
  const credential = await savedCredential()
  if (credential === null) return null
  return fetchNexonNoticeList(credential, kind).catch(() => null)
}

/** 한 건의 상세. id 모양이 넥슨 공지면 넥슨 상세, 아니면 서버 상세다. */
export async function fetchNoticeDetail(id: string): Promise<NoticeLookup> {
  const ref = nexonNoticeRef(id)
  if (ref === null) return fetchNotice(id)
  const credential = await savedCredential()
  if (credential === null) return { status: 'failed' }
  return fetchNexonNotice(credential, ref.kind, ref.noticeId)
}

/** 목록을 분류마다 나눈 것. 순서는 받은 그대로다. */
export function groupNoticesByKind(notices: readonly Notice[]): Record<NoticeKind, Notice[]> {
  const grouped = Object.fromEntries(NOTICE_KINDS.map((kind) => [kind, [] as Notice[]])) as Record<NoticeKind, Notice[]>
  for (const notice of notices) grouped[notice.kind].push(notice)
  return grouped
}
