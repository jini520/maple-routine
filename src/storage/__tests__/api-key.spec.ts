import { installFakePreferences } from './fake-preferences'
import {
  clearNexonLogin,
  getAuthConfig,
  removeAllApiKeys,
  removeApiKey,
  setMainApiKey,
  setNexonLogin,
  signOutAuth,
} from '../api-key'
import type { NexonApiKeyMethod, NexonAuthConfig } from '../../types'
import { STORAGE_KEYS } from '../keys'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

/** 교환이 돌려주는 한 벌. */
function 로그인(session: string) {
  return { session }
}

/** 저장된 수단을 그대로 적는다. 저장 함수로 만들 수 없는 상태(옛 로그인의 부계정 키)를 세울 때 쓴다. */
async function 저장(config: NexonAuthConfig): Promise<void> {
  await prefs.set(STORAGE_KEYS.authMethods, JSON.stringify(config))
}

function 키(id: string, loginId: string | null): NexonApiKeyMethod {
  return { type: 'key', id, label: '', value: `값-${id}`, loginId }
}

describe('저장된 값이 없는 경우', () => {
  it('아무 것도 저장하지 않았으면 getAuthConfig는 null을 반환한다', async () => {
    await expect(getAuthConfig()).resolves.toBeNull()
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setMainApiKey도 에러를 그대로 전파한다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setMainApiKey('test-api-key')).rejects.toThrow('disk full')
  })
})

// 로그인 화면에서 넣은 키는 메인 키다. 로그인 화면의 로그인은 새 로그인이라 앞 메인 수단을 버린다.
describe('setMainApiKey: 로그인 화면의 키 로그인', () => {
  it('넣은 키가 귀속 없는 메인 키가 된다. 이름을 안 주면 비어 있다', async () => {
    await setMainApiKey('키-가')

    const config = await getAuthConfig()
    expect(config?.apiKeys).toEqual([{ type: 'key', id: expect.any(String), label: '', value: '키-가', loginId: null }])
    expect(config?.mainKeyId).toBe(config?.apiKeys[0]?.id)
    expect(config?.login).toBeNull()
  })

  it('같은 값을 다시 넣으면 늘지 않고 이름만 갱신된다. id 는 그대로다', async () => {
    await setMainApiKey('키-가', '본계정')
    const before = await getAuthConfig()

    await setMainApiKey('키-가', '고친 이름')

    const config = await getAuthConfig()
    expect(config?.apiKeys).toEqual([{ type: 'key', id: before?.apiKeys[0]?.id, label: '고친 이름', value: '키-가', loginId: null }])
  })

  it('새 키에 계정 id 를 넘기면 그 id 를 쓴다. 다시 받은 키가 옛 계정을 잇는 길이다', async () => {
    await setMainApiKey('다시-받은-키', '', 'account-old')

    expect((await getAuthConfig())?.mainKeyId).toBe('account-old')
  })

  // 온보딩 중에 로그인 화면으로 돌아가 다른 키로 들어오면, 앞 키가 남아 계속 메인이면 새 키의 캐릭터를 앞 키로 부른다.
  it('앞 메인 키는 지우고, 남아 있던 넥슨 로그인은 뗀다. 부계정 키는 귀속된 채 남는다', async () => {
    await 저장({
      login: { type: 'login', id: 'account-로그인', session: '세션' },
      apiKeys: [키('account-부', 'account-로그인'), 키('account-앞-메인', null)],
      mainKeyId: null,
    })

    await setMainApiKey('새-키', '', 'account-새')

    const config = await getAuthConfig()
    expect(config?.login).toBeNull()
    expect(config?.apiKeys.map((one) => [one.id, one.loginId])).toEqual([
      ['account-부', 'account-로그인'],
      ['account-새', null],
    ])
    expect(config?.mainKeyId).toBe('account-새')
  })

  // 로그아웃 뒤 앞 로그인의 부계정 키로 들어온 경우다. 귀속을 지우면 그 넥슨 ID 로 다시 로그인해도 이어지지 않는다.
  it('앞 로그인의 부계정 키를 넣으면 귀속을 든 채 메인 키가 된다', async () => {
    await 저장({ login: null, apiKeys: [키('account-부', 'account-로그인')], mainKeyId: null })

    await setMainApiKey('값-account-부', '이름')

    const config = await getAuthConfig()
    expect(config?.apiKeys).toEqual([{ ...키('account-부', 'account-로그인'), label: '이름' }])
    expect(config?.mainKeyId).toBe('account-부')
  })
})

