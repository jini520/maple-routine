// 올리기 · 받기의 서버 경로. 응답을 못 받은 것 · 요청 전체의 거절 · 읽을 수 있는 응답을 갈라야 동기화가 대기 줄과 번호를 맞게 다룬다.
import { pullSyncRecords, pushSyncRecords } from '../sync'

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

const RECORDS = [
  { table: 'mvpGradeHistory', action: 'upsert' as const, row: { id: 'mvp-1' } },
  { table: 'bossDrops', action: 'delete' as const, row: { id: 'drop-1' } },
]

function answer(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

it('신원 헤더와 기록 배열을 `POST /sync/push` 의 본문으로 보낸다', async () => {
  fetchMock.mockResolvedValueOnce(answer(200, { results: [] }))

  await pushSyncRecords({ 'x-maple-id-hash': 'h' }, RECORDS)

  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(url).toMatch(/\/sync\/push$/)
  expect(init.method).toBe('POST')
  expect(init.headers).toMatchObject({ 'x-maple-id-hash': 'h', 'content-type': 'application/json' })
  expect(JSON.parse(String(init.body))).toEqual({ records: RECORDS })
})

it('건마다의 결과를 보낸 차례대로 돌려준다', async () => {
  fetchMock.mockResolvedValueOnce(
    answer(200, {
      results: [
        { recordId: 'mvp-1', ok: true, id: 'mvp-server' },
        { recordId: 'drop-1', ok: false, code: 'record_deleted', reason: '다른 기기에서 지운 기록이다' },
      ],
    }),
  )

  await expect(pushSyncRecords({}, RECORDS)).resolves.toEqual({
    outcome: 'answered',
    results: [
      { ok: true, id: 'mvp-server' },
      { ok: false, code: 'record_deleted', reason: '다른 기기에서 지운 기록이다' },
    ],
  })
})

it('응답이 없으면 no-response, 2xx 가 아니면 상태 코드를 단 refused 다', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline'))
  await expect(pushSyncRecords({}, RECORDS)).resolves.toEqual({ outcome: 'no-response' })

  fetchMock.mockResolvedValueOnce(answer(401, { code: null }))
  await expect(pushSyncRecords({}, RECORDS)).resolves.toEqual({ outcome: 'refused', status: 401 })
})

// 결과를 차례로 짝짓는다. 수가 다르면 어느 결과가 어느 기록의 것인지 알 수 없다.
it('결과의 수가 보낸 수와 다르거나 모양이 틀리면 읽을 수 없는 본문으로 보고 refused 다', async () => {
  fetchMock.mockResolvedValueOnce(answer(200, { results: [{ ok: true, id: null }] }))
  await expect(pushSyncRecords({}, RECORDS)).resolves.toEqual({ outcome: 'refused', status: 200 })

  fetchMock.mockResolvedValueOnce(answer(200, { results: [{ ok: 'yes' }, { ok: true, id: null }] }))
  await expect(pushSyncRecords({}, RECORDS)).resolves.toEqual({ outcome: 'refused', status: 200 })
})

describe('받기', () => {
  const CURSORS = { nexonAccount: { id: 'account-1', changeSeq: 3 }, mapleIds: { ['a'.repeat(64)]: 5 } }
  const RESPONSE = {
    mapleIds: ['a'.repeat(64)],
    cursors: { nexonAccount: { id: 'account-1', changeSeq: 9 }, mapleIds: { ['a'.repeat(64)]: 9 } },
    purgedChangeSeq: 1828,
    hasMore: false,
    records: { mvpGradeHistory: [{ id: 'mvp-1', deletedAt: null }] },
  }

  it('신원 헤더와 번호를 `POST /sync/pull` 의 본문으로 보내고 응답을 그대로 돌려준다', async () => {
    fetchMock.mockResolvedValueOnce(answer(200, RESPONSE))

    await expect(pullSyncRecords({ 'x-maple-id-hash': 'h' }, CURSORS)).resolves.toEqual({ outcome: 'answered', response: RESPONSE })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/sync\/pull$/)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'x-maple-id-hash': 'h', 'content-type': 'application/json' })
    expect(JSON.parse(String(init.body))).toEqual({ cursors: CURSORS })
  })

  it('응답이 없으면 no-response, 2xx 가 아니면 상태 코드를 단 refused 다', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await expect(pullSyncRecords({}, CURSORS)).resolves.toEqual({ outcome: 'no-response' })

    fetchMock.mockResolvedValueOnce(answer(403, { code: 'account_deletion_pending' }))
    await expect(pullSyncRecords({}, CURSORS)).resolves.toEqual({ outcome: 'refused', status: 403 })
  })

  // 번호를 잘못 읽어 적으면 다음 받기가 엉뚱한 번호로 받아 줄을 놓친다.
  it('번호 · 목록 · 줄의 모양이 틀리면 읽을 수 없는 본문으로 보고 refused 다', async () => {
    for (const broken of [
      { ...RESPONSE, cursors: { mapleIds: {} } },
      { ...RESPONSE, cursors: { ...RESPONSE.cursors, mapleIds: { x: '9' } } },
      { ...RESPONSE, hasMore: 'no' },
      { ...RESPONSE, purgedChangeSeq: '3' },
      // 지운 번호를 싣지 않는 서버다. 없는 값을 null 로 읽으면 지운 줄을 놓친 주인을 비우지 못한다.
      { ...RESPONSE, purgedChangeSeq: undefined },
      { ...RESPONSE, records: { mvpGradeHistory: {} } },
      { ...RESPONSE, mapleIds: 'a' },
    ]) {
      fetchMock.mockResolvedValueOnce(answer(200, broken))
      await expect(pullSyncRecords({}, CURSORS)).resolves.toEqual({ outcome: 'refused', status: 200 })
    }
  })
})
