/**
 * today 배너에서 닫은 공지 id.
 *
 * **닫은 것은 배너이지 공지가 아니다.** 설정의 목록과 상세에서는 그대로 보인다. 그래서 이 값을
 * 지우는 것은 공지를 지우는 일이 아니라 첫 화면에 다시 세우는 일이다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/**
 * 남기는 건수. `storage/notices.ts` 가 50건에서 자르므로 그보다 많이 기억할 이유가 없다.
 * 잘린 공지는 배너 후보에 애초에 못 오른다.
 */
const KEEP = 50

/** 닫은 순서. 뒤가 최근이다. 저장된 것이 없거나 깨졌으면 빈 배열. */
export async function getDismissedNoticeIds(): Promise<string[]> {
  const raw = await preferences.get(STORAGE_KEYS.dismissedNotices)
  if (raw === null) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    // 깨진 값 때문에 배너를 영영 안 세우느니 한 번 더 보여 주는 편이 낫다.
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** 닫는다. 같은 id 가 두 번 들어와도 한 칸만 쓴다. */
export async function dismissNotice(noticeId: string): Promise<void> {
  const kept = (await getDismissedNoticeIds()).filter((id) => id !== noticeId)
  const next = [...kept, noticeId].slice(-KEEP)

  await preferences.set(STORAGE_KEYS.dismissedNotices, JSON.stringify(next))
}
