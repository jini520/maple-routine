import { installFakePreferences } from './fake-preferences'
import { getTrackingMode, setTrackingMode } from '../tracking-mode'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('trackingMode')
})

describe('미선택 (ADR-086 결정 2)', () => {
  it('저장된 값이 없으면 null(미선택)을 반환한다 — auto로 위장하지 않는다', async () => {
    await expect(getTrackingMode()).resolves.toBeNull()
  })
})

describe('round-trip', () => {
  it('setTrackingMode(manual) 후 getTrackingMode는 manual을 반환한다', async () => {
    await setTrackingMode('manual')
    await expect(getTrackingMode()).resolves.toBe('manual')
  })

  it('manual에서 auto로 되돌릴 수 있다', async () => {
    await setTrackingMode('manual')
    await setTrackingMode('auto')
    await expect(getTrackingMode()).resolves.toBe('auto')
  })
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
