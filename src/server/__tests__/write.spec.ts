// 서버로 보내는 쓰기 호출. 응답을 못 받은 것과 거절을 갈라야 오프라인 동안 시도 횟수가 안 탄다.
import { writeCall } from '../write'

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
