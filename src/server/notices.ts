/**
 * 우리 서버의 공지 조회. `nexon/` 이 넥슨 API 를 격리하는 것과 같은 자리다.
 *
 * **여기가 지키는 것은 화면이 네트워크를 안 보는 것이다.** 실패가 어떤 모양이든 밖으로는
 * 빈 배열이나 `null` 만 나간다. 그러면 화면은 기기에 쌓인 것을 그대로 그리고, 서버가 죽어도
 * 앱이 산다. 조회 실패를 화면 전체의 실패로 만들지 않는다.
 *
 * 계약의 원본은 서버 저장소와 이 앱이 나눠 갖는다. 한쪽만 바꾸면 타입 검사가 못 잡으므로
 * 필드를 더할 때 양쪽을 함께 볼 것.
 */
import { isNoticeKind, type Notice, type NoticeBlock, type NoticeKind } from '../types/notice'

const BASE_URL = 'https://mapleroutine.store/v1'

/**
 * 얼마나 기다리나. **짧게 잡는다.**
 *
 * 화면은 로컬에 쌓인 것을 이미 그리고 있다. 조회가 늦게 실패하는 것보다 빨리 실패하는 편이
 * 낫다. 앞단 nginx 도 같은 이유로 연결 3초 · 읽기 10초로 잡혀 있다.
 */
const TIMEOUT_MS = 8_000

/**
 * 아는 블록만 통과시킨다. **모르는 `type` 은 버린다.**
 *
 * 서버가 블록 종류를 늘렸는데 이 앱이 아직 그것을 모르면, 그리는 코드가 없어 화면이 빈 칸을
 * 낸다. 버리면 그 조각만 빠지고 나머지 본문은 그대로 선다.
 */
function toBlocks(value: unknown): NoticeBlock[] | undefined {
  if (!Array.isArray(value)) return undefined

  const blocks: NoticeBlock[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue
    const b = raw as Record<string, unknown>

    if ((b.type === 'heading' || b.type === 'text') && typeof b.text === 'string') {
      blocks.push({ type: b.type, text: b.text })
    } else if (b.type === 'image' && typeof b.src === 'string') {
      blocks.push({ type: 'image', src: b.src })
    } else if (b.type === 'link' && typeof b.text === 'string' && typeof b.href === 'string') {
      blocks.push({ type: 'link', text: b.text, href: b.href })
    } else if (b.type === 'table' && Array.isArray(b.rows)) {
      const rows = b.rows.filter(
        (row): row is string[] => Array.isArray(row) && row.every((cell) => typeof cell === 'string'),
      )
      if (rows.length > 0) blocks.push({ type: 'table', rows })
    }
  }

  return blocks.length === 0 ? undefined : blocks
}

/** 계약을 지킨 것만 통과시킨다. 서버가 어겼을 때 빈 칸이 화면까지 흘러가면 안 된다. */
function toNotice(value: unknown): Notice | null {
  if (typeof value !== 'object' || value === null) return null
  const n = value as Record<string, unknown>

  if (
    typeof n.id !== 'string' ||
    typeof n.title !== 'string' ||
    typeof n.body !== 'string' ||
    typeof n.publishedAt !== 'string'
  ) {
    return null
  }

  const blocks = toBlocks(n.blocks)
  return {
    id: n.id,
    // 분류가 없으면 운영자 공지다. 옛 서버가 답하는 동안에도 화면이 서야 한다.
    kind: isNoticeKind(n.kind) ? n.kind : 'app',
    title: n.title,
    body: n.body,
    publishedAt: n.publishedAt,
    ...(typeof n.link === 'string' ? { link: n.link } : {}),
    ...(blocks === undefined ? {} : { blocks }),
  }
}

async function getJson(path: string): Promise<unknown | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${BASE_URL}${path}`, { signal: controller.signal })
    if (!response.ok) return null
    return (await response.json()) as unknown
  } catch {
    // 사유를 안 가른다. 네트워크가 없든 서버가 죽었든 화면이 할 일은 같다.
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 최근 공지. 실패하면 빈 배열.
 *
 * **여기서 오는 것에는 `blocks` 가 없다.** 업데이트 한 건이 블록 797개라 목록에 실으면 한
 * 응답이 MB 단위가 된다. 본문은 `fetchNotice` 가 준다.
 *
 * @param kinds 비어 있으면 전 분류. 켠 토글만 물으면 목록이 그만큼만 온다.
 */
export async function fetchNotices(limit = 20, kinds: readonly NoticeKind[] = []): Promise<Notice[]> {
  const query = kinds.length === 0 ? '' : `&kind=${kinds.join(',')}`
  const body = await getJson(`/notices?limit=${limit}${query}`)
  if (typeof body !== 'object' || body === null) return []

  const items = (body as { items?: unknown }).items
  if (!Array.isArray(items)) return []

  const notices: Notice[] = []
  for (const one of items) {
    const notice = toNotice(one)
    if (notice !== null) notices.push(notice)
  }
  return notices
}

/** 한 건. 본문 블록이 여기 실려 온다. 없거나 실패하면 `null`. */
export async function fetchNotice(id: string): Promise<Notice | null> {
  // 인코딩을 안 하면 공백이나 슬래시가 든 id 가 주소를 깬다.
  return toNotice(await getJson(`/notices/${encodeURIComponent(id)}`))
}
