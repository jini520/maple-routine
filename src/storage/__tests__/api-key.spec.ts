import { installFakePreferences } from './fake-preferences'
import { clearAuthConfig, getAuthConfig, removeApiKey, setApiKey } from '../api-key'
import { STORAGE_KEYS } from '../keys'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await clearAuthConfig()
})

describe('round-trip', () => {
  it('setApiKey 후 getAuthConfig로 저장한 키를 그대로 읽는다', async () => {
    await setApiKey('test-api-key')
    await expect(getAuthConfig()).resolves.toEqual({
      login: null,
      apiKeys: [{ kind: 'apiKey', label: '', value: 'test-api-key' }],
    })
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

// 키 무효화(400 OPENAPI00005 · 401/403)는 그 키 하나만 지운다.
describe('removeApiKey', () => {
  it('그 뒤 getAuthConfig는 null을 반환한다', async () => {
    await setApiKey('test-api-key')

    await removeApiKey('test-api-key')

    await expect(getAuthConfig()).resolves.toBeNull()
  })
})

// 계정 선택이 사라진 뒤 남은 레거시 키. 아무도 읽고 쓰지 않지만, 그 시절을 거친 설치본에는
// 값이 남아 있어 연결 해제가 함께 치운다.
describe('레거시 selectedAccountId', () => {
  it('clearAuthConfig 가 레거시 키까지 지운다', async () => {
    await prefs.set(STORAGE_KEYS.legacySelectedAccountId, 'account-1')

    await clearAuthConfig()

    await expect(prefs.get(STORAGE_KEYS.legacySelectedAccountId)).resolves.toBeNull()
  })

  it('removeApiKey 는 레거시 키를 건드리지 않는다. 지우는 범위가 다르다', async () => {
    await setApiKey('test-api-key')
    await prefs.set(STORAGE_KEYS.legacySelectedAccountId, 'account-1')

    await removeApiKey('test-api-key')

    await expect(prefs.get(STORAGE_KEYS.legacySelectedAccountId)).resolves.toBe('account-1')
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setApiKey도 에러를 그대로 전파한다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setApiKey('test-api-key')).rejects.toThrow('disk full')
  })
})

// 저장하는 것이 키 하나가 아니라 인증 수단의 목록이 됐다(#536). 넥슨 로그인 0~1개와 이름
// 붙은 API 키 0개 이상이다. 키마다 이름이 붙는 것은 값이 비슷하게 생겨 목록에서 구분이
// 안 되기 때문이다.
describe('인증 수단 목록', () => {
  it('키를 여럿 넣으면 순서대로 목록에 쌓인다', async () => {
    await setApiKey('키-가', '본계정')
    await setApiKey('키-나', '부계정')

    const config = await getAuthConfig()
    expect(config?.apiKeys).toEqual([
      { kind: 'apiKey', label: '본계정', value: '키-가' },
      { kind: 'apiKey', label: '부계정', value: '키-나' },
    ])
  })

  it('같은 값을 다시 넣으면 늘지 않고 이름만 갱신된다', async () => {
    // 키 재입력 경로에서 같은 키를 다시 넣는 일이 흔하다. 늘어나면 목록이 지저분해진다.
    await setApiKey('키-가', '본계정')
    await setApiKey('키-가', '고친 이름')

    const config = await getAuthConfig()
    expect(config?.apiKeys).toEqual([{ kind: 'apiKey', label: '고친 이름', value: '키-가' }])
  })

  it('이름을 안 주면 비어 있다. 짓지 않는다', async () => {
    // 우리가 지어낸 이름이 사용자가 붙인 것처럼 보이면 안 된다.
    await setApiKey('키-가')
    expect((await getAuthConfig())?.apiKeys[0]?.label).toBe('')
  })

  it('로그인 자리는 아직 비어 있다', async () => {
    // 자리는 지금 만들되 채우는 것은 로그인 흐름(#539)이다.
    await setApiKey('키-가')
    expect((await getAuthConfig())?.login).toBeNull()
  })

  it('수단이 하나도 없으면 null 이다', async () => {
    await expect(getAuthConfig()).resolves.toBeNull()
  })
})

// 옛 설치본에는 `apiKey` 칸에 문자열 하나가 들어 있다. 그 사용자가 키를 다시 넣게 하면 안 된다.
describe('옛 설치본의 키를 이어받는다', () => {
  it('새 칸이 비어 있으면 옛 apiKey 칸을 읽어 목록으로 올린다', async () => {
    await prefs.set(STORAGE_KEYS.apiKey, '옛키')

    const config = await getAuthConfig()
    expect(config?.apiKeys).toEqual([{ kind: 'apiKey', label: '', value: '옛키' }])
  })

  it('옛 칸을 지우지 않는다. 구버전으로 되돌아가도 키를 잃지 않아야 한다', async () => {
    await prefs.set(STORAGE_KEYS.apiKey, '옛키')

    await getAuthConfig()

    await expect(prefs.get(STORAGE_KEYS.apiKey)).resolves.toBe('옛키')
  })

  it('새 칸이 있으면 옛 칸은 안 본다', async () => {
    // setApiKey 가 옛 칸을 먼저 올려 목록에 담으므로, 새 칸만 둔 상태를 직접 만든다.
    await prefs.set(
      STORAGE_KEYS.authMethods,
      JSON.stringify({ login: null, apiKeys: [{ kind: 'apiKey', label: '이름', value: '새키' }] }),
    )
    await prefs.set(STORAGE_KEYS.apiKey, '옛키')

    const config = await getAuthConfig()
    expect(config?.apiKeys).toEqual([{ kind: 'apiKey', label: '이름', value: '새키' }])
  })

  it('새 칸이 깨져 있으면 옛 칸으로 물러난다', async () => {
    // 저장이 중간에 끊겼거나 손으로 고쳐졌을 수 있다. 그때 키를 통째로 잃으면 안 된다.
    await prefs.set(STORAGE_KEYS.authMethods, '{망가진 json')
    await prefs.set(STORAGE_KEYS.apiKey, '옛키')

    expect((await getAuthConfig())?.apiKeys).toEqual([{ kind: 'apiKey', label: '', value: '옛키' }])
  })
})

// 지우는 범위가 둘로 갈린다. 앞을 뒤로 갈아끼우면 다른 넥슨 계정의 키까지 사라진다.
describe('무효화된 키 하나만 지운다', () => {
  it('그 값의 키만 빠지고 나머지는 남는다', async () => {
    await setApiKey('죽은키', '본계정')
    await setApiKey('산키', '부계정')

    await removeApiKey('죽은키')

    expect((await getAuthConfig())?.apiKeys).toEqual([
      { kind: 'apiKey', label: '부계정', value: '산키' },
    ])
  })

  it('마지막 키를 지우면 getAuthConfig 가 null 이다', async () => {
    await setApiKey('하나뿐인키')

    await removeApiKey('하나뿐인키')

    await expect(getAuthConfig()).resolves.toBeNull()
  })

  it('없는 값을 지우라고 해도 남은 키를 안 건드린다', async () => {
    await setApiKey('산키', '본계정')

    await removeApiKey('모르는키')

    expect((await getAuthConfig())?.apiKeys).toHaveLength(1)
  })

  it('연결 해제는 목록을 통째로 버린다', async () => {
    await setApiKey('키-가')
    await setApiKey('키-나')

    await clearAuthConfig()

    await expect(getAuthConfig()).resolves.toBeNull()
  })

  it('연결 해제는 옛 칸까지 치운다. 그래야 다시 안 올라온다', async () => {
    await prefs.set(STORAGE_KEYS.apiKey, '옛키')

    await clearAuthConfig()

    await expect(prefs.get(STORAGE_KEYS.apiKey)).resolves.toBeNull()
  })
})
