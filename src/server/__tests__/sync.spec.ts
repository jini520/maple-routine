// 올리기의 서버 경로. 응답을 못 받은 것 · 요청 전체의 거절 · 건마다의 결과를 갈라야 회차가 대기 줄을 맞게 다룬다.
import { pushSyncRecords } from '../sync'

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
