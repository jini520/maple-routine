import { installFakePreferences } from './fake-preferences'
import { getTheme, setTheme } from '../theme'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('theme')
})

describe('저장된 값이 없는 경우', () => {
  it('저장 전 getTheme()은 null을 반환한다', async () => {
    await expect(getTheme()).resolves.toBeNull()
  })
})

describe('round-trip', () => {
  it('setTheme(레테) 후 getTheme()은 레테를 반환한다', async () => {
    await setTheme('레테')
    await expect(getTheme()).resolves.toBe('레테')
  })
})

describe('손상되거나 알 수 없는 값', () => {
  it('레테/렌이 아닌 임의의 문자열이 저장되어 있으면 null을 반환한다', async () => {
    await prefs.set('theme', 'not-a-theme')
    await expect(getTheme()).resolves.toBeNull()
  })
})
