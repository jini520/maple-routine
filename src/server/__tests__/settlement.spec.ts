// 결산 판정을 우리 서버에 묻는 어댑터. `notices` 와 같은 자리, 같은 규칙이다.
//
// 여기가 지키는 것은 **못 받았으면 결산 중이라고 말하지 않는 것**이다. 실패를 결산 중으로 읽으면
// 넥슨이 멀쩡한 낮에도 안내 줄이 선다.
import { fetchSettlement } from '../settlement'

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

beforeEach(() => {
  jest.restoreAllMocks()
})

it('결산 중이면 시작 시각과 함께 준다', async () => {
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(ok({ settling: true, startedAt: '2026-09-16T15:30:00.000Z' }))

  await expect(fetchSettlement()).resolves.toEqual({
    settling: true,
    startedAt: '2026-09-16T15:30:00.000Z',
  })
})

it('결산 중이 아니면 시작 시각이 없다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok({ settling: false, startedAt: null }))

  await expect(fetchSettlement()).resolves.toEqual({ settling: false, startedAt: null })
})

it('우리 서버의 주소로 부른다', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(ok({ settling: false, startedAt: null }))

  await fetchSettlement()

  expect(String(spy.mock.calls[0][0])).toContain('mapleroutine.store/v1/settlement')
})

it('네트워크가 실패하면 null', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))

  await expect(fetchSettlement()).resolves.toBeNull()
})

it('5xx 도 null', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 502 } as Response)

  await expect(fetchSettlement()).resolves.toBeNull()
})

// 옛 서버는 이 경로를 모른다. 404 를 **결산 아님** 으로 읽어도 화면은 같지만, 모르는 것과 아닌 것을
// 가르는 편이 로그를 읽을 때 낫다.
it('계약을 어긴 응답은 null', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok({ settling: '네' }))

  await expect(fetchSettlement()).resolves.toBeNull()
})

// 결산 중이라면서 시작 시각을 안 주면 앱이 닫은 구간을 알아볼 열쇠가 없다. 그 응답은 못 쓴다.
it('결산 중인데 시작 시각이 없으면 null', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok({ settling: true, startedAt: null }))

  await expect(fetchSettlement()).resolves.toBeNull()
})
