/**
 * 계정 관리 목록의 값. 기기의 인증 수단 · 서버의 부계정 목록 · 받아 둔 캐릭터 목록 · 소속 기록에서 짓는 순수 함수다.
 *
 * 앱은 서버가 지금 로그인에 준 부계정만 보인다. 서버는 메이플 ID 를 해시로만 주므로, 기기가 본 메이플 ID 를 해시해 맞춘 것만 이름이
 * 선다.
 */
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import { mainApiKeyOf } from '../../lib/nexon-credential'
import {
  isRegisteredSubAccountKey,
  serverSubAccountOfKey,
  type ServerSubAccount,
} from '../../lib/sub-account-keys'
import type { MapleAccount, NexonApiKeyMethod, NexonAuthConfig } from '../../types'
import { sortAccountSummaries, summarizeAccount } from '../character-manage/derivations'

/** 넥슨 계정의 상한. 로그인을 포함한다. 계정마다 `character/list` 와 강화 내역 수집이 따로 돌아 호출이 늘기 때문이다 */
export const NEXON_ACCOUNT_LIMIT = 5

export interface AccountManageSources {
  config: NexonAuthConfig | null
  /** 서버가 지금 로그인에 준 부계정 목록. 받은 적이 없으면 `null` */
  subAccounts: readonly ServerSubAccount[] | null
  /** 서버에 등록했다고 적은 키(`serverAccounts.registered`) */
  registered: readonly string[]
  /** 넥슨 계정 id 의 받아 둔 `character/list`. 없으면 `undefined` */
  listOf: (nexonAccountId: string) => readonly MapleAccount[] | undefined
  /** 넥슨 계정 id → 기기가 본 메이플 ID(`character_accounts`) */
  mapleIdsByAccount: ReadonlyMap<string, readonly string[]>
}

export interface ManagedMapleId {
  accountId: string
  /** 대표 캐릭터 이름. 목록을 받아 둔 적이 없으면 `null` */
  representative: string | null
}

export interface ManagedAccount {
  /** 상세 페이지를 여는 값. 기기에 키가 있으면 그 넥슨 계정 id, 서버에만 있으면 `server:` 와 첫 메이플 ID 해시 */
  key: string
  kind: 'login' | 'subKey' | 'mainKey'
  /** `넥슨 ID 계정` · `API 키 1 계정` · `API 키 계정`. 행과 상세 제목은 뒤에 `설정` 을 붙인다 */
  label: string
  /** 이 기기의 키. 넥슨 ID 계정과 이 기기에 키가 없는 계정은 `null` */
  apiKey: NexonApiKeyMethod | null
  /** 서버 목록의 줄. 목록을 모르거나 아직 등록하지 못한 키면 `null` */
  server: ServerSubAccount | null
  mapleIds: ManagedMapleId[]
  /** 이 계정의 메이플 ID 해시. 키를 넣을 때의 겹침 판정과 지우기가 쓴다 */
  mapleIdHashes: string[]
}

export interface AccountManageView {
  hasLogin: boolean
  /** 첫 줄이 메인 계정(넥슨 ID 계정 또는 메인 키 계정)이다 */
  accounts: ManagedAccount[]
  /** `API 키 추가` 로 더 넣을 수 있는가. 로그인이 없거나 상한이면 거짓 */
  canAdd: boolean
}

/** 목록이 있으면 대표 레벨 차례, 없으면 기기가 본 차례의 메이플 ID. */
function mapleIdsOfAccount(nexonAccountId: string, sources: AccountManageSources): ManagedMapleId[] {
  const list = sources.listOf(nexonAccountId)
  if (list !== undefined) {
    const summaries = sortAccountSummaries(list.flatMap((account) => summarizeAccount(account) ?? []))
    return summaries.map((summary) => ({ accountId: summary.accountId, representative: summary.representative.name }))
  }
  return (sources.mapleIdsByAccount.get(nexonAccountId) ?? []).map((accountId) => ({ accountId, representative: null }))
}

