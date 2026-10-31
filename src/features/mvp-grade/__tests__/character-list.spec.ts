jest.mock('../../../nexon/character', () => ({ fetchCharacterList: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ recordCharacterAccounts: jest.fn(async () => undefined) }))
jest.mock('../../auth/current-credential', () => ({ currentCredential: jest.fn() }))

import type { NexonCredential } from '../../../types/auth'
import { queryClient } from '../../query/client'
import { loadAccountIdentities } from '../accounts'
import { CHARACTER_LIST_TTL_MS, fetchCharacterListCached } from '../character-list'

const { fetchCharacterList: fetchMock } = jest.requireMock('../../../nexon/character') as Record<string, jest.Mock>
const { currentCredential } = jest.requireMock('../../auth/current-credential') as Record<string, jest.Mock>

const KEY_A: NexonCredential = { type: 'key', value: 'key-a', accountId: 'acc-a' }
const KEY_B: NexonCredential = { type: 'key', value: 'key-b', accountId: 'acc-b' }
const NOW = new Date('2026-10-31T05:00:00.000Z')

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
  queryClient.clear()
  fetchMock.mockReset().mockResolvedValue([{ accountId: 'acc-a', characters: [] }])
  currentCredential.mockResolvedValue(KEY_A)
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
