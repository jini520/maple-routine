import { installFakePreferences } from './fake-preferences'
import {
  getMvpBulkApplyAsked,
  getMvpLastCheckedWeek,
  getMvpWeeklyCheckOff,
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
})
