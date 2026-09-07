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
import type { Notice } from '../types/notice'

const BASE_URL = 'https://mapleroutine.store/v1'

/**
 * 얼마나 기다리나. **짧게 잡는다.**
 *
 * 화면은 로컬에 쌓인 것을 이미 그리고 있다. 조회가 늦게 실패하는 것보다 빨리 실패하는 편이
 * 낫다. 앞단 nginx 도 같은 이유로 연결 3초 · 읽기 10초로 잡혀 있다.
 */
const TIMEOUT_MS = 8_000

/** 계약을 지킨 것만 통과시킨다. 서버가 어겼을 때 빈 칸이 화면까지 흘러가면 안 된다. */
function isNotice(value: unknown): value is Notice {
  if (typeof value !== 'object' || value === null) return false
  const n = value as Record<string, unknown>
  return (
    typeof n.id === 'string' &&
    typeof n.title === 'string' &&
    typeof n.body === 'string' &&
    typeof n.publishedAt === 'string'
  )
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

/** 최근 공지. 실패하면 빈 배열. */
export async function fetchNotices(limit = 20): Promise<Notice[]> {
  const body = await getJson(`/notices?limit=${limit}`)
  if (typeof body !== 'object' || body === null) return []

  const items = (body as { items?: unknown }).items
  return Array.isArray(items) ? items.filter(isNotice) : []
}

/** 한 건. 없거나 실패하면 `null`. */
export async function fetchNotice(id: string): Promise<Notice | null> {
  // 인코딩을 안 하면 공백이나 슬래시가 든 id 가 주소를 깬다.
  const body = await getJson(`/notices/${encodeURIComponent(id)}`)
  return isNotice(body) ? body : null
}
