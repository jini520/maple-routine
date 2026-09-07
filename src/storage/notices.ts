/**
 * 받은 공지. **기기에 쌓이고 서버는 보강이다.**
 *
 * 푸시로 온 것과 서버에서 받은 것이 한 자리에 섞인다. 그래서 서버가 죽어도 이미 받은 공지는
 * 열린다. 화면이 어느 쪽에서 왔는지 안 가리는 이유가 그것이다.
 *
 * SQLite 가 아니라 Preferences 인 이유는 필요한 것이 최근 것부터 세로로 읽는 목록 하나뿐이고,
 * 날짜 범위 조회나 조인이 없기 때문이다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import type { Notice } from '../types/notice'

/**
 * 남기는 건수. 넘으면 오래된 것부터 자른다.
 *
 * 잘린 공지를 다시 볼 일이 생기면 서버가 준다. 무한히 쌓으면 Preferences 한 칸이 계속 자라는데,
 * 그 값은 읽을 때마다 통째로 파싱된다.
 */
const KEEP = 50

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

/** 최근 발행순. 저장된 것이 없거나 깨졌으면 빈 배열. */
export async function getNotices(): Promise<Notice[]> {
  const raw = await preferences.get(STORAGE_KEYS.notices)
  if (raw === null) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    // 깨진 값에 화면을 세우느니 빈 목록이 낫다. 다음 공지가 오면 다시 찬다.
    return Array.isArray(parsed) ? parsed.filter(isNotice) : []
  } catch {
    return []
  }
}

/**
 * 넣고 합친다. **같은 `id` 는 새로 들어온 쪽이 이긴다.**
 *
 * 서버가 발송 뒤 오타를 고칠 수 있고, 푸시는 발송 시점에 굳은 사본이라서다. 푸시 페이로드는
 * 4KB 제한에 걸려 본문이 잘려 올 수도 있는데 그 자리도 서버 조회가 덮는다.
 */
export async function mergeNotices(incoming: readonly Notice[]): Promise<void> {
  const byId = new Map<string, Notice>()
  for (const n of await getNotices()) byId.set(n.id, n)
  for (const n of incoming) byId.set(n.id, n)

  const merged = [...byId.values()]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, KEEP)

  await preferences.set(STORAGE_KEYS.notices, JSON.stringify(merged))
}