/** 서버에만 있는 계정의 메이플 ID. 기기가 본 메이플 ID 가운데 해시가 서버 줄에 있는 것만이다. */
function mapleIdsOfServerRow(row: ServerSubAccount, sources: AccountManageSources): ManagedMapleId[] {
  const wanted = new Set(row.mapleIds)
  const found = new Map<string, ManagedMapleId>()
  for (const nexonAccountId of sources.mapleIdsByAccount.keys()) {
    for (const mapleId of mapleIdsOfAccount(nexonAccountId, sources)) {
      if (wanted.has(nexonIdHashHex(mapleId.accountId)) && !found.has(mapleId.accountId)) found.set(mapleId.accountId, mapleId)
    }
  }
  return [...found.values()]
}

function accountOfKey(key: NexonApiKeyMethod, kind: 'subKey' | 'mainKey', label: string, sources: AccountManageSources, server: ServerSubAccount | null): ManagedAccount {
  const mapleIds = mapleIdsOfAccount(key.id, sources)
  return {
    key: key.id,
    kind,
    label,
    apiKey: key,
    server,
    mapleIds,
    mapleIdHashes: server !== null ? [...server.mapleIds] : mapleIds.map((one) => nexonIdHashHex(one.accountId)),
  }
}

/** 서버 줄에 붙일 기기의 키. 키 해시가 같거나, 기기가 아는 그 키의 메이플 ID 가 서버 줄과 겹치는 키다. */
function keyOfServerRow(
  row: ServerSubAccount,
  keys: readonly NexonApiKeyMethod[],
  sources: AccountManageSources,
): NexonApiKeyMethod | undefined {
  const byHash = keys.find((key) => serverSubAccountOfKey(key, [row]) !== undefined)
  if (byHash !== undefined) return byHash
  const wanted = new Set(row.mapleIds)
  return keys.find((key) => (sources.mapleIdsByAccount.get(key.id) ?? []).some((mapleId) => wanted.has(nexonIdHashHex(mapleId))))
}

export function buildAccountManageView(sources: AccountManageSources): AccountManageView {
  const config = sources.config
  const login = config?.login
  if (config == null || login == null) {
    const main = mainApiKeyOf(config)
    return { hasLogin: false, accounts: main === null ? [] : [accountOfKey(main, 'mainKey', 'API 키 계정', sources, null)], canAdd: false }
  }

  const loginMapleIds = mapleIdsOfAccount(login.id, sources)
  const accounts: ManagedAccount[] = [
    {
      key: login.id,
      kind: 'login',
      label: '넥슨 ID 계정',
      apiKey: null,
      server: null,
      mapleIds: loginMapleIds,
      mapleIdHashes: loginMapleIds.map((one) => nexonIdHashHex(one.accountId)),
    },
  ]

  const keys = config.apiKeys.filter((key) => key.loginId === login.id)
  const placed = new Set<string>()
  const subs: { key: NexonApiKeyMethod | null; server: ServerSubAccount | null }[] = []
  for (const row of sources.subAccounts ?? []) {
    const key = keyOfServerRow(
      row,
      keys.filter((one) => !placed.has(one.id)),
      sources,
    )
    if (key !== undefined) placed.add(key.id)
    subs.push({ key: key ?? null, server: row })
  }
  for (const key of keys) {
    if (placed.has(key.id)) continue
    // 등록했는데 서버 목록에 없으면 다른 기기에서 지운 부계정이다. 목록을 모르면 기기의 키를 모두 세운다.
    if (sources.subAccounts !== null && isRegisteredSubAccountKey(key, login.id, sources.registered)) continue
    subs.push({ key, server: null })
  }

  subs.forEach(({ key, server }, index) => {
    const label = `API 키 ${index + 1} 계정`
    if (key !== null) {
      accounts.push(accountOfKey(key, 'subKey', label, sources, server))
      return
    }
    // 키가 없으면 서버 줄이 있다. 위에서 키도 줄도 없는 것은 만들지 않는다.
    const row = server as ServerSubAccount
    accounts.push({
      key: `server:${row.mapleIds[0] ?? index}`,
      kind: 'subKey',
      label,
      apiKey: null,
      server: row,
      mapleIds: mapleIdsOfServerRow(row, sources),
      mapleIdHashes: [...row.mapleIds],
    })
  })

  return { hasLogin: true, accounts, canAdd: accounts.length < NEXON_ACCOUNT_LIMIT }
}
