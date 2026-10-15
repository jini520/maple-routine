// 보스 표를 우리 서버에 묻는 어댑터. `settlement` 와 같은 자리, 같은 규칙이다.
//
// 여기가 지키는 것은 **못 받았으면 표를 안 바꾸는 것**이다. 실패를 빈 표로 읽으면 서버가 죽은 날
// 보스 목록이 비고, 그 빈 목록이 기록을 못 세우게 한다.
import { fetchBossCatalog } from '../bosses'

const 응답 = {
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

it('받은 표를 그대로 준다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok(응답))

  await expect(fetchBossCatalog()).resolves.toEqual(응답)
})

it('우리 서버의 주소로 부른다', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(ok(응답))

  await fetchBossCatalog()

  expect(String(spy.mock.calls[0][0])).toContain('mapleroutine.store/v1/bosses')
})

it('네트워크가 실패하면 null', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))

  await expect(fetchBossCatalog()).resolves.toBeNull()
})

it('5xx 도 null', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 502 } as Response)

  await expect(fetchBossCatalog()).resolves.toBeNull()
})

it('계약을 어긴 응답은 null', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok({ ...응답, bosses: [{ key: 'lotus' }] }))

  await expect(fetchBossCatalog()).resolves.toBeNull()
})

// 아직 한 번도 안 넣은 서버의 모양이다. 쓸 것이 없으니 들고 있던 사본 그대로다.
it('updatedAt 이 null 이면(서버가 아직 비었다) null', async () => {
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(ok({ updatedAt: null, rules: { weeklyBossSelectionLimit: null, weeklyCrystalSaleLimit: null }, bosses: [] }))

  await expect(fetchBossCatalog()).resolves.toBeNull()
})
