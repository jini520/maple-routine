/**
 * 계정 관리. 목록을 읽고, 부계정 키를 더하고 바꾸고 지운다.
 *
 * 부계정은 기기마다 따로 관리하고, 서버는 어느 넥슨 계정이 그 로그인의 부계정인지만 메이플 ID 로 적는다. 부계정은 넥슨 ID 하나에만
 * 등록되므로, 더하고 바꿀 때는 서버 등록을 먼저 하고, 지울 때는 서버의 등록을 먼저 해제한다.
 */
import { create } from 'zustand'

import { apiKeyHashHex } from '../../lib/crypto/api-key-hash'
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import { accountOfOcid } from '../../lib/mvp/membership'
import { randomUuid } from '../../native/uuid'
import { registerSubAccountOnServer, unregisterSubAccountOnServer, type RegisterSubAccountResult } from '../../server/accounts'
import { ERROR_CODES } from '../../server/error-codes'
import { addSubApiKey, getAuthConfig, removeApiKey, replaceApiKeyValue } from '../../storage/api-key'
import { getCharacterAccountSightings, getMapleIdsByNexonAccount } from '../../storage/character-accounts'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getServerAccounts, setServerAccounts } from '../../storage/server-accounts'
import { forgetServerSyncMapleIds } from '../../storage/server-sync-owners'
import type { NexonApiKeyMethod, NexonAuthConfig, NexonLoginMethod } from '../../types'
import { currentCredentials } from '../auth/current-credential'
import { formatAuthError } from '../auth/format'
import { reusableNexonAccountId } from '../auth/reentry-account-id'
import { untrackCharacters } from '../character-selection/untrack'
import {
  fetchCharacterListsCached,
  fetchUnsavedCharacterList,
  readCachedCharacterListOfAccount,
  recordCharacterList,
} from '../mvp-grade/character-list'
import { saveTrackedCharacters } from '../schedule-sync/save-tracked'
import { useToastStore } from '../toast/store'
import { buildAccountManageView, type AccountManageSources, type AccountManageView, type ManagedAccount } from './accounts'
import { checkApiKey, type KeyCheck, type KeyRejection } from './validate-key'

/** 서버 등록이 막은 이유. 다른 넥슨 ID 의 부계정 · 부계정을 가진 넥슨 ID · 부계정인 로그인 */
export type RegistrationRejection = 'registeredElsewhere' | 'hasSubAccounts' | 'loginIsSubAccount'

/** `등록할 수 없는 키예요` 모달이 알리는 이유. 검증에 걸린 것과 서버 등록이 막은 것 */
export type UnregistrableReason = KeyRejection | RegistrationRejection

export type KeyActionResult =
  | { outcome: 'saved' }
  | { outcome: 'rejected'; reason: UnregistrableReason }
  /** 이 기기의 넥슨 계정이 이미 5개다 */
  | { outcome: 'limit' }
  /** 추가한 키가 등록된 부계정의 키다. 저장하지 않았고, 바꿀지 물은 뒤 `replaceWithKey` 로 바꾼다 */
  | { outcome: 'existing'; accountKey: string; label: string }
  /** 토스트로 이미 알렸다 */
  | { outcome: 'failed' }

export interface AccountManageStore {
  /** 읽기 전이면 `null` */
  view: AccountManageView | null
  /** 기기에 있는 값으로 먼저 세우고, 캐릭터 목록을 받아 다시 세운다 */
  load(): Promise<void>
  addKey(apiKey: string): Promise<KeyActionResult>
  /**
   * 부계정의 키를 같은 넥슨 계정의 새 키로 바꾼다.
   *
   * @param accountKey 계정의 `key`
   */
  changeKey(accountKey: string, apiKey: string): Promise<KeyActionResult>
  /**
   * `addKey` 가 등록된 부계정이라고 돌려준 키로 그 계정의 키를 바꾼다. 추가할 때 거친 검증을 다시 하지 않는다.
   *
   * @param accountKey `addKey` 가 돌려준 계정의 `key`
   */
  replaceWithKey(accountKey: string, apiKey: string): Promise<KeyActionResult>
  /**
   * 서버의 부계정 등록을 해제하고 이 기기에서 키와 추적 캐릭터, 그 메이플 ID 의 기록을 지운다. 서버가 받지 못하면 아무것도 지우지 않고
   * 토스트로 알린다
   */
  removeAccount(accountKey: string): Promise<'removed' | 'failed'>
}

const SAVED_MESSAGE = 'API 키를 확인했어요'
const REMOVE_FAILED_MESSAGE = 'API 키를 삭제하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'

