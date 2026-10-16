// 게임 데이터 표 전부를 우리 서버에 묻는 어댑터. `settlement` 와 같은 자리, 같은 규칙이다.
//
// 여기가 지키는 것은 **못 받았으면 표를 안 바꾸는 것**이다. 응답 전체가 아니라 칸마다 본다. 칸 하나가
// 계약을 어기면 그 칸만 null 이고 나머지 칸은 쓴다.
import { fetchGameData } from '../game-data'

const 보스표 = {
  updatedAt: '2026-10-15T01:00:00.000Z',
  rules: { weeklyBossSelectionLimit: 12, weeklyCrystalSaleLimit: 90 },
  bosses: [
    {
      key: 'lotus',
      name: '스우',
      alias: '스우',
      cycle: 'weekly',
      portraitSlug: 'lotus',
      difficulties: [{ difficulty: 'normal', requiredLevel: 190 }],
    },
  ],
}

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

beforeEach(() => {
  jest.restoreAllMocks()
})

it('칸마다 받은 표를 그대로 준다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok({ bosses: 보스표 }))

  await expect(fetchGameData()).resolves.toEqual({ bosses: 보스표 })
})

it('우리 서버의 game-data 주소로 부른다', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(ok({ bosses: 보스표 }))

  await fetchGameData()

  expect(String(spy.mock.calls[0][0])).toContain('mapleroutine.store/v1/game-data')
})

it('네트워크가 실패하면 null', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))

  await expect(fetchGameData()).resolves.toBeNull()
})

it('5xx 도 null', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 502 } as Response)

  await expect(fetchGameData()).resolves.toBeNull()
})

it('응답이 객체가 아니면 null', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok('표'))

  await expect(fetchGameData()).resolves.toBeNull()
})

it('계약을 어긴 칸은 그 칸만 null 이다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok({ bosses: { ...보스표, bosses: [{ key: 'lotus' }] } }))

  await expect(fetchGameData()).resolves.toEqual({ bosses: null })
})

it('칸이 없으면 그 칸은 null 이다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok({}))

  await expect(fetchGameData()).resolves.toEqual({ bosses: null })
})

// 아직 한 번도 안 넣은 표의 모양이다. 쓸 것이 없으니 들고 있던 사본 그대로다.
it('updatedAt 이 null 인 칸(서버가 아직 비었다)은 null 이다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    ok({
      bosses: { updatedAt: null, rules: { weeklyBossSelectionLimit: null, weeklyCrystalSaleLimit: null }, bosses: [] },
    }),
  )

  await expect(fetchGameData()).resolves.toEqual({ bosses: null })
})