// 옛 설치본에는 `apiKey` 칸에 문자열 하나가 들어 있다. 그 사용자가 키를 다시 넣게 하면 안 된다.
describe('옛 설치본의 키를 이어받는다', () => {
  it('새 칸이 비어 있으면 옛 apiKey 칸을 읽어 메인 키로 올린다', async () => {
    await prefs.set(STORAGE_KEYS.apiKey, '옛키')

    const config = await getAuthConfig()
    expect(config?.apiKeys).toEqual([{ type: 'key', id: expect.any(String), label: '', value: '옛키', loginId: null }])
    expect(config?.mainKeyId).toBe(config?.apiKeys[0]?.id)
  })

  it('옛 칸을 지우지 않는다. 구버전으로 되돌아가도 키를 잃지 않아야 한다', async () => {
    await prefs.set(STORAGE_KEYS.apiKey, '옛키')

    await getAuthConfig()

    await expect(prefs.get(STORAGE_KEYS.apiKey)).resolves.toBe('옛키')
  })

  it('새 칸이 있으면 옛 칸은 안 본다', async () => {
    await prefs.set(
      STORAGE_KEYS.authMethods,
      JSON.stringify({ login: null, apiKeys: [{ kind: 'apiKey', label: '이름', value: '새키' }] }),
    )
    await prefs.set(STORAGE_KEYS.apiKey, '옛키')

    const config = await getAuthConfig()
    expect(config?.apiKeys).toEqual([{ type: 'key', id: expect.any(String), label: '이름', value: '새키', loginId: null }])
  })

  it('새 칸이 깨져 있으면 옛 칸으로 물러난다', async () => {
    // 저장이 중간에 끊겼거나 손으로 고쳐졌을 수 있다. 그때 키를 통째로 잃으면 안 된다.
    await prefs.set(STORAGE_KEYS.authMethods, '{망가진 json')
    await prefs.set(STORAGE_KEYS.apiKey, '옛키')

    expect((await getAuthConfig())?.apiKeys).toEqual([{ type: 'key', id: expect.any(String), label: '', value: '옛키', loginId: null }])
  })
})

// 지우는 범위가 갈린다. 키 하나의 실패로 다른 넥슨 계정의 키까지 지우면 안 된다.
describe('무효화된 키 하나만 지운다', () => {
  it('그 값의 키만 빠지고 나머지는 남는다', async () => {
    await 저장({
      login: { type: 'login', id: 'account-로그인', session: '세션' },
      apiKeys: [키('account-죽은', 'account-로그인'), 키('account-산', 'account-로그인')],
      mainKeyId: null,
    })

    await removeApiKey('값-account-죽은')

    expect((await getAuthConfig())?.apiKeys).toEqual([키('account-산', 'account-로그인')])
  })

  it('메인 키를 지우면 메인 표시도 지운다. 마지막 키면 getAuthConfig 가 null 이다', async () => {
    await setMainApiKey('하나뿐인키')

    await removeApiKey('하나뿐인키')

    await expect(getAuthConfig()).resolves.toBeNull()
  })

  it('없는 값을 지우라고 해도 남은 키를 안 건드린다', async () => {
    await setMainApiKey('산키', '본계정')

    await removeApiKey('모르는키')

    expect((await getAuthConfig())?.apiKeys).toHaveLength(1)
  })

  it('키를 전부 지워도 로그인은 남는다', async () => {
    await 저장({
      login: { type: 'login', id: 'account-로그인', session: '세션' },
      apiKeys: [키('account-부', 'account-로그인')],
      mainKeyId: null,
    })

    await removeAllApiKeys()

    expect(await getAuthConfig()).toEqual({
      login: { type: 'login', id: 'account-로그인', session: '세션' },
      apiKeys: [],
      mainKeyId: null,
    })
  })
})

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

