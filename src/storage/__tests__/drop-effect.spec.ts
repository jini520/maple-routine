import { installFakePreferences } from './fake-preferences'
import { setDropEffectEnabled } from '../drop-effect'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('dropEffect')
})

describe('drop-effect 저장', () => {
  it('Preferences.set이 reject되면 에러를 그대로 전파한다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setDropEffectEnabled(false)).rejects.toThrow('disk full')
  })
})
