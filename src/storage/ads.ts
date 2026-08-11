import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

/**
 * 전면광고 마지막 노출 시각 ([[ADR-090]] 결정 3).
 *
 * 메모리로는 부족하다 — 앱을 껐다 켜는 것으로 30분 간격이 우회되면 안 되기 때문이다.
 */
export async function getLastAdShownAt(): Promise<number | null> {
  const value = await preferences.get(STORAGE_KEYS.lastAdShownAt)
  if (value === null) {
    return null
  }
  const parsed = Number(value)
  // 손상된 값은 "기록 없음"으로 읽는다. NaN을 그대로 넘기면 게이트의 뺄셈이 전부 NaN이 되고,
  // NaN 비교는 항상 false라 광고가 영원히 안 뜨는 무음 실패가 된다.
  return Number.isFinite(parsed) ? parsed : null
}

export async function setLastAdShownAt(at: number): Promise<void> {
  await preferences.set(STORAGE_KEYS.lastAdShownAt, String(at))
}
