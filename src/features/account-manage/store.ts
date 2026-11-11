/**
 * 계정 관리. 목록을 읽고, 부계정 키를 더하고 바꾸고 지운다.
 *
 * 앱은 서버가 지금 로그인에 준 부계정만 보이고 부른다. 그래서 더할 때는 서버 등록부터 하고, 지울 때도 서버의 등록부터 지운다.
 * 서버가 거절했는데 기기에 키를 두면 목록에 없는 키라 보이지도 않고, 기기에서만 지우면 다음에 받은 목록에 다시 선다.
 */
import { create } from 'zustand'

import { apiKeyHashHex } from '../../lib/crypto/api-key-hash'
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import { accountOfOcid } from '../../lib/mvp/membership'
import { isRegisteredSubAccountKey, type ServerSubAccount } from '../../lib/sub-account-keys'
import { randomUuid } from '../../native/uuid'
import { listSubAccountsOnServer, registerSubAccountOnServer, unregisterSubAccountOnServer } from '../../server/accounts'
import { addSubApiKey, getAuthConfig, removeApiKey, replaceApiKeyValue } from '../../storage/api-key'
import { getCharacterAccountSightings, getMapleIdsByNexonAccount } from '../../storage/character-accounts'
import { getTrackedCharacterOcids, setTrackedCharacterOcids } from '../../storage/character-selection'
import { getServerAccounts, setServerAccounts } from '../../storage/server-accounts'
import { getServerSubAccounts, setServerSubAccounts } from '../../storage/server-sub-accounts'
import type { NexonAuthConfig, NexonLoginMethod } from '../../types'
import { useAppEntryStore } from '../app-entry/store'
import { currentCredentials } from '../auth/current-credential'
import { formatAuthError } from '../auth/format'
import { reusableNexonAccountId } from '../auth/reentry-account-id'
import { useCharacterSelectionStore } from '../character-selection/store'
import {
  fetchCharacterListsCached,
  readCachedCharacterListOfAccount,
  recordCharacterList,
} from '../mvp-grade/character-list'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import { useToastStore } from '../toast/store'
import { buildAccountManageView, type AccountManageSources, type AccountManageView, type ManagedAccount } from './accounts'
import { checkApiKey, type KeyRejection } from './validate-key'

export type KeyActionResult =
  | { outcome: 'saved' }
  | { outcome: 'rejected'; reason: KeyRejection }
  /** 넥슨 계정이 이미 5개다 */
  | { outcome: 'limit' }
  /** 토스트로 이미 알렸다 */
  | { outcome: 'failed' }

export interface AccountManageStore {
  /** 읽기 전이면 `null` */
  view: AccountManageView | null
  /** 기기에 있는 값으로 먼저 세우고, 서버 목록과 캐릭터 목록을 받아 다시 세운다 */
  load(): Promise<void>
  addKey(apiKey: string): Promise<KeyActionResult>
  /**
   * 부계정의 키를 같은 넥슨 계정의 새 키로 바꾼다. 이 기기에 키가 없는 계정이면 새 키를 넣는다.
   *
   * @param accountKey 계정의 `key`
   */
  changeKey(accountKey: string, apiKey: string): Promise<KeyActionResult>
  /** 부계정을 지운다. 서버의 등록을 지우지 못하면 아무것도 지우지 않는다 */
  removeAccount(accountKey: string): Promise<'removed' | 'failed'>
}

const SAVED_MESSAGE = 'API 키를 확인했어요'
const REMOVE_FAILED_MESSAGE = 'API 키를 삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.'

function sessionOf(login: NexonLoginMethod): Record<string, string> {
  return { Authorization: `Bearer ${login.session}` }
}

