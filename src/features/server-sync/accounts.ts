/**
 * 서버 전송 회차의 첫 단계. 기록을 보내기 전에 서버가 이 기기의 넥슨 계정을 알게 한다.
 *
 * 서버는 기록의 메이플 ID 가 보낸 신원의 넥슨 계정에 있어야 적는다. 알리기 전에 보낸 기록은 거절돼 대기 표가 다시 보내야 하므로,
 * 회차마다 기록보다 먼저 돈다.
 *
 * 1. 지금 로그인의 부계정 키를 세션으로 등록한다(`POST /v1/me/sub-accounts`). 등록한 키는 로그인마다 적어 다시 보내지 않는다.
 * 2. 계정마다 그 계정의 신원으로 메이플 ID 를 알린다(`PUT /v1/me/maple-ids`). 서버가 돌려준 목록에 다 있으면 보내지 않는다.
 */
import { apiKeyHashHex } from '../../lib/crypto/api-key-hash'
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import { credentialOf, usableCredentialsOf } from '../../lib/nexon-credential'
import {
  registerSubAccountOnServer,
  reportMapleIdsToServer,
  type RegisterSubAccountResult,
  type ReportMapleIdsResult,
} from '../../server/accounts'
import { getAuthConfig } from '../../storage/api-key'
import { getMapleIdsByNexonAccount } from '../../storage/character-accounts'
import { getServerAccounts, setServerAccounts, type ServerAccountsState } from '../../storage/server-accounts'
import type { NexonAuthConfig } from '../../types/auth'
import { serverIdentityOfAccount } from '../auth/server-identity'

/** 이 단계가 밖에 맡기는 일. 테스트가 갈아 끼운다. */
export interface PrepareAccountsDeps {
  config: () => Promise<NexonAuthConfig | null>
  /** 넥슨 계정 id 마다 그 계정의 메이플 ID 원문 */
  mapleIdsByAccount: () => Promise<Map<string, string[]>>
  getState: () => Promise<ServerAccountsState>
  setState: (state: ServerAccountsState) => Promise<void>
  report: (headers: Record<string, string>, mapleIds: readonly string[]) => Promise<ReportMapleIdsResult>
  register: (
    sessionHeaders: Record<string, string>,
    apiKeyHash: string,
    mapleIds: readonly string[],
  ) => Promise<RegisterSubAccountResult>
}

const DEFAULT_DEPS: PrepareAccountsDeps = {
  config: getAuthConfig,
  mapleIdsByAccount: getMapleIdsByNexonAccount,
  getState: getServerAccounts,
  setState: setServerAccounts,
  report: reportMapleIdsToServer,
  register: registerSubAccountOnServer,
}

/** 서버가 계정을 알게 한다. 실패한 것은 적지 않아 다음 회차가 다시 한다. 저장소를 못 읽으면 던지고, 부르는 쪽이 회차를 접는다. */
export async function prepareServerAccounts(deps: PrepareAccountsDeps = DEFAULT_DEPS): Promise<void> {
  const config = await deps.config()
  if (config === null) return
  const byAccount = await deps.mapleIdsByAccount()
  const state = await deps.getState()
  const hashesOf = (accountId: string): string[] => (byAccount.get(accountId) ?? []).map(nexonIdHashHex)

  const login = config.login
  if (login != null && login.session !== '') {
    const session = { Authorization: `Bearer ${login.session}` }
    for (const key of config.apiKeys) {
      if (key.loginId !== login.id || key.value === '') continue
      const keyHash = apiKeyHashHex(key.value)
      const tag = `${login.id}:${keyHash}`
      if (state.registered.includes(tag)) continue
      // 메이플 ID 가 없으면 서버가 같은 넥슨 ID 인지 가르지 못해 받지 않는다. 목록을 받은 뒤의 회차가 등록한다.
      const mapleIds = hashesOf(key.id)
      if (mapleIds.length === 0) continue
      const result = await deps.register(session, keyHash, mapleIds)
      // 같은 넥슨 ID 는 다시 보내도 늘 거절된다. 한도는 다른 부계정을 지우면 풀리므로 적지 않는다.
      if (result === 'registered' || result === 'same_account') state.registered.push(tag)
    }
  }

  const credentials = login == null ? [credentialOf(config)] : usableCredentialsOf(config)
  for (const credential of credentials) {
    const accountId = credential?.accountId ?? null
    if (accountId === null) continue
    const mapleIds = hashesOf(accountId)
    if (mapleIds.length === 0) continue
    const known = new Set(state.reported[accountId] ?? [])
    if (mapleIds.every((one) => known.has(one))) continue
    const headers = serverIdentityOfAccount(config, accountId)
    if (headers === null) continue
    const result = await deps.report(headers, mapleIds)
    if (result.outcome === 'sent') state.reported[accountId] = result.mapleIds
  }

  await deps.setState(state)
}
