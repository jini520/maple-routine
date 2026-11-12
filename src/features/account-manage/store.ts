/**
 * 계정 관리. 목록을 읽고, 부계정 키를 더하고 바꾸고 지운다.
 *
 * 부계정은 기기마다 따로 관리하고, 서버는 어느 키가 그 사람의 부계정인지만 적는다. 그래서 지울 때는 서버에 묻지 않고 등록 정보를 남긴다.
 */
import { create } from 'zustand'

import { apiKeyHashHex } from '../../lib/crypto/api-key-hash'
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import { accountOfOcid } from '../../lib/mvp/membership'
import { randomUuid } from '../../native/uuid'
import { registerSubAccountOnServer } from '../../server/accounts'
import { addSubApiKey, getAuthConfig, removeApiKey, replaceApiKeyValue } from '../../storage/api-key'
import { getCharacterAccountSightings, getMapleIdsByNexonAccount } from '../../storage/character-accounts'
import { getTrackedCharacterOcids, setTrackedCharacterOcids } from '../../storage/character-selection'
import { getServerAccounts, setServerAccounts } from '../../storage/server-accounts'
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
  /** 이 기기의 넥슨 계정이 이미 5개다 */
  | { outcome: 'limit' }
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
  /** 이 기기에서 부계정을 지운다 */
  removeAccount(accountKey: string): Promise<'removed' | 'failed'>
}

const SAVED_MESSAGE = 'API 키를 확인했어요'

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

    // 서버 등록부터다. 기기가 로그인의 메이플 ID 를 다 알지 못하면 같은 넥슨 ID 를 서버만 알아본다. 받지 못하면 기기에 두고 회차가 다시 등록한다.
    const registered = await registerSubAccountOnServer(sessionOf(auth.login), apiKeyHashHex(apiKey), check.mapleIdHashes)
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

    // 같은 넥슨 계정 id 와 귀속을 그대로 쓴다. 그래서 그 계정의 추적 캐릭터와 기록이 이어진다.
    const accountId = account.apiKey.id
    try {
      await replaceApiKeyValue(accountId, apiKey)
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
    const account = get().view?.accounts.find((one) => one.key === accountKey)
    if (account === undefined || account.kind !== 'subKey' || account.apiKey === null) return 'failed'

    // 서버의 등록 정보는 남긴다. 같은 키를 다른 기기에서 계속 쓰면 그 기기의 기록이 이 사람에게 이어져야 한다.
    await removeApiKey(account.apiKey.value)
    await untrackMapleIds(new Set(account.mapleIdHashes))

    void get().load()
    return 'removed'
  },
}))
