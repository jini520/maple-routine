// 계정 관리 목록의 값. 부계정은 기기마다 따로 관리해, 이 기기에 있는 지금 로그인의 키만 계정으로 선다.
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
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

  // 부계정은 기기마다 따로 관리한다. 앞 로그인에 귀속된 키는 지금 로그인의 부계정이 아니다.
  it('API 키 계정은 이 기기에 저장된 차례로 번호를 받고, 지금 로그인에 귀속된 키만 선다', () => {
    const config: NexonAuthConfig = {
      login: 로그인,
      apiKeys: [키('k-first', '첫-키'), 키('k-old-login', '남의-키', 'login-old'), 키('k-second', '둘째-키')],
      mainKeyId: null,
    }

    const view = buildAccountManageView(소스({ config }))

    expect(view.accounts.map((one) => [one.label, one.apiKey?.id ?? null])).toEqual([
      ['넥슨 ID 계정', null],
      ['API 키 1 계정', 'k-first'],
      ['API 키 2 계정', 'k-second'],
    ])
  })

  // 상한은 기기 한 대의 호출이 늘어나는 것을 막는 값이라 이 기기의 계정으로 센다. 다른 로그인에 귀속된 키는 부르지 않아 세지 않는다.
  it('이 기기의 넥슨 계정이 5개면 더 추가할 수 없다', () => {
    const keys = ['1', '2', '3', '4'].map((n) => 키(`k-${n}`, `키-${n}`))
    expect(buildAccountManageView(소스({ config: { login: 로그인, apiKeys: keys, mainKeyId: null } })).canAdd).toBe(false)
    expect(buildAccountManageView(소스({ config: { login: 로그인, apiKeys: keys.slice(1), mainKeyId: null } })).canAdd).toBe(true)
    const withOther = [...keys.slice(1), 키('k-other', '남의-키', 'login-old')]
    expect(buildAccountManageView(소스({ config: { login: 로그인, apiKeys: withOther, mainKeyId: null } })).canAdd).toBe(true)
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
