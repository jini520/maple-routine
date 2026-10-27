import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

/** 앱 안 리뷰 요청의 기록. 시각은 ISO 문자열이다. */
export interface AppReviewRecord {
  /** 리뷰 요청이 들어간 바이너리를 처음 실행한 시각 */
  firstLaunchAt: string
  /** 성공한 핵심 저장(드롭 기록 · 가계부 기록 · 보스 직접 완료)의 누적 횟수 */
  saveCount: number
  /** 마지막으로 요청한 시각. 요청한 적이 없으면 `null` */
  lastRequestedAt: string | null
}

/** 없거나 읽을 수 없으면 `null`. 깨진 칸을 던지면 저장한 쪽까지 실패처럼 보인다. */
export async function getAppReviewRecord(): Promise<AppReviewRecord | null> {
  const raw = await preferences.get(STORAGE_KEYS.appReview)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AppReviewRecord>
    if (typeof parsed.firstLaunchAt !== 'string' || typeof parsed.saveCount !== 'number') return null
    return {
      firstLaunchAt: parsed.firstLaunchAt,
      saveCount: parsed.saveCount,
      lastRequestedAt: typeof parsed.lastRequestedAt === 'string' ? parsed.lastRequestedAt : null,
    }
  } catch {
    return null
  }
}

export async function setAppReviewRecord(record: AppReviewRecord): Promise<void> {
  await preferences.set(STORAGE_KEYS.appReview, JSON.stringify(record))
}
