import { installFakePreferences } from './fake-preferences'
import { getTrackingMode, setTrackingMode } from '../tracking-mode'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('trackingMode')
})

describe('손상된 값', () => {
  it('저장된 값이 알 수 없는 문자열이면 null(미선택)로 폴백한다', async () => {
    await prefs.set('trackingMode', 'something-else')
    await expect(getTrackingMode()).resolves.toBeNull()
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setTrackingMode도 에러를 그대로 전파한다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setTrackingMode('manual')).rejects.toThrow('disk full')
  })
})
