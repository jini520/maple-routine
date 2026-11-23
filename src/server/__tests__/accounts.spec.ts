// 메이플 ID 알리기와 부계정 등록 · 해제. 서버의 주소 · 본문 · 409 의 code 와 어긋나면 계정이 이어지지 않아 기록이 늘 거절된다.
import { registerSubAccountOnServer, reportMapleIdsToServer, unregisterSubAccountOnServer } from '../accounts'

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

it('메이플 ID 해시를 그 신원으로 PUT 하고, 서버가 돌려준 목록을 받는다', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ mapleIds: ['h1', 'h2'] }) })

  await expect(reportMapleIdsToServer({ 'x-maple-id-hash': 'm' }, ['h1'])).resolves.toEqual({ outcome: 'sent', mapleIds: ['h1', 'h2'] })
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.mapleroutine.store/v1/me/maple-ids',
    expect.objectContaining({
      method: 'PUT',
      headers: { 'x-maple-id-hash': 'm', 'content-type': 'application/json' },
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

// 1.0.15 서버는 부계정을 메이플 ID 로 찾고 키 해시를 받지 않는다. 키는 다시 받으면 바뀌지만 메이플 ID 는 안 바뀐다.
it('부계정 등록은 세션으로 메이플 ID 해시만 보내고 키 해시는 싣지 않는다', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => { throw new Error('빈 본문') } })

  await expect(registerSubAccountOnServer({ Authorization: 'Bearer S' }, ['h1'])).resolves.toBe('registered')
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.mapleroutine.store/v1/me/sub-accounts',
    expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer S', 'content-type': 'application/json' },
      body: JSON.stringify({ mapleIds: ['h1'] }),
    }),
  )
})

// 거절마다 모달의 안내가 다르다. 그 밖의 실패와 갈라야 응답이 없을 때만 기기에 두고 회차가 다시 등록한다.
it.each(['same_account', 'registered_elsewhere', 'has_sub_accounts', 'login_is_sub_account'])(
  '부계정 등록의 409 %s 는 그 코드로 돌려준다',
  async (code) => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ code }) })

    await expect(registerSubAccountOnServer({}, ['h1'])).resolves.toBe(code)
  },
)

it('부계정 등록은 모르는 코드 · 다른 상태 · 응답 없음을 실패로 본다', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ code: 'duplicate_record' }) })
  await expect(registerSubAccountOnServer({}, ['h1'])).resolves.toBe('failed')

  fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
  await expect(registerSubAccountOnServer({}, ['h1'])).resolves.toBe('failed')

  fetchMock.mockRejectedValueOnce(new Error('offline'))
  await expect(registerSubAccountOnServer({}, ['h1'])).resolves.toBe('failed')
})

// 해제가 서버에 닿았는지로 기기의 키를 지울지 정한다. 응답이 없는 것과 거절을 갈라 돌려준다.
it('부계정 해제는 같은 몸을 DELETE 로 보내고, 응답이 왔는지 거절인지를 가른다', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 204 })
  await expect(unregisterSubAccountOnServer({ Authorization: 'Bearer S' }, ['h1', 'h2'])).resolves.toEqual({ outcome: 'sent' })
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.mapleroutine.store/v1/me/sub-accounts',
    expect.objectContaining({
      method: 'DELETE',
      headers: { Authorization: 'Bearer S', 'content-type': 'application/json' },
      body: JSON.stringify({ mapleIds: ['h1', 'h2'] }),
    }),
  )

  fetchMock.mockResolvedValueOnce({ ok: false, status: 401 })
  await expect(unregisterSubAccountOnServer({}, ['h1'])).resolves.toEqual({ outcome: 'rejected', status: 401 })

  fetchMock.mockRejectedValueOnce(new Error('offline'))
  await expect(unregisterSubAccountOnServer({}, ['h1'])).resolves.toEqual({ outcome: 'no-response' })
})
