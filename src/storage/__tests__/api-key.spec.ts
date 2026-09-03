import { installFakePreferences } from './fake-preferences'
import { clearAuthConfig, getAuthConfig, removeApiKey, setApiKey } from '../api-key'
import { STORAGE_KEYS } from '../keys'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await clearAuthConfig()
})

describe('round-trip', () => {
  it('setApiKey 후 getAuthConfig로 저장한 apiKey를 그대로 읽는다', async () => {
    await setApiKey('test-api-key')
    await expect(getAuthConfig()).resolves.toEqual({ apiKey: 'test-api-key' })
  })
})

describe('저장된 값이 없는 경우', () => {
  it('아무 것도 저장하지 않았으면 getAuthConfig는 null을 반환한다', async () => {
    await expect(getAuthConfig()).resolves.toBeNull()
  })

  it('clearAuthConfig 이후에는 getAuthConfig가 null을 반환한다', async () => {
    await setApiKey('test-api-key')
    await clearAuthConfig()
    await expect(getAuthConfig()).resolves.toBeNull()
  })
})

// 키 무효화(400 OPENAPI00005· 401/403)는 apiKey 하나만 지운다.
describe('removeApiKey', () => {
  it('apiKey를 제거한다', async () => {
    await setApiKey('test-api-key')

    await removeApiKey()

    expect(prefs.remove).toHaveBeenCalledWith(STORAGE_KEYS.apiKey)
    await expect(prefs.get(STORAGE_KEYS.apiKey)).resolves.toBeNull()
  })

  it('그 뒤 getAuthConfig는 null을 반환한다', async () => {
    await setApiKey('test-api-key')

    await removeApiKey()

    await expect(getAuthConfig()).resolves.toBeNull()
  })
})

// 로 계정 선택이 사라진 뒤 남은 레거시 키. 아무도 읽고 쓰지 않지만, 캐패시터
// 시절을 거친 설치본에는 값이 남아 있어 연결 해제가 함께 치운다.
describe('레거시 selectedAccountId', () => {
  it('clearAuthConfig 가 레거시 키까지 지운다', async () => {
    await prefs.set(STORAGE_KEYS.legacySelectedAccountId, 'account-1')

    await clearAuthConfig()

    await expect(prefs.get(STORAGE_KEYS.legacySelectedAccountId)).resolves.toBeNull()
  })

  it('removeApiKey 는 레거시 키를 건드리지 않는다. 지우는 범위가 다르다', async () => {
    await setApiKey('test-api-key')
    await prefs.set(STORAGE_KEYS.legacySelectedAccountId, 'account-1')

    await removeApiKey()

    await expect(prefs.get(STORAGE_KEYS.legacySelectedAccountId)).resolves.toBe('account-1')
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setApiKey도 에러를 그대로 전파한다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setApiKey('test-api-key')).rejects.toThrow('disk full')
  })
})