// 로그인은 0~1개다. 앱 사용자를 식별하는 축이고 키는 거기 붙는 자원이라 둘 이상일 이유가 없다.
describe('넥슨 로그인 자리', () => {
  it('로그인만 있어도 수단이 있는 것이다', async () => {
    await setNexonLogin(로그인('세션-가'))

    const config = await getAuthConfig()
    expect(config?.login).toEqual({ type: 'login', id: expect.any(String), session: '세션-가' })
    expect(config?.apiKeys).toEqual([])
  })

  it('다시 로그인하면 갈아끼운다. 늘지 않고 id 는 그대로다', async () => {
    await setNexonLogin(로그인('세션-가'))
    const before = await getAuthConfig()

    await setNexonLogin(로그인('세션-나'))

    expect((await getAuthConfig())?.login).toEqual({ type: 'login', id: before?.login?.id, session: '세션-나' })
  })

  // 로그인과 그 키는 같은 넥슨 계정이다. 새 id 를 받으면 키 시절 기기 기록이 주인 없는 id 에 남는다.
  it('거둘 키를 넘기면 그 키들이 빠지고 로그인은 첫 키의 id 를 이어받는다', async () => {
    await 저장({
      login: null,
      apiKeys: [키('account-가', null), 키('account-나', null), 키('account-다', 'account-다른-로그인')],
      mainKeyId: 'account-가',
    })

    await setNexonLogin(로그인('세션-가'), ['값-account-나', '값-account-가'])

    const config = await getAuthConfig()
    expect(config?.login).toEqual({ type: 'login', id: 'account-가', session: '세션-가' })
    expect(config?.apiKeys.map((one) => one.id)).toEqual(['account-다'])
  })

  it('이미 로그인이 있어도 거둔 키의 id 로 바뀐다', async () => {
    await 저장({
      login: { type: 'login', id: 'account-로그인', session: '세션' },
      apiKeys: [키('account-가', 'account-로그인')],
      mainKeyId: null,
    })

    await setNexonLogin(로그인('세션-가'), ['값-account-가'])

    expect((await getAuthConfig())?.login?.id).toBe('account-가')
  })

  // today 의 `넥슨 ID 연동하기` 는 새 로그인이 아니다. 키로 앱을 쓰던 사람이 로그인을 붙이는 것이다.
  it('연동하면 메인 키는 지우지 않고 그 로그인의 부계정이 된다. 앞 로그인의 부계정 키였어도 귀속을 옮긴다', async () => {
    await 저장({
      login: null,
      apiKeys: [키('account-메인', 'account-앞-로그인'), 키('account-숨은', 'account-앞-로그인')],
      mainKeyId: 'account-메인',
    })

    await setNexonLogin(로그인('세션'), [], 'account-새-로그인')

    const config = await getAuthConfig()
    expect(config?.apiKeys.map((one) => [one.id, one.loginId])).toEqual([
      ['account-메인', 'account-새-로그인'],
      ['account-숨은', 'account-앞-로그인'],
    ])
    expect(config?.mainKeyId).toBeNull()
  })

  // 로그인 화면의 로그인은 새 로그인이다. 앞 메인 키를 남기면 다른 사람의 계정이 부계정으로 붙는다.
  it('로그인 화면의 로그인은 귀속 없는 키를 지우고, 다른 로그인의 부계정 키는 귀속된 채 둔다', async () => {
    await 저장({
      login: null,
      apiKeys: [키('account-앞-메인', null), 키('account-부', 'account-앞-로그인')],
      mainKeyId: 'account-앞-메인',
    })

    await setNexonLogin(로그인('세션'), [], 'account-새-로그인', { fresh: true })

    const config = await getAuthConfig()
    expect(config?.apiKeys).toEqual([키('account-부', 'account-앞-로그인')])
    expect(config?.mainKeyId).toBeNull()
  })
})

