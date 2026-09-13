/**
 * today 배너에서 닫은 공지 id.
 *
 * **닫은 것은 배너이지 공지가 아니다.** 설정의 목록과 상세에서는 그대로 보인다. 그래서 이 값을
 * 지우는 것은 공지를 지우는 일이 아니라 첫 화면에 다시 세우는 일이다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/**
 * 남기는 건수. 조회가 성공하면 서버 목록에 없는 id 가 빠지므로 보통은 이만큼 안 찬다. 조회가 한
 * 번도 성공하지 못한 기기에서 이 값이 끝없이 자라지 않게 하는 바닥이다.
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

/**
 * 서버 목록에 없는 id 를 빼는 함수. 앱 공지 사본을 바꾸는 조회가 성공했을 때만 부른다.
 *
 * 다른 분류를 묻는 응답에는 앱 공지 id 가 없어서, 그 응답으로 부르면 닫은 기록이 전부 빠진다.
 *
 * @param existingIds 서버가 지금 있다고 답한 앱 공지 id
 */
export async function keepDismissedNotices(existingIds: readonly string[]): Promise<void> {
  const current = await getDismissedNoticeIds()
  const kept = current.filter((id) => existingIds.includes(id))
  if (kept.length === current.length) return
  await preferences.set(STORAGE_KEYS.dismissedNotices, JSON.stringify(kept))
}

/** 닫은 기록에서 id 하나를 빼는 함수. 서버가 그 공지를 없다고 답했을 때 부른다. */
export async function forgetDismissedNotice(noticeId: string): Promise<void> {
  await keepDismissedNotices((await getDismissedNoticeIds()).filter((id) => id !== noticeId))
}
