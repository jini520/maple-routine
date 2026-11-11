// 계정 관리 목록의 값. 앱은 서버가 지금 로그인에 준 부계정만 보이고, 서버는 메이플 ID 를 해시로만 준다. 기기가 본 메이플 ID 만
// 이름이 서고, 본 적 없는 메이플 ID 를 지어내지 않는다.
import { apiKeyHashHex } from '../../../lib/crypto/api-key-hash'
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import { storedApiKeyHashHex } from '../../../lib/sub-account-keys'
import type { MapleAccount, NexonApiKeyMethod, NexonAuthConfig } from '../../../types'
import { buildAccountManageView, type AccountManageSources } from '../accounts'

const h = nexonIdHashHex

function 캐릭터(name: string, level: number) {
  return { ocid: `o-${name}`, name, world: '스카니아', worldKey: 'scania', jobClass: '히어로', level }
}

function 메이플ID(accountId: string, ...characters: ReturnType<typeof 캐릭터>[]): MapleAccount {
  return { accountId, characters }
}

function 키(id: string, value: string, loginId: string | null = 'login-1'): NexonApiKeyMethod {
  return { type: 'key', id, label: '', value, loginId }
}

const 로그인 = { type: 'login' as const, id: 'login-1', session: 'S' }

function 소스(overrides: Partial<AccountManageSources>): AccountManageSources {
  return {
    config: { login: 로그인, apiKeys: [], mainKeyId: null },
    subAccounts: null,
    registered: [],
    listOf: () => undefined,
    mapleIdsByAccount: new Map(),
    ...overrides,
  }
}

