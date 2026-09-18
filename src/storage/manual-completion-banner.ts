/**
 * 직접 완료 안내 줄을 닫을 때 기억하는 **그때의 주간 기간 키**(목요일 `YYYY-MM-DD`).
 *
 * 열쇠가 **닫았다** 라는 불리언이 아닌 이유는 결산 줄과 같다. 주가 바뀌면 다시 서야 하는데,
 * 불리언이면 그것을 지울 사람이 없다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/** 닫은 주의 주간 기간 키. 없으면 `null`. */
export async function getDismissedManualCompletionWeek(): Promise<string | null> {
  return preferences.get(STORAGE_KEYS.dismissedManualCompletion)
}

/** @param weeklyPeriodKey 닫는 순간의 주간 기간 키 */
export async function dismissManualCompletion(weeklyPeriodKey: string): Promise<void> {
  await preferences.set(STORAGE_KEYS.dismissedManualCompletion, weeklyPeriodKey)
}
