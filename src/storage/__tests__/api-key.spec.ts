import { installFakePreferences } from './fake-preferences'
import {
  clearAuthConfig,
  clearNexonLogin,
  getAuthConfig,
  removeApiKey,
  setApiKey,
  setNexonLogin,
} from '../api-key'
import { STORAGE_KEYS } from '../keys'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await clearAuthConfig()
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
      { type: 'key', id: expect.any(String), label: '본계정', value: '키-가' },
      { type: 'key', id: expect.any(String), label: '부계정', value: '키-나' },
    ])
  })

  it('같은 값을 다시 넣으면 늘지 않고 이름만 갱신된다', async () => {
    // 키 재입력 경로에서 같은 키를 다시 넣는 일이 흔하다. 늘어나면 목록이 지저분해진다.
    await setApiKey('키-가', '본계정')
    await setApiKey('키-가', '고친 이름')

    const config = await getAuthConfig()
    expect(config?.apiKeys).toEqual([{ type: 'key', id: expect.any(String), label: '고친 이름', value: '키-가' }])
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
    expect(config?.apiKeys).toEqual([{ type: 'key', id: expect.any(String), label: '', value: '옛키' }])
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
    expect(config?.apiKeys).toEqual([{ type: 'key', id: expect.any(String), label: '이름', value: '새키' }])
  })

  it('새 칸이 깨져 있으면 옛 칸으로 물러난다', async () => {
    // 저장이 중간에 끊겼거나 손으로 고쳐졌을 수 있다. 그때 키를 통째로 잃으면 안 된다.
    await prefs.set(STORAGE_KEYS.authMethods, '{망가진 json')
    await prefs.set(STORAGE_KEYS.apiKey, '옛키')

    expect((await getAuthConfig())?.apiKeys).toEqual([{ type: 'key', id: expect.any(String), label: '', value: '옛키' }])
  })
})