describe('넥슨 로그인 사용자', () => {
  it('넥슨 ID 계정이 맨 앞이고, 메이플 ID 는 대표 레벨 차례로 대표 캐릭터 이름과 선다', () => {
    const view = buildAccountManageView(
      소스({
        listOf: (id) =>
          id === 'login-1' ? [메이플ID('m-a', 캐릭터('낮은캐', 200)), 메이플ID('m-b', 캐릭터('높은캐', 280), 캐릭터('둘째', 250))] : undefined,
      }),
    )

    expect(view.hasLogin).toBe(true)
    expect(view.accounts[0]).toMatchObject({
      kind: 'login',
      label: '넥슨 ID 계정',
      mapleIds: [
        { accountId: 'm-b', representative: '높은캐' },
        { accountId: 'm-a', representative: '낮은캐' },
      ],
    })
  })

  it('API 키 계정은 서버 목록의 차례로 번호를 받고, 아직 등록하지 못한 키는 그 뒤에 선다', () => {
    const config: NexonAuthConfig = { login: 로그인, apiKeys: [키('k-new', '새-키'), 키('k-old', '옛-키')], mainKeyId: null }

    const view = buildAccountManageView(
      소스({
        config,
        subAccounts: [{ apiKeyHashes: [storedApiKeyHashHex('옛-키')], mapleIds: [h('m-old')] }],
        registered: [`login-1:${apiKeyHashHex('옛-키')}`],
      }),
    )

    expect(view.accounts.map((one) => [one.label, one.apiKey?.id ?? null])).toEqual([
      ['넥슨 ID 계정', null],
      ['API 키 1 계정', 'k-old'],
      ['API 키 2 계정', 'k-new'],
    ])
  })

  // 다른 기기에서 지운 부계정이다. 보이면 서버가 모르는 계정을 지우려 하게 된다.
  it('등록했는데 서버 목록에 없는 키는 보이지 않는다', () => {
    const view = buildAccountManageView(
      소스({
        config: { login: 로그인, apiKeys: [키('k-gone', '지운-키')], mainKeyId: null },
        subAccounts: [],
        registered: [`login-1:${apiKeyHashHex('지운-키')}`],
      }),
    )

    expect(view.accounts.map((one) => one.label)).toEqual(['넥슨 ID 계정'])
  })

  it('서버에만 있는 계정은 키가 없고, 기기가 본 메이플 ID 만 이름이 선다', () => {
    const seen = buildAccountManageView(
      소스({
        subAccounts: [{ apiKeyHashes: ['다른-기기-키'], mapleIds: [h('m-seen'), h('m-never')] }],
        mapleIdsByAccount: new Map([['k-deleted', ['m-seen']]]),
        listOf: (id) => (id === 'k-deleted' ? [메이플ID('m-seen', 캐릭터('본캐', 270))] : undefined),
      }),
    )
    expect(seen.accounts[1]).toMatchObject({
      label: 'API 키 1 계정',
      apiKey: null,
      mapleIds: [{ accountId: 'm-seen', representative: '본캐' }],
      mapleIdHashes: [h('m-seen'), h('m-never')],
    })

    const unseen = buildAccountManageView(소스({ subAccounts: [{ apiKeyHashes: ['다른-기기-키'], mapleIds: [h('m-never')] }] }))
    expect(unseen.accounts[1]).toMatchObject({ apiKey: null, mapleIds: [] })
  })

  // 다른 기기에서 같은 계정의 키를 새로 받았으면 서버의 키 해시는 이 기기의 키와 다르다. 메이플 ID 가 같으면 같은 계정이다.
  it('키 해시가 달라도 기기가 아는 메이플 ID 가 겹치면 그 기기의 키를 그 계정에 붙인다', () => {
    const view = buildAccountManageView(
      소스({
        config: { login: 로그인, apiKeys: [키('k-a', '이-기기-키')], mainKeyId: null },
        subAccounts: [{ apiKeyHashes: ['새로-받은-키'], mapleIds: [h('m-a')] }],
        registered: [`login-1:${apiKeyHashHex('이-기기-키')}`],
        mapleIdsByAccount: new Map([['k-a', ['m-a']]]),
      }),
    )

    expect(view.accounts.map((one) => one.apiKey?.id ?? null)).toEqual([null, 'k-a'])
  })

  it('넥슨 계정이 5개면 더 추가할 수 없다', () => {
    const keys = ['1', '2', '3', '4'].map((n) => 키(`k-${n}`, `키-${n}`))
    expect(buildAccountManageView(소스({ config: { login: 로그인, apiKeys: keys, mainKeyId: null } })).canAdd).toBe(false)
    expect(buildAccountManageView(소스({ config: { login: 로그인, apiKeys: keys.slice(1), mainKeyId: null } })).canAdd).toBe(true)
  })
})

describe('넥슨 로그인을 하지 않은 사용자', () => {
  it('메인 키 계정 하나만 서고 추가할 수 없다. 다른 로그인의 부계정 키는 보이지 않는다', () => {
    const view = buildAccountManageView(
      소스({
        config: { login: null, apiKeys: [키('k-main', '메인-키', null), 키('k-other', '남의-키', 'login-old')], mainKeyId: 'k-main' },
        listOf: (id) => (id === 'k-main' ? [메이플ID('m-main', 캐릭터('키캐', 260))] : undefined),
      }),
    )

    expect(view.hasLogin).toBe(false)
    expect(view.canAdd).toBe(false)
    expect(view.accounts).toEqual([
      expect.objectContaining({
        kind: 'mainKey',
        label: 'API 키 계정',
        apiKey: expect.objectContaining({ id: 'k-main' }),
        mapleIds: [{ accountId: 'm-main', representative: '키캐' }],
      }),
    ])
  })
})

it('목록이 없는 계정은 기기가 본 메이플 ID 를 대표 캐릭터 없이 세운다', () => {
  const view = buildAccountManageView(소스({ mapleIdsByAccount: new Map([['login-1', ['m-x']]]) }))

  expect(view.accounts[0]).toMatchObject({ mapleIds: [{ accountId: 'm-x', representative: null }], mapleIdHashes: [h('m-x')] })
})
