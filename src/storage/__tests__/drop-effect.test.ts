import { beforeEach, describe, expect, it } from 'vitest'
import { installFakePreferences } from './fake-preferences'
import { getDropEffectEnabled, setDropEffectEnabled } from '../drop-effect'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('dropEffect')
})

describe('drop-effect 저장', () => {
  it('저장된 값이 없으면 기본은 연출 표시(true)', async () => {
    await expect(getDropEffectEnabled()).resolves.toBe(true)
  })

  it('false 저장 후에는 false를 읽는다', async () => {
    await setDropEffectEnabled(false)
    await expect(getDropEffectEnabled()).resolves.toBe(false)
  })

  it('다시 true로 되돌리면 true를 읽는다', async () => {
    await setDropEffectEnabled(false)
    await setDropEffectEnabled(true)
    await expect(getDropEffectEnabled()).resolves.toBe(true)
  })

  it('Preferences.set이 reject되면 에러를 그대로 전파한다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setDropEffectEnabled(false)).rejects.toThrow('disk full')
  })
})