// 지우는 범위가 둘로 갈린다. 앞을 뒤로 갈아끼우면 다른 넥슨 계정의 키까지 사라진다.
describe('무효화된 키 하나만 지운다', () => {
  it('그 값의 키만 빠지고 나머지는 남는다', async () => {
    await setApiKey('죽은키', '본계정')
    await setApiKey('산키', '부계정')

    await removeApiKey('죽은키')

    expect((await getAuthConfig())?.apiKeys).toEqual([
      { type: 'key', id: expect.any(String), label: '부계정', value: '산키' },
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

// 로그인은 0~1개다. 앱 사용자를 식별하는 축이고 키는 거기 붙는 자원이라 둘 이상일 이유가 없다.
/** 교환이 돌려주는 한 벌. 세션과 액세스 토큰을 함께 적는다. */
function 로그인(session: string) {
  return { session }
}

describe('옛 설치본의 로그인 칸', () => {
  it('액세스 토큰 칸이 남아 있어도 세션만 읽는다', async () => {
    await prefs.set(
      STORAGE_KEYS.authMethods,
      JSON.stringify({
        login: { kind: 'login', session: '옛세션', accessToken: '옛토큰', accessExpiresAt: '2026-09-27T12:30:00.000Z' },
        apiKeys: [],
      }),
    )

    expect((await getAuthConfig())?.login).toEqual({ type: 'login', id: expect.any(String), session: '옛세션' })
  })

  it('세션이 없는 로그인 칸은 없는 것이다', async () => {
    await prefs.set(STORAGE_KEYS.authMethods, JSON.stringify({ login: { kind: 'login' }, apiKeys: [] }))

    expect(await getAuthConfig()).toBeNull()
  })
})

describe('넥슨 로그인 자리', () => {
  it('로그인만 있어도 수단이 있는 것이다', async () => {
    await setNexonLogin(로그인('세션-가'))

    const config = await getAuthConfig()
    expect(config?.login).toEqual({ type: 'login', id: expect.any(String), session: '세션-가' })
    expect(config?.apiKeys).toEqual([])
  })

  it('다시 로그인하면 갈아끼운다. 늘지 않는다', async () => {
    await setNexonLogin(로그인('세션-가'))
    await setNexonLogin(로그인('세션-나'))

    expect((await getAuthConfig())?.login).toMatchObject({ type: 'login', id: expect.any(String), session: '세션-나' })
  })

  it('로그인을 붙여도 키는 안 건드린다', async () => {
    // 같은 계정인지 대조해 키를 지우는 일은 따로다(#541).
    await setApiKey('키-가', '본계정')

    await setNexonLogin(로그인('세션-가'))

    expect((await getAuthConfig())?.apiKeys).toEqual([
      { type: 'key', id: expect.any(String), label: '본계정', value: '키-가' },
    ])
  })

  it('키를 더해도 로그인은 남는다', async () => {
    await setNexonLogin(로그인('세션-가'))

    await setApiKey('키-가')

    expect((await getAuthConfig())?.login).toMatchObject({ type: 'login', id: expect.any(String), session: '세션-가' })
  })

  it('로그인을 떼면 키는 남는다', async () => {
    await setNexonLogin(로그인('세션-가'))
    await setApiKey('키-가')

    await clearNexonLogin()

    const config = await getAuthConfig()
    expect(config?.login).toBeNull()
    expect(config?.apiKeys).toHaveLength(1)
  })

  it('로그인만 있던 사용자는 떼고 나면 수단이 없다', async () => {
    await setNexonLogin(로그인('세션-가'))

    await clearNexonLogin()

    await expect(getAuthConfig()).resolves.toBeNull()
  })

  it('키를 전부 지워도 로그인은 남는다', async () => {
    // 키 무효화가 로그인까지 끊으면 안 된다. 둘은 다른 수단이다.
    await setNexonLogin(로그인('세션-가'))
    await setApiKey('키-가')

    await removeApiKey('키-가')

    expect((await getAuthConfig())?.login).toMatchObject({ type: 'login', id: expect.any(String), session: '세션-가' })
  })

  it('연결 해제는 로그인까지 버린다', async () => {
    await setNexonLogin(로그인('세션-가'))

    await clearAuthConfig()

    await expect(getAuthConfig()).resolves.toBeNull()
  })
})

// 액세스 토큰은 30분이라 세션보다 훨씬 자주 바뀐다. 그때 세션까지 다시 쓰면 갈아끼우는 값이
// 둘이 되고, 한쪽만 써지는 순간이 생긴다.
// 계정을 가리키는 것은 키 값이 아니라 수단의 id 다. 키를 다시 받아도 같은 계정이면 기록이 이어져야 한다.
describe('넥슨 계정 id', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it('id 가 없는 옛 수단은 읽을 때 id 를 받고 type 으로 옮겨 다시 저장된다. 두 번째 읽기는 같은 id 다', async () => {
    await prefs.set(
      STORAGE_KEYS.authMethods,
      JSON.stringify({ login: { kind: 'login', session: '세션' }, apiKeys: [{ kind: 'apiKey', label: '부', value: '키' }] }),
    )

    const first = await getAuthConfig()
    const second = await getAuthConfig()

    expect(first?.login?.id).toMatch(UUID)
    expect(first?.apiKeys[0]?.id).toMatch(UUID)
    expect(first?.login?.id).not.toBe(first?.apiKeys[0]?.id)
    expect(second).toEqual(first)
    expect(JSON.parse((await prefs.get(STORAGE_KEYS.authMethods)) ?? '{}')).toEqual({
      login: { type: 'login', id: first?.login?.id, session: '세션' },
      apiKeys: [{ type: 'key', id: first?.apiKeys[0]?.id, label: '부', value: '키' }],
    })
  })

  it('옛 apiKey 칸에서 올린 키도 id 를 받아 새 칸에 적힌다. 옛 칸은 남는다', async () => {
    await prefs.set(STORAGE_KEYS.apiKey, '옛키')

    const first = await getAuthConfig()

    expect((await getAuthConfig())?.apiKeys[0]?.id).toBe(first?.apiKeys[0]?.id)
    await expect(prefs.get(STORAGE_KEYS.apiKey)).resolves.toBe('옛키')
  })

  it('같은 키를 다시 넣거나 다시 로그인해도 id 는 그대로다', async () => {
    await setApiKey('키-가', '본계정')
    await setNexonLogin(로그인('세션-가'))
    const before = await getAuthConfig()

    await setApiKey('키-가', '고친 이름')
    await setNexonLogin(로그인('세션-나'))
    const after = await getAuthConfig()

    expect(after?.apiKeys[0]?.id).toBe(before?.apiKeys[0]?.id)
    expect(after?.login?.id).toBe(before?.login?.id)
  })

  it('새 키에 계정 id 를 넘기면 그 id 를 쓴다. 다시 받은 키가 옛 계정을 잇는 길이다', async () => {
    await setApiKey('다시-받은-키', '', 'account-old')

    expect((await getAuthConfig())?.apiKeys[0]).toEqual({ type: 'key', id: 'account-old', label: '', value: '다시-받은-키' })
  })
})
