import { installFakePreferences } from './fake-preferences'
import { getNotificationLedger } from '../notification-ledger'
import { STORAGE_KEYS } from '../keys'
import { preferences } from '../ports'

beforeEach(() => {
  installFakePreferences()
})

describe('notificationLedger', () => {
  it('깨진 JSON 은 빈 목록이고, 모양이 틀린 항목은 그 항목만 버린다', async () => {
    await preferences.set(STORAGE_KEYS.notificationLedger, '{')
    await expect(getNotificationLedger()).resolves.toEqual([])

    const good = { id: 1, kind: 'k', fireAt: 1, title: 't', body: 'b' }
    await preferences.set(STORAGE_KEYS.notificationLedger, JSON.stringify([good, { id: 'x' }]))
    await expect(getNotificationLedger()).resolves.toEqual([good])
  })
})
