import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

/**
 * 앱을 다시 띄운 뒤 한 번 보여 줄 알림.
 *
 * 데이터 삭제는 실패해도 앱을 다시 띄운다(clearCacheData → closeBossProfitDb → 스플래시 → reload).
 * 다시 띄우면 지금 화면이 사라져 그 자리에서 토스트를 띄울 수 없다. 그래서 표시를 남기고 부팅이 읽는다.
 *
 * Preferences 에 두는 이유는 React Native 에 `sessionStorage` 가 없어서다. 표시를 남기자마자 다시 띄우므로
 * 다음 부팅이 곧바로 읽고 지운다.
 */

export type PendingNotice = 'cacheClearFailed'

const VALID: readonly string[] = ['cacheClearFailed']

export async function setPendingNotice(notice: PendingNotice): Promise<void> {
  try {
    await preferences.set(STORAGE_KEYS.pendingNotice, notice)
  } catch {
    // 알림 하나를 못 넘기는 것뿐이라 조용히 넘어간다. 여기서 던지면 삭제 흐름 자체가 멈춘다.
  }
}

/** 남은 알림을 읽고 지운다. 한 번만 띄우고, 다시 띄워도 반복하지 않는다. */
export async function consumePendingNotice(): Promise<PendingNotice | null> {
  try {
    const value = await preferences.get(STORAGE_KEYS.pendingNotice)
    if (value === null) {
      return null
    }
    await preferences.remove(STORAGE_KEYS.pendingNotice)
    return VALID.includes(value) ? (value as PendingNotice) : null
  } catch {
    return null
  }
}
