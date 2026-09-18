// 직접 완료를 연 보스를 우리 서버에 묻는 어댑터. `settlement` 와 같은 자리, 같은 규칙이다.
//
// 여기가 지키는 것은 **못 받았으면 열지 않는 것**이다. 실패를 빈 목록으로 읽으면 화면은 같아 보이지만
// (아무것도 안 열린다) 사본을 두는 쪽과 섞여 **서버가 닫았다** 와 **못 물어봤다** 가 한 값이 된다.
import { fetchManualCompletionBosses } from '../manual-completion'

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

beforeEach(() => {
  jest.restoreAllMocks()
})

it('열린 보스를 목록으로 준다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    ok({
      bosses: [
        { boss: 'black_mage', from: '2026-09-01' },
        { boss: 'meirin', from: '2026-09-17' },
      ],
    }),
  )

  await expect(fetchManualCompletionBosses()).resolves.toEqual([
    { boss: 'black_mage', from: '2026-09-01' },
    { boss: 'meirin', from: '2026-09-17' },
  ])
})

it('열린 보스가 없으면 빈 목록이다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok({ bosses: [] }))

  await expect(fetchManualCompletionBosses()).resolves.toEqual([])
})

it('우리 서버의 주소로 부른다', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(ok({ bosses: [] }))

  await fetchManualCompletionBosses()

  expect(String(spy.mock.calls[0][0])).toContain('mapleroutine.store/v1/manual-completion')
})

it('네트워크가 실패하면 null', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))

  await expect(fetchManualCompletionBosses()).resolves.toBeNull()
})

it('5xx 도 null', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 502 } as Response)

  await expect(fetchManualCompletionBosses()).resolves.toBeNull()
})

// 옛 서버는 이 경로를 모른다. 404 는 **아무것도 안 열렸다** 가 아니라 **못 물어봤다** 다.
it('계약을 어긴 응답은 null', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok({ bosses: '검은 마법사' }))

  await expect(fetchManualCompletionBosses()).resolves.toBeNull()
})

// 한 줄이 깨졌다고 나머지까지 버리면 서버가 필드를 늘리는 날 목록이 통째로 사라진다.
it('모양이 깨진 줄만 버린다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    ok({
      bosses: [
        { boss: 'black_mage', from: '2026-09-01' },
        { boss: 'meirin' },
        { from: '2026-09-17' },
        '메이린',
      ],
    }),
  )

  await expect(fetchManualCompletionBosses()).resolves.toEqual([
    { boss: 'black_mage', from: '2026-09-01' },
  ])
})
