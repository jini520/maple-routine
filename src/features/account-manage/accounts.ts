/**
 * 계정 관리 목록의 값. 기기의 인증 수단 · 받아 둔 캐릭터 목록 · 소속 기록에서 짓는 순수 함수다.
 *
 * 부계정은 기기마다 따로 관리한다. 그래서 이 기기에 있는 지금 로그인의 키만 계정으로 선다.
 */
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import { mainApiKeyOf } from '../../lib/nexon-credential'
import type { MapleAccount, NexonApiKeyMethod, NexonAuthConfig } from '../../types'
import { sortAccountSummaries, summarizeAccount } from '../character-manage/derivations'

/** 이 기기의 넥슨 계정 상한. 로그인을 포함한다. 계정마다 `character/list` 와 강화 내역 수집이 따로 돌아 기기의 호출이 늘기 때문이다 */
export const NEXON_ACCOUNT_LIMIT = 5

export interface AccountManageSources {
  config: NexonAuthConfig | null
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
  /** 상세 페이지를 여는 값. 그 계정의 넥슨 계정 id */
  key: string
  kind: 'login' | 'subKey' | 'mainKey'
  /** `넥슨 ID 계정` · `API 키 1 계정` · `API 키 계정`. 행과 상세 제목은 뒤에 `설정` 을 붙인다 */
  label: string
  /** 이 기기의 키. 넥슨 ID 계정은 `null` */
  apiKey: NexonApiKeyMethod | null
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

function accountOfKey(key: NexonApiKeyMethod, kind: 'subKey' | 'mainKey', label: string, sources: AccountManageSources): ManagedAccount {
  const mapleIds = mapleIdsOfAccount(key.id, sources)
  return { key: key.id, kind, label, apiKey: key, mapleIds, mapleIdHashes: mapleIds.map((one) => nexonIdHashHex(one.accountId)) }
}

export function buildAccountManageView(sources: AccountManageSources): AccountManageView {
  const config = sources.config
  const login = config?.login
  if (config == null || login == null) {
    const main = mainApiKeyOf(config)
    return { hasLogin: false, accounts: main === null ? [] : [accountOfKey(main, 'mainKey', 'API 키 계정', sources)], canAdd: false }
  }

  const loginMapleIds = mapleIdsOfAccount(login.id, sources)
  const accounts: ManagedAccount[] = [
    {
      key: login.id,
      kind: 'login',
      label: '넥슨 ID 계정',
      apiKey: null,
      mapleIds: loginMapleIds,
      mapleIdHashes: loginMapleIds.map((one) => nexonIdHashHex(one.accountId)),
    },
  ]
  // 앞 로그인에 귀속된 키는 지금 로그인의 부계정이 아니라 세우지도 세지도 않는다.
  config.apiKeys
    .filter((key) => key.loginId === login.id)
    .forEach((key, index) => accounts.push(accountOfKey(key, 'subKey', `API 키 ${index + 1} 계정`, sources)))

  return { hasLogin: true, accounts, canAdd: accounts.length < NEXON_ACCOUNT_LIMIT }
}
