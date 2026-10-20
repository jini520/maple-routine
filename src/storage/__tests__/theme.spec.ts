import { installFakePreferences } from './fake-preferences'
import { getTheme } from '../theme'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('theme')
})

describe('손상되거나 알 수 없는 값', () => {
  it('레테/렌이 아닌 임의의 문자열이 저장되어 있으면 null을 반환한다', async () => {
    await prefs.set('theme', 'not-a-theme')
    await expect(getTheme()).resolves.toBeNull()
  })
})
