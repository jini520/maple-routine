import { installFakePreferences } from './fake-preferences'
import { getNotificationLedger, setNotificationLedger } from '../notification-ledger'
import { STORAGE_KEYS } from '../keys'
import { preferences } from '../ports'

beforeEach(() => {
  installFakePreferences()
})

describe('notificationLedger', () => {
  it('없으면 빈 목록이다', async () => {
    await expect(getNotificationLedger()).resolves.toEqual([])
  })

  it('쓴 것을 그대로 읽는다', async () => {
    const entry = { id: 7, kind: 'party-appointment', fireAt: 1000, title: '제목', body: '본문' }
    await setNotificationLedger([entry])

    await expect(getNotificationLedger()).resolves.toEqual([entry])
  })

  it('깨진 JSON 은 빈 목록이고, 모양이 틀린 항목은 그 항목만 버린다', async () => {
    await preferences.set(STORAGE_KEYS.notificationLedger, '{')
    await expect(getNotificationLedger()).resolves.toEqual([])

    const good = { id: 1, kind: 'k', fireAt: 1, title: 't', body: 'b' }
    await preferences.set(STORAGE_KEYS.notificationLedger, JSON.stringify([good, { id: 'x' }]))
    await expect(getNotificationLedger()).resolves.toEqual([good])
  })
})
