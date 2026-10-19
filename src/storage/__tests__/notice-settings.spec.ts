import { installFakePreferences } from './fake-preferences'
import { setNoticeSubscribed } from '../notice-settings'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('noticeSubscribed')
})

describe('실패 전파', () => {
  it('set 이 거부되면 그대로 던진다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setNoticeSubscribed(true)).rejects.toThrow('disk full')
  })
})
