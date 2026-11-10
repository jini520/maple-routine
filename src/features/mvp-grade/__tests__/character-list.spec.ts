jest.mock('../../../nexon/character', () => ({ fetchCharacterList: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ recordCharacterAccounts: jest.fn(async () => undefined) }))
jest.mock('../../auth/current-credential', () => ({ currentCredential: jest.fn(), currentCredentials: jest.fn() }))

import type { NexonCredential } from '../../../types/auth'
import { queryClient } from '../../query/client'
import { loadAccountIdentities } from '../accounts'
import {
  CHARACTER_LIST_TTL_MS,
  dropLegacyCharacterLists,
  fetchCharacterListCached,
  fetchCharacterListsCached,
  readCachedCharacterLists,
} from '../character-list'

const { fetchCharacterList: fetchMock } = jest.requireMock('../../../nexon/character') as Record<string, jest.Mock>
const { currentCredential, currentCredentials } = jest.requireMock('../../auth/current-credential') as Record<string, jest.Mock>

const KEY_A: NexonCredential = { type: 'key', value: 'key-a', accountId: 'acc-a' }
const KEY_B: NexonCredential = { type: 'key', value: 'key-b', accountId: 'acc-b' }
const NOW = new Date('2026-10-31T05:00:00.000Z')

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
  queryClient.clear()
  fetchMock.mockReset().mockResolvedValue([{ accountId: 'acc-a', characters: [] }])
  currentCredential.mockResolvedValue(KEY_A)
  currentCredentials.mockResolvedValue([KEY_A])
})

afterEach(() => {
  jest.useRealTimers()
})

// 캐릭터 관리에 들어가면 계정 목록과 후보 목록이 잇달아 묻는다. 전에는 그때마다 두 번 나갔다(#812 E).
it('5분 안의 두 호출은 `character/list` 를 한 번만 부른다', async () => {
  await fetchCharacterListCached(KEY_A)
  await fetchCharacterListCached(KEY_A)

  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('5분이 지나면 다시 받고, 다시 시도는 안에서도 받는다', async () => {
  await fetchCharacterListCached(KEY_A)
  jest.setSystemTime(new Date(NOW.getTime() + CHARACTER_LIST_TTL_MS + 1))
  await fetchCharacterListCached(KEY_A)
  expect(fetchMock).toHaveBeenCalledTimes(2)

  await fetchCharacterListCached(KEY_A, { force: true })
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

// 등급을 물을 ID 는 로컬로 정해지고 이 목록은 이름 · 초상 표시에만 쓴다. 전에는 복귀마다 회차와 따로 한 번 더 나갔다.
it('MVP 등급의 ID 표시는 회차 · 캐릭터 관리와 같은 응답을 쓴다', async () => {
  await fetchCharacterListCached(KEY_A)
  await loadAccountIdentities(['acc-a'])

  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('자격이 다르면 다른 목록이라 각자 받는다', async () => {
  await fetchCharacterListCached(KEY_A)
  await fetchCharacterListCached(KEY_B)

  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('실패는 그대로 던지고 다음 호출이 다시 받는다', async () => {
  fetchMock.mockRejectedValueOnce(new Error('401'))

  await expect(fetchCharacterListCached(KEY_A)).rejects.toThrow('401')
  await fetchCharacterListCached(KEY_A)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

// 열쇠에 키 값을 넣으면 기기 캐시에 키가 한 벌 더 저장된다. 같은 계정의 키를 다시 받으면 옛 캐시가 주인 없이 남는다.
it('목록 캐시의 열쇠에 키 값이 들어가지 않고, 같은 넥슨 계정의 새 키는 같은 목록을 쓴다', async () => {
  await fetchCharacterListCached(KEY_A)
  await fetchCharacterListCached({ type: 'key', value: 'key-a-다시받음', accountId: 'acc-a' })

  expect(fetchMock).toHaveBeenCalledTimes(1)
  const keys = queryClient.getQueryCache().getAll().map((query) => JSON.stringify(query.queryKey))
  expect(keys.some((key) => key.includes('key-a'))).toBe(false)
})

it('옛 열쇠로 남은 목록만 걷는다', async () => {
  queryClient.setQueryData(['character-list', 'key:옛키값'], [])
  queryClient.setQueryData(['character-list', 'login:옛계정'], [])
  await fetchCharacterListCached(KEY_A)

  dropLegacyCharacterLists()

  const keys = queryClient.getQueryCache().getAll().map((query) => query.queryKey[1])
  expect(keys).toEqual(['account:acc-a'])
})

// 넥슨 계정마다 목록을 따로 받는다. 한 계정의 실패로 다른 계정의 캐릭터까지 멈추면 안 된다.
describe('넥슨 계정이 여럿', () => {
  it('계정마다 받고, 실패한 계정은 실패를 들고 다른 계정의 목록은 그대로 낸다', async () => {
    fetchMock.mockImplementation(async (credential: NexonCredential) => {
      if (credential.accountId === 'acc-b') throw new Error('401')
      return [{ accountId: 'maple-a', characters: [] }]
    })

    const lists = await fetchCharacterListsCached([KEY_A, KEY_B])

    expect(lists.map((one) => [one.credential.accountId, one.accounts, String(one.error ?? '')])).toEqual([
      ['acc-a', [{ accountId: 'maple-a', characters: [] }], ''],
      ['acc-b', null, 'Error: 401'],
    ])
  })

  it('받아 둔 목록은 계정마다 이어서 읽고, 하나도 없으면 undefined 다', async () => {
    expect(readCachedCharacterLists([KEY_A, KEY_B])).toBeUndefined()
    fetchMock.mockImplementation(async (credential: NexonCredential) => [{ accountId: `maple-${credential.accountId}`, characters: [] }])
    await fetchCharacterListsCached([KEY_A, KEY_B])

    expect(readCachedCharacterLists([KEY_A, KEY_B])?.map((account) => account.accountId)).toEqual(['maple-acc-a', 'maple-acc-b'])
  })

  it('MVP 등급의 ID 표시는 부계정의 메이플 ID 도 계정의 목록으로 그린다', async () => {
    currentCredentials.mockResolvedValue([KEY_A, KEY_B])
    const 캐릭터 = { ocid: 'o-b', name: '부캐', world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 }
    fetchMock.mockImplementation(async (credential: NexonCredential) =>
      credential.accountId === 'acc-b' ? [{ accountId: 'maple-b', characters: [캐릭터] }] : [{ accountId: 'maple-a', characters: [] }],
    )

    const identities = await loadAccountIdentities(['maple-b'])

    expect(identities.get('maple-b')?.summary?.representative.ocid).toBe('o-b')
  })
})