/** 다시 보내도 같은 답이라 키를 저장하지 않는 등록 거절. 같은 넥슨 ID 는 검증의 `alreadyRegistered` 와 같은 안내다 */
const REJECTION_OF: Partial<Record<RegisterSubAccountResult, UnregistrableReason>> = {
  [ERROR_CODES.sameAccount]: 'alreadyRegistered',
  [ERROR_CODES.registeredElsewhere]: 'registeredElsewhere',
  [ERROR_CODES.hasSubAccounts]: 'hasSubAccounts',
  [ERROR_CODES.loginIsSubAccount]: 'loginIsSubAccount',
}

function sessionOf(login: NexonLoginMethod): Record<string, string> {
  return { Authorization: `Bearer ${login.session}` }
}

async function readSources(): Promise<AccountManageSources> {
  const [config, mapleIdsByAccount] = await Promise.all([
    getAuthConfig().catch(() => null),
    getMapleIdsByNexonAccount().catch(() => new Map<string, string[]>()),
  ])
  return {
    config,
    listOf: readCachedCharacterListOfAccount,
    mapleIdsByAccount,
  }
}

/** 서버에 등록했다고 적는다. 다음 서버 전송 회차가 같은 키를 다시 보내지 않는다. */
async function markRegistered(loginId: string, apiKey: string): Promise<void> {
  const state = await getServerAccounts()
  const tag = `${loginId}:${apiKeyHashHex(apiKey)}`
  if (!state.registered.includes(tag)) await setServerAccounts({ ...state, registered: [...state.registered, tag] })
}

/** 해제한 키의 적은 값을 뺀다. 남기면 같은 키를 다시 넣고 등록이 응답 없이 끝났을 때 회차가 다시 등록하지 않는다. */
async function unmarkRegistered(loginId: string, apiKey: string): Promise<void> {
  const state = await getServerAccounts()
  const tag = `${loginId}:${apiKeyHashHex(apiKey)}`
  if (state.registered.includes(tag)) await setServerAccounts({ ...state, registered: state.registered.filter((one) => one !== tag) })
}

/**
 * 부계정 해제에 실을 메이플 ID 해시. 기기가 모르면 그 키로 넥슨 목록을 받는다. 캐릭터가 없는 메이플 ID 는 기기의 소속 표에 남지
 * 않지만, 등록은 넥슨 목록의 메이플 ID 로 했다. 목록을 받지 못하면 빈 배열이다.
 */
async function mapleIdHashesToUnregister(account: ManagedAccount, apiKey: NexonApiKeyMethod): Promise<string[]> {
  if (account.mapleIdHashes.length > 0) return account.mapleIdHashes
  const accounts = await fetchUnsavedCharacterList({ type: 'key', value: apiKey.value, accountId: apiKey.id }).catch(() => [])
  return accounts.map((one) => nexonIdHashHex(one.accountId))
}

/** 지운 계정의 메이플 ID 에 속한 추적 캐릭터를 뺀다. */
async function untrackMapleIds(mapleIdHashes: ReadonlySet<string>): Promise<void> {
  const [tracked, sightings] = await Promise.all([getTrackedCharacterOcids(), getCharacterAccountSightings()])
  const ocids = (tracked ?? []).filter((ocid) => {
    const mapleId = accountOfOcid(sightings, ocid)
    return mapleId !== null && mapleIdHashes.has(nexonIdHashHex(mapleId))
  })
  await untrackCharacters(new Set(ocids))
}

/** 키가 무효가 됐을 때 뺀 캐릭터를 추적 목록 끝에 다시 넣는다. 이미 추적 중인 캐릭터는 두 번 넣지 않는다. */
async function restoreUntracked(ocids: readonly string[]): Promise<void> {
  if (ocids.length === 0) return
  const tracked = (await getTrackedCharacterOcids()) ?? []
  const added = ocids.filter((ocid) => !tracked.includes(ocid))
  // 되돌린 캐릭터를 불러오는 동안 키 시트를 붙들지 않는다. 다 불러오면 저장 쪽이 알린다.
  if (added.length > 0) void saveTrackedCharacters([...tracked, ...added])
}

type PassedCheck = Extract<KeyCheck, { outcome: 'ok' }>

/** `addKey` 가 등록된 부계정이라고 돌려준 키와 그 검증. 바꾸기를 고르면 검증을 다시 하지 않고 쓴다. */
let pendingReplacement: { accountKey: string; apiKey: string; check: PassedCheck } | null = null

/**
 * 부계정의 키를 같은 넥슨 계정의 새 키로 바꿔 저장한다. 계정 id 와 귀속을 그대로 써서 그 계정의 추적 캐릭터와 기록이 이어진다.
 * 무효 표시가 붙은 키였으면 그때 뺀 캐릭터를 되돌린다. 서버 등록을 먼저 하고, 서버가 거절하면 바꾸지 않는다.
 */
