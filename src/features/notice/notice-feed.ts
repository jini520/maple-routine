/**
 * 소식 목록 · 상세를 받는 자리. 앱 공지는 우리 서버, 넥슨 네 분류는 넥슨 Open API 다.
 *
 * 실패는 던지지 않고 `null` · `failed` 로 돌려준다. 화면은 그때 기기의 사본을 그린다.
 * 키 오류 안내 모달도 띄우지 않는다. 더보기에 들어올 때마다 부르므로 키가 죽은 날 탭을 오갈 때마다 뜨고, 그 안내는 동기화가 한다.
 */
import { fetchNexonNotice, fetchNexonNoticeList, nexonNoticeRef } from '../../nexon/notice/client'
import { fetchNotice, fetchNotices } from '../../server/notices'
import { getAuthConfig } from '../../storage/api-key'
import { NOTICE_KINDS, type Notice, type NoticeKind, type NoticeLookup } from '../../types/notice'
import { saveNoticeResponse } from './notice-copy'

/** 받는 중인 조회. 같은 분류를 또 부르면 이것을 기다린다. */
const inFlight = new Map<NoticeKind, Promise<Notice[] | null>>()

async function apiKey(): Promise<string | null> {
  return (await getAuthConfig().catch(() => null))?.apiKey ?? null
}

async function receive(kind: NoticeKind): Promise<Notice[] | null> {
  if (kind === 'app') return fetchNotices(20, ['app'])
  const key = await apiKey()
  if (key === null) return null
  return fetchNexonNoticeList(key, kind).catch(() => null)
}

/**
 * 한 분류를 받아 사본을 바꾸는 함수. 받은 목록을 돌려주고, 실패면 `null` 이고 사본을 안 건드린다.
 *
 * 빈 배열은 실패가 아니라 지금 게시 중인 글이 없다는 답이라 사본도 빈다.
 */
export function refreshNoticeKind(kind: NoticeKind): Promise<Notice[] | null> {
  const running = inFlight.get(kind)
  if (running !== undefined) return running

  const request = (async () => {
    const notices = await receive(kind)
    if (notices !== null) await saveNoticeResponse(kind, notices).catch(() => undefined)
    return notices
  })().finally(() => inFlight.delete(kind))

  inFlight.set(kind, request)
  return request
}

/** 한 건의 상세. id 모양이 넥슨 공지면 넥슨 상세, 아니면 서버 상세다. */
export async function fetchNoticeDetail(id: string): Promise<NoticeLookup> {
  const ref = nexonNoticeRef(id)
  if (ref === null) return fetchNotice(id)
  const key = await apiKey()
  if (key === null) return { status: 'failed' }
  return fetchNexonNotice(key, ref.kind, ref.noticeId)
}

/** 사본을 분류마다 나눈 것. 순서는 받은 그대로다. */
export function groupNoticesByKind(notices: readonly Notice[]): Record<NoticeKind, Notice[]> {
  const grouped = Object.fromEntries(NOTICE_KINDS.map((kind) => [kind, [] as Notice[]])) as Record<NoticeKind, Notice[]>
  for (const notice of notices) grouped[notice.kind].push(notice)
  return grouped
}
