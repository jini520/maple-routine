import { installFakePreferences } from './fake-preferences'
import {
  getMvpBulkApplyAsked,
  getMvpLastCheckedWeek,
  getMvpWeeklyCheckOff,
  setMvpBulkApplyAsked,
  setMvpLastCheckedWeek,
  setMvpWeeklyCheckOff,
} from '../mvp-grade-prefs'

beforeEach(() => {
  installFakePreferences()
})

describe('MVP 등급 preferences', () => {
  it('아무것도 없으면 주간 확인은 켜져 있고 확인한 주도 일괄 적용 물음도 없다', async () => {
    await expect(getMvpWeeklyCheckOff()).resolves.toBe(false)
    await expect(getMvpLastCheckedWeek()).resolves.toBeNull()
    await expect(getMvpBulkApplyAsked()).resolves.toBe(false)
  })

  it('적은 값을 되읽는다', async () => {
    await setMvpWeeklyCheckOff(true)
    await setMvpLastCheckedWeek('2026-09-17')
    await setMvpBulkApplyAsked()

    await expect(getMvpWeeklyCheckOff()).resolves.toBe(true)
    await expect(getMvpLastCheckedWeek()).resolves.toBe('2026-09-17')
    await expect(getMvpBulkApplyAsked()).resolves.toBe(true)
  })

  it('주간 확인을 다시 켜면 끈 표시가 풀린다', async () => {
    await setMvpWeeklyCheckOff(true)
    await setMvpWeeklyCheckOff(false)

    await expect(getMvpWeeklyCheckOff()).resolves.toBe(false)
  })
})