async function saveChangedKey(
  account: ManagedAccount,
  apiKey: string,
  check: PassedCheck,
  login: NexonLoginMethod,
): Promise<KeyActionResult> {
  if (account.apiKey === null) return { outcome: 'failed' }
  const accountId = account.apiKey.id
  const untracked = account.apiKey.invalid?.untrackedOcids ?? []

  // 메이플 ID 가 같아 서버는 같은 넥슨 계정 줄의 등록으로 받는다. 응답이 없으면 저장하고 다음 회차가 다시 등록한다.
  const registered = await registerSubAccountOnServer(sessionOf(login), check.mapleIdHashes)
  const rejection = REJECTION_OF[registered]
  if (rejection !== undefined) return { outcome: 'rejected', reason: rejection }

  try {
    await replaceApiKeyValue(accountId, apiKey)
  } catch {
    useToastStore.getState().showError(formatAuthError({ kind: 'storageWriteFailed' }))
    return { outcome: 'failed' }
  }
  recordCharacterList(check.accounts, accountId)
  if (registered === 'registered') await markRegistered(login.id, apiKey).catch(() => undefined)

  await restoreUntracked(untracked).catch(() => undefined)
  useToastStore.getState().showSuccess(SAVED_MESSAGE)
  return { outcome: 'saved' }
}

function otherHashes(view: AccountManageView, except: ManagedAccount | null): string[] {
  return view.accounts.filter((one) => one !== except).flatMap((one) => one.mapleIdHashes)
}

async function loginOf(): Promise<{ config: NexonAuthConfig; login: NexonLoginMethod } | null> {
  const config = await getAuthConfig().catch(() => null)
  const login = config?.login
  return config == null || login == null ? null : { config, login }
}