async function readSources(): Promise<AccountManageSources> {
  const config = await getAuthConfig().catch(() => null)
  const [list, state, mapleIdsByAccount] = await Promise.all([
    getServerSubAccounts().catch(() => null),
    getServerAccounts().catch(() => ({ reported: {}, registered: [] as string[] })),
    getMapleIdsByNexonAccount().catch(() => new Map<string, string[]>()),
  ])
  const loginId = config?.login?.id
  return {
    config,
    subAccounts: list !== null && list.loginId === loginId ? list.subAccounts : null,
    registered: state.registered,
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

/** 지운 계정의 메이플 ID 에 속한 추적 캐릭터를 뺀다. 하나도 남지 않으면 앱을 쓸 수 없어 진입 단계를 다시 판정한다. */
async function untrackMapleIds(mapleIdHashes: ReadonlySet<string>): Promise<void> {
  const [tracked, sightings] = await Promise.all([getTrackedCharacterOcids(), getCharacterAccountSightings()])
  if (tracked === null) return
  const remaining = tracked.filter((ocid) => {
    const mapleId = accountOfOcid(sightings, ocid)
    return mapleId === null || !mapleIdHashes.has(nexonIdHashHex(mapleId))
  })
  if (remaining.length === tracked.length) return
  await setTrackedCharacterOcids(remaining)
  queryClient.setQueryData(queryKeys.trackedOcids(), remaining)
  await useCharacterSelectionStore.getState().reloadRepresentative()
  if (remaining.length === 0) await useAppEntryStore.getState().resolveFromStorage()
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

    const config = await getAuthConfig().catch(() => null)
    const login = config?.login
    if (login != null) {
      const listed = await listSubAccountsOnServer(sessionOf(login))
      if (listed.outcome === 'listed') {
        await setServerSubAccounts({ loginId: login.id, subAccounts: listed.subAccounts }).catch(() => undefined)
      }
    }
    // 대표 캐릭터 이름을 채운다. 5분 안에 받은 목록은 다시 부르지 않는다. 한 계정의 실패는 그 계정만 비운다.
    await fetchCharacterListsCached(await currentCredentials()).catch(() => undefined)
    set({ view: buildAccountManageView(await readSources()) })
  },

  async addKey(apiKey) {
    const view = get().view
    const auth = await loginOf()
    if (view === null || auth === null) return { outcome: 'failed' }
    if (!view.canAdd) return { outcome: 'limit' }

    const check = await checkApiKey(apiKey, { taken: otherHashes(view, null), target: null })
    if (check.outcome === 'rejected') return check
    if (check.outcome === 'failed') {
      useToastStore.getState().showError(formatAuthError(check.error))
      return { outcome: 'failed' }
    }

    // 서버 등록부터다. 다섯째를 거절당한 키를 기기에 두면 서버 목록에 없는 키가 된다. 응답이 없으면 기기에 두고 회차가 다시 등록한다.
    const registered = await registerSubAccountOnServer(sessionOf(auth.login), apiKeyHashHex(apiKey), check.mapleIdHashes)
    if (registered === 'limit') return { outcome: 'limit' }
    if (registered === 'same_account') return { outcome: 'rejected', reason: 'alreadyRegistered' }

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
    if (view == null || auth === null || account === undefined || account.kind !== 'subKey') return { outcome: 'failed' }

    // 바꾸는 계정은 겹침에서 빼고, 그 계정과는 겹쳐야 같은 넥슨 계정이다.
    const check = await checkApiKey(apiKey, { taken: otherHashes(view, account), target: account.mapleIdHashes })
    if (check.outcome === 'rejected') return check
    if (check.outcome === 'failed') {
      useToastStore.getState().showError(formatAuthError(check.error))
      return { outcome: 'failed' }
    }

    let accountId: string
    try {
      if (account.apiKey !== null) {
        // 같은 넥슨 계정 id 와 귀속을 그대로 쓴다. 그래서 그 계정의 추적 캐릭터와 기록이 이어진다.
        accountId = account.apiKey.id
        await replaceApiKeyValue(accountId, apiKey)
      } else {
        accountId = (await reusableNexonAccountId(check.accounts)) ?? randomUuid()
        await addSubApiKey(apiKey, auth.login.id, accountId)
      }
    } catch {
      useToastStore.getState().showError(formatAuthError({ kind: 'storageWriteFailed' }))
      return { outcome: 'failed' }
    }
    recordCharacterList(check.accounts, accountId)

    // 메이플 ID 가 같아 서버가 새 키를 같은 넥슨 계정 줄에 단다. 응답이 없으면 다음 회차가 다시 등록한다.
    const registered = await registerSubAccountOnServer(sessionOf(auth.login), apiKeyHashHex(apiKey), check.mapleIdHashes)
    if (registered === 'registered') await markRegistered(auth.login.id, apiKey).catch(() => undefined)

    useToastStore.getState().showSuccess(SAVED_MESSAGE)
    void get().load()
    return { outcome: 'saved' }
  },

  async removeAccount(accountKey) {
    const view = get().view
    const auth = await loginOf()
    const account = view?.accounts.find((one) => one.key === accountKey)
    if (auth === null || account === undefined || account.kind !== 'subKey') return 'failed'

    const state = await getServerAccounts().catch(() => ({ reported: {}, registered: [] as string[] }))
    const onServer =
      account.server !== null ||
      (account.apiKey !== null && isRegisteredSubAccountKey(account.apiKey, auth.login.id, state.registered))
    if (onServer) {
      const mapleIdHash = account.mapleIdHashes[0]
      const removed =
        mapleIdHash === undefined ? 'failed' : await unregisterSubAccountOnServer(sessionOf(auth.login), mapleIdHash)
      if (removed === 'failed') {
        useToastStore.getState().showError(REMOVE_FAILED_MESSAGE)
        return 'failed'
      }
    }

    if (account.apiKey !== null) {
      await removeApiKey(account.apiKey.value)
      const tag = `${auth.login.id}:${apiKeyHashHex(account.apiKey.value)}`
      await setServerAccounts({ ...state, registered: state.registered.filter((one) => one !== tag) }).catch(() => undefined)
    }
    const list = await getServerSubAccounts().catch(() => null)
    if (list !== null && list.loginId === auth.login.id && account.server !== null) {
      const gone: ServerSubAccount = account.server
      await setServerSubAccounts({ ...list, subAccounts: list.subAccounts.filter((one) => one.mapleIds[0] !== gone.mapleIds[0]) })
    }
    await untrackMapleIds(new Set(account.mapleIdHashes))

    void get().load()
    return 'removed'
  },
}))
