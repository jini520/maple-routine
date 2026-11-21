import { installFakePreferences } from './fake-preferences'
import { getMvpLastCheckedWeek, setMvpLastCheckedWeek } from '../mvp-grade-prefs'

// 마지막으로 확인한 주는 서버 칸처럼 주차 값으로 적고, 흐름은 그 주의 목요일로 견준다.
it('마지막으로 확인한 주를 주차 값으로 적어 목요일로 되읽고, 목요일이 아닌 주는 던진다', async () => {
  const prefs = installFakePreferences()

  await setMvpLastCheckedWeek('2026-11-19')

  expect(await prefs.get('mvpLastCheckedWeekCode')).toBe('W202647')
  await expect(getMvpLastCheckedWeek()).resolves.toBe('2026-11-19')
  await expect(setMvpLastCheckedWeek('2026-11-18')).rejects.toThrow()
})
