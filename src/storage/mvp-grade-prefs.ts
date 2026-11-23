/** MVP 등급을 묻는 흐름의 preferences 네 칸. 주간 확인 끄기 · 마지막으로 확인한 주 · 일괄 적용을 물었는가 · 온보딩 MVP 화면. */
import { periodCodeOf, periodKeyOfCode } from '../lib/boss/period-code'
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import { whenRecordsReleased } from './record-hold'
import { enqueueChangedSetting } from './server-sync-queue'

/** `앞으로 등급은 직접 바꿀게요` 를 켰나. */
export async function getMvpWeeklyCheckOff(): Promise<boolean> {
  await whenRecordsReleased()
  return (await preferences.get(STORAGE_KEYS.isMvpWeeklyCheckOff)) === 'true'
}

export async function setMvpWeeklyCheckOff(off: boolean): Promise<void> {
  await whenRecordsReleased()
  const before = (await preferences.get(STORAGE_KEYS.isMvpWeeklyCheckOff)) === 'true'
  if (off) await preferences.set(STORAGE_KEYS.isMvpWeeklyCheckOff, 'true')
  else await preferences.remove(STORAGE_KEYS.isMvpWeeklyCheckOff)
  await enqueueChangedSetting('isMvpWeeklyCheckOff', before, off)
}

/** 마지막으로 등급을 확인한 주의 목요일. 저장은 주차 값이다. 없거나 꼴이 다르면 `null`. */
export async function getMvpLastCheckedWeek(): Promise<string | null> {
  await whenRecordsReleased()
  const code = await preferences.get(STORAGE_KEYS.mvpLastCheckedWeekCode)
  return code === null ? null : periodKeyOfCode(code)
}

/** 목요일이 아닌 주는 주차 값으로 적을 수 없어 던진다. */
export async function setMvpLastCheckedWeek(week: string): Promise<void> {
  await whenRecordsReleased()
  const code = periodCodeOf(week)
  if (code === null || !code.startsWith('W')) throw new Error(`주간 기간 key 가 아니다: ${week}`)
  const before = await preferences.get(STORAGE_KEYS.mvpLastCheckedWeekCode)
  await preferences.set(STORAGE_KEYS.mvpLastCheckedWeekCode, code)
  await enqueueChangedSetting('mvpLastCheckedWeekCode', before, code)
}

/** 기존 사용자의 첫 흐름을 마쳤나. 마치면 일괄 적용 체크박스를 다시 안 세운다. */
export async function getMvpBulkApplyAsked(): Promise<boolean> {
  await whenRecordsReleased()
  return (await preferences.get(STORAGE_KEYS.isMvpBulkApplyAsked)) === 'true'
}

export async function setMvpBulkApplyAsked(): Promise<void> {
  await whenRecordsReleased()
  const before = (await preferences.get(STORAGE_KEYS.isMvpBulkApplyAsked)) === 'true'
  await preferences.set(STORAGE_KEYS.isMvpBulkApplyAsked, 'true')
  await enqueueChangedSetting('isMvpBulkApplyAsked', before, true)
}

/** 온보딩 MVP 등급 화면에 들어갔고 아직 시작하기를 안 눌렀나. */
export async function getMvpOnboardingPending(): Promise<boolean> {
  return (await preferences.get(STORAGE_KEYS.mvpOnboardingPending)) === 'true'
}

export async function setMvpOnboardingPending(pending: boolean): Promise<void> {
  if (pending) await preferences.set(STORAGE_KEYS.mvpOnboardingPending, 'true')
  else await preferences.remove(STORAGE_KEYS.mvpOnboardingPending)
}
