/**
 * 공지의 사본. **마지막 서버 응답을 분류마다 하나씩 든다.**
 *
 * 공지의 기준은 서버다. 푸시 내용은 여기 안 들어온다. 푸시로만 쌓인 공지는 서버가 지워도 기기에서
 * 지울 신호가 없기 때문이다. 조회가 성공하면 그 분류의 사본을 응답으로 통째로 바꾸고, 실패하면
 * 화면이 이 사본을 그린다.
 *
 * 분류가 다섯이어도 한 칸(`notices`)에 `Notice[]` 로 둔다. OTA 회수로 옛 코드가 돌아도 같은 칸을
 * 배열로 읽고, 이미 쌓인 값을 고쳐 쓰는 마이그레이션이 없다.
 *
 * SQLite 가 아니라 Preferences 인 이유는 필요한 것이 최근 것부터 세로로 읽는 목록 하나뿐이고,
 * 날짜 범위 조회나 조인이 없기 때문이다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import { isNoticeKind, type Notice, type NoticeKind } from '../types/notice'

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

/**
 * 분류가 없는 옛 기록을 `app` 으로 읽는다.
 *
 * 토글이 하나였던 시절에 쌓인 것에는 이 값이 없다. 그때는 운영자 공지밖에 없었으므로 그
 * 분류가 맞고, 저장된 것을 고쳐 쓰지 않아도 화면이 선다.
 */
function withKind(notice: Notice): Notice {
  return isNoticeKind(notice.kind) ? notice : { ...notice, kind: 'app' }
}

function byNewest(a: Notice, b: Notice): number {
  return b.publishedAt.localeCompare(a.publishedAt)
}

async function write(notices: readonly Notice[]): Promise<void> {
  await preferences.set(STORAGE_KEYS.notices, JSON.stringify([...notices].sort(byNewest)))
}

/** 분류 다섯의 사본 전부. 최근 발행순. 저장된 것이 없거나 깨졌으면 빈 배열. */
export async function getNotices(): Promise<Notice[]> {
  const raw = await preferences.get(STORAGE_KEYS.notices)
  if (raw === null) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    // 깨진 값에 화면을 세우느니 빈 목록이 낫다. 다음 조회가 성공하면 다시 찬다.
    return Array.isArray(parsed) ? parsed.filter(isNotice).map(withKind) : []
  } catch {
    return []
  }
}

/**
 * 한 분류의 사본을 응답으로 통째로 바꾸는 함수. 빈 응답이면 그 분류의 사본이 빈다.
 *
 * **응답에 섞인 다른 분류는 넣지 않는다.** 넣으면 그 분류의 사본이 이 조회로 바뀐다.
 *
 * @param kind 조회가 물은 분류
 * @param notices 조회가 성공해 받은 공지
 */
export async function replaceNotices(kind: NoticeKind, notices: readonly Notice[]): Promise<void> {
  const others = (await getNotices()).filter((n) => n.kind !== kind)
  await write([...others, ...notices.filter((n) => withKind(n).kind === kind)])
}

/** 사본에서 공지 하나를 빼는 함수. 서버가 그 id 를 없다고 답했을 때 부른다. */
export async function removeNotice(id: string): Promise<void> {
  const all = await getNotices()
  if (!all.some((n) => n.id === id)) return
  await write(all.filter((n) => n.id !== id))
}