// 부계정 키는 등록한 넥슨 로그인에 귀속된다. 만료 · 로그아웃 뒤에도 남고, 같은 넥슨 ID 로 돌아오면 이어진다.
describe('부계정 키의 귀속', () => {
  const 로그인과부계정: NexonAuthConfig = {
    login: { type: 'login', id: 'account-로그인', session: '세션' },
    apiKeys: [키('account-부', 'account-로그인')],
    mainKeyId: null,
  }

  it('로그인이 만료돼 떼면 부계정 키는 귀속된 채 남는다', async () => {
    await 저장(로그인과부계정)

    await clearNexonLogin()

    expect(await getAuthConfig()).toEqual({ login: null, apiKeys: [키('account-부', 'account-로그인')], mainKeyId: null })
  })

  it('로그인만 있던 사용자는 떼고 나면 수단이 없다', async () => {
    await setNexonLogin(로그인('세션-가'))

    await clearNexonLogin()

    await expect(getAuthConfig()).resolves.toBeNull()
  })

  it('로그아웃하면 로그인과 메인 키를 지우고, 부계정 키는 귀속된 채 남긴다', async () => {
    await 저장(로그인과부계정)

    await signOutAuth()

    expect(await getAuthConfig()).toEqual({ login: null, apiKeys: [키('account-부', 'account-로그인')], mainKeyId: null })
  })

  it('앞 로그인의 부계정 키를 메인으로 쓰다 로그아웃하면 메인 표시만 지운다', async () => {
    await 저장({ login: null, apiKeys: [키('account-부', 'account-로그인'), 키('account-메인', null)], mainKeyId: 'account-부' })

    await signOutAuth()

    expect(await getAuthConfig()).toEqual({ login: null, apiKeys: [키('account-부', 'account-로그인')], mainKeyId: null })
  })

  it('로그아웃은 남길 부계정 키가 없으면 목록을 통째로 지우고, 옛 칸까지 치운다', async () => {
    await setMainApiKey('메인-키')
    await prefs.set(STORAGE_KEYS.apiKey, '옛키')
    await prefs.set(STORAGE_KEYS.legacySelectedAccountId, 'account-1')

    await signOutAuth()

    await expect(getAuthConfig()).resolves.toBeNull()
    await expect(prefs.get(STORAGE_KEYS.authMethods)).resolves.toBeNull()
    await expect(prefs.get(STORAGE_KEYS.apiKey)).resolves.toBeNull()
    await expect(prefs.get(STORAGE_KEYS.legacySelectedAccountId)).resolves.toBeNull()
  })

  it('같은 계정 id 로 다시 로그인하면 앞 로그인의 부계정 키가 그대로 이 로그인의 부계정이다', async () => {
    await 저장(로그인과부계정)
    await signOutAuth()

    await setNexonLogin(로그인('세션-나'), [], 'account-로그인', { fresh: true })

    expect((await getAuthConfig())?.apiKeys).toEqual([키('account-부', 'account-로그인')])
  })

  it('다른 계정 id 로 로그인하면 앞 로그인의 부계정 키는 귀속을 옮기지 않는다', async () => {
    await 저장(로그인과부계정)
    await signOutAuth()

    await setNexonLogin(로그인('세션-나'), [], 'account-다른-로그인', { fresh: true })

    expect((await getAuthConfig())?.apiKeys).toEqual([키('account-부', 'account-로그인')])
  })
})

// 계정을 가리키는 것은 키 값이 아니라 수단의 id 다. 키를 다시 받아도 같은 계정이면 기록이 이어져야 한다.
describe('옛 모양을 읽는다', () => {
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
      apiKeys: [{ type: 'key', id: first?.apiKeys[0]?.id, label: '부', value: '키', loginId: first?.login?.id }],
      mainKeyId: null,
    })
  })

  // 두 칸이 생기기 전에는 로그인과 함께 남은 키가 로그인이 거두지 않은 다른 넥슨 계정의 키였고, 로그인이 없으면 첫 키가 메인이었다.
  it('귀속 · 메인 칸이 없으면 로그인이 있을 때 키는 그 로그인의 부계정, 없을 때 첫 키가 메인 키다', async () => {
    await prefs.set(
      STORAGE_KEYS.authMethods,
      JSON.stringify({
        login: { type: 'login', id: 'account-로그인', session: '세션' },
        apiKeys: [{ type: 'key', id: 'account-부', label: '', value: '부-키' }],
      }),
    )
    expect(await getAuthConfig()).toEqual({
      login: { type: 'login', id: 'account-로그인', session: '세션' },
      apiKeys: [{ type: 'key', id: 'account-부', label: '', value: '부-키', loginId: 'account-로그인' }],
      mainKeyId: null,
    })
    expect(JSON.parse((await prefs.get(STORAGE_KEYS.authMethods)) ?? '{}').mainKeyId).toBeNull()

    await prefs.set(
      STORAGE_KEYS.authMethods,
      JSON.stringify({
        login: null,
        apiKeys: [
          { type: 'key', id: 'account-가', label: '', value: '가' },
          { type: 'key', id: 'account-나', label: '', value: '나' },
        ],
      }),
    )
    const config = await getAuthConfig()
    expect(config?.apiKeys.map((one) => one.loginId)).toEqual([null, null])
    expect(config?.mainKeyId).toBe('account-가')
  })
})
