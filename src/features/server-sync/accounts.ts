/**
 * 서버 전송 회차의 첫 단계. 기록을 보내기 전에 서버가 이 기기의 넥슨 계정을 알게 한다.
 *
 * 서버는 기록의 메이플 ID 가 보낸 신원이 쓸 수 있는 것이어야 적는다. 알리기 전에 보낸 기록은 거절돼 대기 표가 다시 보내야 하므로,
 * 회차마다 기록보다 먼저 돈다.
 *
 * 1. 지금 로그인의 부계정 키를 세션으로 등록한다(`POST /v1/me/sub-accounts`). 그 키의 메이플 ID 해시만 싣는다. 등록한 키는
 *    로그인마다 적어 다시 보내지 않는다.
 * 2. 메인 신원으로 메인 계정의 메이플 ID 를 알린다(`PUT /v1/me/maple-ids`). 서버가 돌려준 목록에 다 있으면 보내지 않는다. 부계정의
 *    메이플 ID 는 등록이 알린다. 세션이 그 메이플 ID 까지 쓸 수 있어 부계정 키의 신원으로는 보내지 않는다.
 */
import { apiKeyHashHex } from '../../lib/crypto/api-key-hash'
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import { mainApiKeyOf } from '../../lib/nexon-credential'
import {
  registerSubAccountOnServer,
  reportMapleIdsToServer,
  type RegisterSubAccountResult,
  type ReportMapleIdsResult,
} from '../../server/accounts'
import { ERROR_CODES } from '../../server/error-codes'
import { getAuthConfig } from '../../storage/api-key'
import { getMapleIdsByNexonAccount } from '../../storage/character-accounts'
import { getServerAccounts, setServerAccounts, type ServerAccountsState } from '../../storage/server-accounts'
import type { NexonAuthConfig } from '../../types/auth'
import { mainServerIdentityOf } from '../auth/server-identity'

/** 이 단계가 밖에 맡기는 일. 테스트가 갈아 끼운다. */
export interface PrepareAccountsDeps {
  config: () => Promise<NexonAuthConfig | null>
  /** 넥슨 계정 id 마다 그 계정의 메이플 ID 원문 */
  mapleIdsByAccount: () => Promise<Map<string, string[]>>
  getState: () => Promise<ServerAccountsState>
  setState: (state: ServerAccountsState) => Promise<void>
  report: (headers: Record<string, string>, mapleIds: readonly string[]) => Promise<ReportMapleIdsResult>
  register: (sessionHeaders: Record<string, string>, mapleIds: readonly string[]) => Promise<RegisterSubAccountResult>
}

const DEFAULT_DEPS: PrepareAccountsDeps = {
  config: getAuthConfig,
  mapleIdsByAccount: getMapleIdsByNexonAccount,
  getState: getServerAccounts,
  setState: setServerAccounts,
  report: reportMapleIdsToServer,
  register: registerSubAccountOnServer,
}

/** 메인 신원의 넥슨 계정 id. 신원을 고르는 규칙(`mainServerIdentityOf`)과 같은 계정이다. */
function mainAccountIdOf(config: NexonAuthConfig): string | null {
  const login = config.login
  if (login != null && login.session !== '') return login.id
  return mainApiKeyOf(config)?.id ?? null
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
      // 무효 표시가 붙은 키는 넥슨에서 지워진 키라 등록하지 않는다.
      if (key.loginId !== login.id || key.value === '' || key.invalid !== undefined) continue
      const tag = `${login.id}:${apiKeyHashHex(key.value)}`
      if (state.registered.includes(tag)) continue
      // 서버는 메이플 ID 로 넥슨 계정을 찾아 메이플 ID 가 없으면 받지 않는다. 목록을 받은 뒤의 회차가 등록한다.
      const mapleIds = hashesOf(key.id)
      if (mapleIds.length === 0) continue
      const result = await deps.register(session, mapleIds)
      // 같은 넥슨 ID 는 다시 보내도 늘 거절된다.
      if (result === 'registered' || result === ERROR_CODES.sameAccount) state.registered.push(tag)
    }
  }

  const accountId = mainAccountIdOf(config)
  if (accountId !== null) await reportMainMapleIds(config, accountId, byAccount, state, deps.report)

  await deps.setState(state)
}

/** 메인 계정의 메이플 ID 해시를 메인 신원으로 알린다. 서버가 마지막으로 돌려준 목록에 다 있으면 보내지 않는다. */
async function reportMainMapleIds(
  config: NexonAuthConfig,
  accountId: string,
  byAccount: ReadonlyMap<string, readonly string[]>,
  state: ServerAccountsState,
  report: PrepareAccountsDeps['report'],
): Promise<void> {
  const mapleIds = (byAccount.get(accountId) ?? []).map(nexonIdHashHex)
  const known = new Set(state.reported[accountId] ?? [])
  if (mapleIds.length === 0 || mapleIds.every((one) => known.has(one))) return
  const headers = await mainServerIdentityOf(config, async (id) => byAccount.get(id) ?? [])
  if (headers === null) return
  const result = await report(headers, mapleIds)
  if (result.outcome === 'sent') state.reported[accountId] = result.mapleIds
}
