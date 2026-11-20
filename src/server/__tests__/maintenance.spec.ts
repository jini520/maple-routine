// 우리 서버가 점검 중인지 묻는 어댑터. 서버가 아니라 nginx 가 파일 하나로 답한다.
//
// 여기가 지키는 것은 **모르는 것을 점검 중으로도 점검 아님으로도 읽지 않는 것**이다. 모름을 점검 중으로 읽으면 오프라인에서
// 앱이 잠기고, 점검 아님으로 읽으면 점검 중에 네트워크가 잠깐 끊긴 기기가 열린다.
import { fetchServerMaintenance } from '../maintenance'

/** 본문을 안 주면 JSON 이 아닌 응답이다. */
function answer(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('JSON 이 아니다')
      return body
    },
  } as Response
}

beforeEach(() => {
  jest.restoreAllMocks()
})

it('점검 중이면 종료 예정 시각을 함께 준다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(answer(200, { maintenance: true, until: '2026-12-02T06:00:00+09:00' }))

  await expect(fetchServerMaintenance()).resolves.toEqual({
    state: 'on',
    until: Date.parse('2026-12-01T21:00:00Z'),
  })
})

// 종료 예정 시각은 적지 않을 수 있다. 시각을 못 읽었다고 점검 중인 것까지 버리면 점검 중에 앱이 열린다.
it.each([null, undefined, '내일 새벽', 20261202])('종료 예정 시각이 %p 면 시각 없이 점검 중이다', async (until) => {
  jest.spyOn(global, 'fetch').mockResolvedValue(answer(200, { maintenance: true, until }))

  await expect(fetchServerMaintenance()).resolves.toEqual({ state: 'on', until: null })
})

// 404 는 nginx 설정을 넣기 전의 답이다. 그때는 이 경로가 서버로 넘어가고 서버는 이 경로를 모른다.
it.each([204, 404])('%p 는 점검이 아니다', async (status) => {
  jest.spyOn(global, 'fetch').mockResolvedValue(answer(status))

  await expect(fetchServerMaintenance()).resolves.toEqual({ state: 'off' })
})

// 공용 와이파이의 로그인 페이지는 어느 주소에나 200 을 준다.
it.each([
  ['JSON 이 아닌 200', answer(200)],
  ['표시가 없는 200', answer(200, { until: '2026-12-02T06:00:00+09:00' })],
  ['표시가 참이 아닌 200', answer(200, { maintenance: 'true' })],
  ['배열인 200', answer(200, [])],
  // nginx 는 속도 제한에 걸린 요청에도 503 을 낸다.
  ['503', answer(503)],
  ['502', answer(502)],
])('%s 은 모름이다', async (_name, response) => {
  jest.spyOn(global, 'fetch').mockResolvedValue(response)

  await expect(fetchServerMaintenance()).resolves.toEqual({ state: 'unknown' })
})

it('응답이 없으면 모름이다', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))

  await expect(fetchServerMaintenance()).resolves.toEqual({ state: 'unknown' })
})
