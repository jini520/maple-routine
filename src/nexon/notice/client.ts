/**
 * 넥슨 공지 네 분류의 목록 · 상세 조회. 응답을 앱의 `Notice` 로 옮긴다.
 *
 * 목록 응답의 배열 키가 분류마다 다르고 이벤트 · 캐시샵만 썸네일과 기간을 준다. 그 차이를 화면이 알 필요가 없다.
 *
 * ⚠️ 상세는 목록에 지금 떠 있는 글만 답한다. 목록 밖 번호는 400 `OPENAPI00004` 다.
 * ⚠️ 상세 응답에 `notice_id` 가 없어 부른 쪽의 번호로 id 를 만든다.
 */
import type { NexonNoticeKind, Notice, NoticeLookup } from '../../types/notice'
import { NexonBadRequestError, NexonNetworkError } from '../errors'
import { requestJson } from '../http'
import { parseContents } from './contents'

const ENDPOINTS: Record<NexonNoticeKind, { list: string; key: string }> = {
  game: { list: '/maplestory/v1/notice', key: 'notice' },
  update: { list: '/maplestory/v1/notice-update', key: 'update_notice' },
  event: { list: '/maplestory/v1/notice-event', key: 'event_notice' },
  cashshop: { list: '/maplestory/v1/notice-cashshop', key: 'cashshop_notice' },
}

/**
 * 넥슨 날짜를 ISO UTC 로 바꾸는 함수. 못 읽으면 `null`.
 *
 * 넥슨은 `2026-09-09T16:24+09:00` 꼴(초 없음 · KST 오프셋)로 준다. 그대로 두면 서버 사본의 UTC 와 정렬 축이 갈린다.
 */
function toIso(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw === '') return null
  const at = new Date(raw)
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}

function text(raw: unknown): string | null {
  return typeof raw === 'string' && raw !== '' ? raw : null
}

/** 목록 · 상세가 함께 쓰는 필드. 기간은 이벤트가 `date_event_*`, 캐시샵이 `date_sale_*` 다. */
function toNotice(kind: NexonNoticeKind, noticeId: number, item: Record<string, unknown>): Notice | null {
  const title = text(item.title)
  const publishedAt = toIso(item.date)
  if (title === null || publishedAt === null) return null

  const link = text(item.url)
  const thumbnailUrl = text(item.thumbnail_url)
  const startsAt = toIso(item.date_event_start ?? item.date_sale_start)
  const endsAt = toIso(item.date_event_end ?? item.date_sale_end)

  return {
    id: `${kind}-${noticeId}`,
    kind,
    title,
    body: '',
    publishedAt,
    ...(link === null ? {} : { link }),
    ...(thumbnailUrl === null ? {} : { thumbnailUrl }),
    ...(startsAt === null ? {} : { startsAt }),
    ...(endsAt === null ? {} : { endsAt }),
  }
}

/**
 * 그 분류의 목록. 못 읽는 항목만 버린다.
 *
 * 배열 키가 없는 응답은 빈 목록이 아니라 실패로 던진다. 빈 목록으로 읽으면 기기의 사본이 지워진다.
 */
export async function fetchNexonNoticeList(apiKey: string, kind: NexonNoticeKind): Promise<Notice[]> {
  const { list, key } = ENDPOINTS[kind]
  const body = await requestJson<Record<string, unknown> | null>(list, apiKey)
  const raw = body?.[key]
  if (!Array.isArray(raw)) throw new NexonNetworkError(`Nexon 공지 목록에 ${key} 배열이 없습니다`)

  const notices: Notice[] = []
  for (const one of raw) {
    if (typeof one !== 'object' || one === null) continue
    const item = one as Record<string, unknown>
    const noticeId = Number(item.notice_id)
    if (item.notice_id === null || !Number.isInteger(noticeId)) continue
    const notice = toNotice(kind, noticeId, item)
    if (notice !== null) notices.push(notice)
  }
  return notices
}

/** 넥슨 공지 id(`event-1374`)의 분류와 번호. 앱 공지 id 는 `null` 이다. */
export function nexonNoticeRef(id: string): { kind: NexonNoticeKind; noticeId: number } | null {
  const match = /^(game|update|event|cashshop)-(\d+)$/.exec(id)
  if (match === null) return null
  return { kind: match[1] as NexonNoticeKind, noticeId: Number(match[2]) }
}

/** 한 건의 상세. 본문 HTML 을 블록으로 바꿔 싣는다. */
export async function fetchNexonNotice(
  apiKey: string,
  kind: NexonNoticeKind,
  noticeId: number,
): Promise<NoticeLookup> {
  let body: unknown
  try {
    body = await requestJson<unknown>(`${ENDPOINTS[kind].list}/detail?notice_id=${noticeId}`, apiKey)
  } catch (error) {
    // 다른 400(키 무효 등)을 없다로 읽으면 멀쩡한 공지가 사본에서 빠진다.
    if (error instanceof NexonBadRequestError && error.code === 'OPENAPI00004') return { status: 'missing' }
    return { status: 'failed' }
  }

  if (typeof body !== 'object' || body === null) return { status: 'failed' }
  const detail = body as Record<string, unknown>
  const notice = toNotice(kind, noticeId, detail)
  if (notice === null) return { status: 'failed' }

  return { status: 'found', notice: { ...notice, blocks: parseContents(text(detail.contents) ?? '') } }
}
