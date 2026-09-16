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

/**
 * 갈래 여럿을 한 번에 받는 함수. **화면 진입과 당겨서 새로고침이 같이 쓴다.**
 *
 * 도착하는 대로 알리고 전부 끝난 뒤에 판정을 낸다. 둘 다 필요하다. 점진 반영은 늦은 갈래 하나가
 * 나머지를 붙잡지 않게 하고, 당김 인디케이터는 **전부 끝나야** 닫힌다. 먼저 끝난 갈래에서 닫으면
 * 아직 도는 조회가 남은 채로 화면이 다 됐다고 말한다.
 *
 * @param kinds 받을 갈래
 * @param onReceived 한 갈래가 도착할 때마다 부른다. **실패한 갈래는 안 부른다**. 사본이 그대로
 *   서야 하는데 빈 배열로 알리면 화면이 그 갈래를 비운다
 * @returns `allFailed` 는 준 갈래가 **전부** 실패했을 때만 참. 일부 실패는 흔하고 정상이다.
 *   키가 없으면 넥슨 네 갈래가 언제나 `null` 이다
 */
export async function refreshNoticeKinds(
  kinds: readonly NoticeKind[],
  onReceived: (kind: NoticeKind, notices: Notice[]) => void,
): Promise<{ allFailed: boolean }> {
  const results = await Promise.all(
    kinds.map(async (kind) => {
      const received = await refreshNoticeKind(kind)
      if (received !== null) onReceived(kind, received)
      return received
    }),
  )

  return { allFailed: results.every((received) => received === null) }
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
