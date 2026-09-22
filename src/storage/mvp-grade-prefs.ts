/** MVP 등급을 묻는 흐름의 preferences 세 칸. 주간 확인 끄기 · 마지막으로 확인한 주 · 일괄 적용을 물었는가. */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/** `앞으로 등급은 직접 바꿀게요` 를 켰나. */
export async function getMvpWeeklyCheckOff(): Promise<boolean> {
  return (await preferences.get(STORAGE_KEYS.mvpWeeklyCheckOff)) === 'true'
}

export async function setMvpWeeklyCheckOff(off: boolean): Promise<void> {
  if (off) await preferences.set(STORAGE_KEYS.mvpWeeklyCheckOff, 'true')
  else await preferences.remove(STORAGE_KEYS.mvpWeeklyCheckOff)
}

/** 마지막으로 등급을 확인한 주의 목요일. 없으면 `null`. */
export async function getMvpLastCheckedWeek(): Promise<string | null> {
  return preferences.get(STORAGE_KEYS.mvpLastCheckedWeek)
}

export async function setMvpLastCheckedWeek(week: string): Promise<void> {
  await preferences.set(STORAGE_KEYS.mvpLastCheckedWeek, week)
}

/** 기존 사용자의 첫 흐름을 마쳤나. 마치면 일괄 적용 체크박스를 다시 안 세운다. */
export async function getMvpBulkApplyAsked(): Promise<boolean> {
  return (await preferences.get(STORAGE_KEYS.mvpBulkApplyAsked)) === 'true'
}

export async function setMvpBulkApplyAsked(): Promise<void> {
  await preferences.set(STORAGE_KEYS.mvpBulkApplyAsked, 'true')
}
