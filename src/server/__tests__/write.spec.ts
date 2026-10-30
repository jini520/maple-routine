// 서버로 보내는 쓰기 호출. 응답을 못 받은 것과 거절을 갈라야 오프라인 동안 시도 횟수가 안 탄다.
import { postBatch, writeCall } from '../write'

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

it('응답이 없으면 no-response, 2xx 가 아니면 상태 코드를 단 rejected 다', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline'))
  await expect(writeCall('/x', { method: 'POST' })).resolves.toEqual({ outcome: 'no-response' })

  fetchMock.mockResolvedValueOnce({ ok: false, status: 400 })
  await expect(writeCall('/x', { method: 'POST' })).resolves.toEqual({ outcome: 'rejected', status: 400 })
})

// 묶음은 건마다 결과를 돌려받아 실패한 건만 대기 표로 보낸다. 결과 목록이 없으면 무엇이 들어갔는지 알 수 없다.
it('묶음은 /batch 로 items 를 보내고 건마다의 결과를 돌려준다. 결과가 없으면 거절로 본다', async () => {
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ results: [{ recordId: 'a', ok: true }] }) })

  await expect(postBatch({ h: '1' }, '/drop-prices', [{ id: 'a' }])).resolves.toEqual({
    outcome: 'sent',
    results: [{ recordId: 'a', ok: true }],
  })
  expect(fetchMock).toHaveBeenCalledWith(
    'https://mapleroutine.store/v1/drop-prices/batch',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ items: [{ id: 'a' }] }) }),
  )

  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
  await expect(postBatch({}, '/drop-prices', [{}])).resolves.toEqual({ outcome: 'rejected', status: 200 })
})
