// 메이플 ID 알리기와 부계정 등록. 서버의 주소 · 본문 · 409 의 code 와 어긋나면 계정이 이어지지 않아 기록이 늘 거절된다.
import {
  listSubAccountsOnServer,
  registerSubAccountOnServer,
  reportMapleIdsToServer,
  unregisterSubAccountOnServer,
} from '../accounts'

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

it('메이플 ID 해시를 그 신원으로 PUT 하고, 서버가 돌려준 목록을 받는다', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ mapleIds: ['h1', 'h2'] }) })

  await expect(reportMapleIdsToServer({ 'x-api-key-hash': 'k' }, ['h1'])).resolves.toEqual({ outcome: 'sent', mapleIds: ['h1', 'h2'] })
  expect(fetchMock).toHaveBeenCalledWith(
    'https://mapleroutine.store/v1/me/maple-ids',
    expect.objectContaining({
      method: 'PUT',
      headers: { 'x-api-key-hash': 'k', 'content-type': 'application/json' },
      body: JSON.stringify({ mapleIds: ['h1'] }),
    }),
  )
})

it('알리기는 응답이 없으면 no-response, 거절이나 모양이 다른 답이면 rejected 다', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline'))
  await expect(reportMapleIdsToServer({}, ['h1'])).resolves.toEqual({ outcome: 'no-response' })

  fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) })
  await expect(reportMapleIdsToServer({}, ['h1'])).resolves.toEqual({ outcome: 'rejected', status: 400 })

  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
  await expect(reportMapleIdsToServer({}, ['h1'])).resolves.toEqual({ outcome: 'rejected', status: 200 })
})

// 같은 넥슨 ID 는 다시 보내도 늘 거절되고, 한도는 다른 부계정을 지우면 풀린다. 둘을 갈라야 앞의 것만 다시 안 보낸다.
it('부계정 등록은 세션으로 키 해시 · 메이플 ID 해시를 보내고, 409 의 code 를 가른다', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => { throw new Error('빈 본문') } })
  await expect(registerSubAccountOnServer({ Authorization: 'Bearer S' }, 'kh', ['h1'])).resolves.toBe('registered')
  expect(fetchMock).toHaveBeenCalledWith(
    'https://mapleroutine.store/v1/me/sub-accounts',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ apiKeyHash: 'kh', mapleIds: ['h1'] }) }),
  )

  fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ code: 'same_account' }) })
  await expect(registerSubAccountOnServer({}, 'kh', ['h1'])).resolves.toBe('same_account')

  fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ code: 'sub_account_limit' }) })
  await expect(registerSubAccountOnServer({}, 'kh', ['h1'])).resolves.toBe('limit')

  fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
  await expect(registerSubAccountOnServer({}, 'kh', ['h1'])).resolves.toBe('failed')

  fetchMock.mockRejectedValueOnce(new Error('offline'))
  await expect(registerSubAccountOnServer({}, 'kh', ['h1'])).resolves.toBe('failed')
})

// 계정 관리가 서버 목록으로 이 기기에 키가 없는 계정까지 세운다. 답의 모양이 다르면 목록을 못 받은 것으로 보고 마지막 목록을 쓴다.
it('부계정 목록은 세션으로 GET 하고, 줄마다 키 해시와 메이플 ID 해시를 받는다', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ subAccounts: [{ apiKeyHashes: ['s1'], mapleIds: ['h1', 'h2'] }, { apiKeyHashes: 3, mapleIds: [] }] }),
  })
  await expect(listSubAccountsOnServer({ Authorization: 'Bearer S' })).resolves.toEqual({
    outcome: 'listed',
    subAccounts: [{ apiKeyHashes: ['s1'], mapleIds: ['h1', 'h2'] }],
  })
  expect(fetchMock).toHaveBeenCalledWith(
    'https://mapleroutine.store/v1/me/sub-accounts',
    expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer S' } }),
  )

  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
  await expect(listSubAccountsOnServer({})).resolves.toEqual({ outcome: 'failed' })

  fetchMock.mockRejectedValueOnce(new Error('offline'))
  await expect(listSubAccountsOnServer({})).resolves.toEqual({ outcome: 'failed' })
})

it('부계정 지우기는 메이플 ID 해시를 주소에 넣어 DELETE 하고, 받았는지만 가른다', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => { throw new Error('빈 본문') } })
  await expect(unregisterSubAccountOnServer({ Authorization: 'Bearer S' }, 'h1')).resolves.toBe('removed')
  expect(fetchMock).toHaveBeenCalledWith(
    'https://mapleroutine.store/v1/me/sub-accounts/h1',
    expect.objectContaining({ method: 'DELETE', headers: { Authorization: 'Bearer S' } }),
  )

  fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
  await expect(unregisterSubAccountOnServer({}, 'h1')).resolves.toBe('failed')

  fetchMock.mockRejectedValueOnce(new Error('offline'))
  await expect(unregisterSubAccountOnServer({}, 'h1')).resolves.toBe('failed')
})