export const useAccountManageStore = create<AccountManageStore>()((set, get) => ({
  view: null,

  async load() {
    set({ view: buildAccountManageView(await readSources()) })
    // 대표 캐릭터 이름을 채운다. 5분 안에 받은 목록은 다시 부르지 않는다. 한 계정의 실패는 그 계정만 비운다.
    await fetchCharacterListsCached(await currentCredentials()).catch(() => undefined)
    set({ view: buildAccountManageView(await readSources()) })
  },

  async addKey(apiKey) {
    const view = get().view
    const auth = await loginOf()
    if (view === null || auth === null) return { outcome: 'failed' }
    if (!view.canAdd) return { outcome: 'limit' }

    // 막는 겹침은 로그인의 메이플 ID 다. 넥슨 ID 계정에는 바꿀 키가 없다.
    const loginHashes = view.accounts.filter((one) => one.kind === 'login').flatMap((one) => one.mapleIdHashes)
    const check = await checkApiKey(apiKey, { taken: loginHashes, target: null })
    if (check.outcome === 'rejected') return check
    if (check.outcome === 'failed') {
      useToastStore.getState().showError(formatAuthError(check.error))
      return { outcome: 'failed' }
    }

    // 등록된 부계정과 겹치면 같은 넥슨 계정의 새 키다. 막지 않고 그 계정의 키를 바꿀지 묻는다.
    const fresh = new Set(check.mapleIdHashes)
    const existing = view.accounts.find((one) => one.kind === 'subKey' && one.mapleIdHashes.some((hash) => fresh.has(hash)))
    if (existing !== undefined) {
      pendingReplacement = { accountKey: existing.key, apiKey, check }
      return { outcome: 'existing', accountKey: existing.key, label: existing.label }
    }

    // 서버 등록부터다. 기기가 로그인의 메이플 ID 를 다 알지 못하면 같은 넥슨 ID 를 서버만 알아본다. 받지 못하면 기기에 두고 회차가 다시 등록한다.
    const registered = await registerSubAccountOnServer(sessionOf(auth.login), check.mapleIdHashes)
    const rejection = REJECTION_OF[registered]
    if (rejection !== undefined) return { outcome: 'rejected', reason: rejection }

    const accountId = (await reusableNexonAccountId(check.accounts)) ?? randomUuid()
    try {
      await addSubApiKey(apiKey, auth.login.id, accountId)
    } catch {
      useToastStore.getState().showError(formatAuthError({ kind: 'storageWriteFailed' }))
      return { outcome: 'failed' }
    }
    recordCharacterList(check.accounts, accountId)
    if (registered === 'registered') await markRegistered(auth.login.id, apiKey).catch(() => undefined)

    useToastStore.getState().showSuccess(SAVED_MESSAGE)
    void get().load()
    return { outcome: 'saved' }
  },

  async changeKey(accountKey, apiKey) {
    const view = get().view
    const auth = await loginOf()
    const account = view?.accounts.find((one) => one.key === accountKey)
    if (view == null || auth === null || account === undefined || account.kind !== 'subKey' || account.apiKey === null) {
      return { outcome: 'failed' }
    }

    // 바꾸는 계정은 겹침에서 빼고, 그 계정과는 겹쳐야 같은 넥슨 계정이다.
    const check = await checkApiKey(apiKey, { taken: otherHashes(view, account), target: account.mapleIdHashes })
    if (check.outcome === 'rejected') return check
    if (check.outcome === 'failed') {
      useToastStore.getState().showError(formatAuthError(check.error))
      return { outcome: 'failed' }
    }

    const result = await saveChangedKey(account, apiKey, check, auth.login)
    if (result.outcome === 'saved') void get().load()
    return result
  },

  async replaceWithKey(accountKey, apiKey) {
    const pending = pendingReplacement
    pendingReplacement = null
    // 물은 그 키가 아니면 검증을 거친 값이 없다. 바꾸기와 같은 검증을 거친다.
    if (pending === null || pending.accountKey !== accountKey || pending.apiKey !== apiKey) return get().changeKey(accountKey, apiKey)
    const auth = await loginOf()
    const account = get().view?.accounts.find((one) => one.key === accountKey)
    if (auth === null || account === undefined || account.kind !== 'subKey') return { outcome: 'failed' }

    const result = await saveChangedKey(account, apiKey, pending.check, auth.login)
    if (result.outcome === 'saved') void get().load()
    return result
  },

  async removeAccount(accountKey) {
    const account = get().view?.accounts.find((one) => one.key === accountKey)
    if (account === undefined || account.kind !== 'subKey' || account.apiKey === null) return 'failed'

    // 서버의 등록을 먼저 해제한다. 기기에서만 지우면 서버에 등록이 남아 다른 넥슨 ID 가 그 계정을 등록하지 못한다.
    const auth = await loginOf()
    const mapleIdHashes = auth === null ? [] : await mapleIdHashesToUnregister(account, account.apiKey)
    const unregistered =
      auth === null || mapleIdHashes.length === 0
        ? null
        : await unregisterSubAccountOnServer(sessionOf(auth.login), mapleIdHashes)
    if (auth === null || unregistered?.outcome !== 'sent') {
      useToastStore.getState().showError(REMOVE_FAILED_MESSAGE)
      return 'failed'
    }

    await removeApiKey(account.apiKey.value)
    await unmarkRegistered(auth.login.id, account.apiKey.value).catch(() => undefined)
    await untrackMapleIds(new Set(mapleIdHashes))
    // 해제한 부계정의 기록은 이 사람의 것이 아니다. 기록은 서버에 남고, 다시 등록하면 받기가 처음부터 받는다. 다음 받기가 그 메이플
    // ID 가 빠진 것을 보고 다시 비우므로 실패해도 키 삭제를 되돌리지 않는다.
    await forgetServerSyncMapleIds(mapleIdHashes).catch(() => undefined)

    void get().load()
    return 'removed'
  },
}))

/**
 * 다른 기기에서 해제한 부계정을 이 기기에서 뺀다. 동기화의 받기가 응답의 메이플 ID 목록에서 빠진 메이플 ID 를 넘긴다. 그 메이플 ID 를
 * 든 지금 로그인의 부계정 키를 지우고 그 계정의 추적 캐릭터를 뺀다. 남기면 동기화가 그 키를 다시 등록해 해제를 되돌린다.
 *
 * 서버의 등록은 이미 없어 해제를 부르지 않는다. 그 메이플 ID 의 기록은 받기가 비운다.
 *
 * @param mapleIdHashes 서버 목록에서 빠진 메이플 ID 해시
 */
export async function forgetReleasedSubAccounts(mapleIdHashes: ReadonlySet<string>): Promise<void> {
  const auth = await loginOf()
  if (auth === null) return
  const byAccount = await getMapleIdsByNexonAccount()
  const released = auth.config.apiKeys.filter(
    (key) => key.loginId === auth.login.id && (byAccount.get(key.id) ?? []).some((mapleId) => mapleIdHashes.has(nexonIdHashHex(mapleId))),
  )
  if (released.length === 0) return
  for (const key of released) {
    await removeApiKey(key.value)
    await unmarkRegistered(auth.login.id, key.value).catch(() => undefined)
  }
  await untrackMapleIds(mapleIdHashes)
  if (useAccountManageStore.getState().view !== null) void useAccountManageStore.getState().load()
}
