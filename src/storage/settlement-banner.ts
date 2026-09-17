/**
 * 결산 안내 줄을 닫을 때 기억하는 **그 결산의 시작 시각**.
 *
 * 열쇠가 **닫았다** 라는 불리언이 아닌 이유는, 결산이 끝나는 순간 앱이 꺼져 있어도 다음 밤에 줄이
 * 다시 서야 하기 때문이다. 불리언이면 그것을 지울 사람이 없다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/** 닫은 결산의 시작 시각. 없으면 `null`. */
export async function getDismissedSettlementAt(): Promise<string | null> {
  return preferences.get(STORAGE_KEYS.dismissedSettlement)
}

/** @param startedAt 서버가 준 이번 결산의 시작 시각 */
export async function dismissSettlement(startedAt: string): Promise<void> {
  await preferences.set(STORAGE_KEYS.dismissedSettlement, startedAt)
}
