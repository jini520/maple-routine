// 드롭 시세 공개 조회 셋. 서버가 하루 한 번 만들어 저장한 응답을 받는다.
//
// 여기가 지키는 것은 두 가지다. 가진 응답의 ETag 를 보내 바뀐 것이 없으면 몸 없이 끝내는 것, 그리고 계약을 어긴 값이
// 화면까지 흘러가지 않게 하는 것이다. 목록에서 줄 하나가 어기면 그 줄만 빠진다.
import { fetchMarketItem, fetchMarketItems, fetchMaspi } from '../market'

const 줄 = {
  itemKey: 'restraint_ring',
  ringLevel: 4,
  price: 3_300_000_000,
  changePct: 0.3,
  low: 3_200_000_000,
  high: 3_400_000_000,
  grade: 'many',
  spark: [3_250_000_000, 3_300_000_000],
}

function ok(body: unknown, etag: string | null = '"e1"'): Response {
  const text = JSON.stringify(body)
  return {
    status: 200,
    headers: { get: (name: string) => (name.toLowerCase() === 'etag' ? etag : null) },
    text: async () => text,
  } as unknown as Response
}

beforeEach(() => {
  jest.restoreAllMocks()
})

it('MASPI 는 날짜 · 종가 · 전일 대비 · 날마다 값을 주고, 낸 값이 없으면 종가가 null 이다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    ok({ date: '2026-11-15', close: 9119, change: 36.7, series: [{ date: '2026-11-15', value: 9119 }] }),
  )
  await expect(fetchMaspi(null)).resolves.toEqual({
    kind: 'ok',
    etag: '"e1"',
    body: { date: '2026-11-15', close: 9119, change: 36.7, series: [{ date: '2026-11-15', value: 9119 }] },
  })

  jest.spyOn(global, 'fetch').mockResolvedValue(ok({ date: null, close: null, change: null, series: [] }))
  await expect(fetchMaspi(null)).resolves.toMatchObject({ body: { date: null, close: null, series: [] } })
})

it('가진 ETag 를 If-None-Match 로 보내고, 304 면 바뀐 것이 없다고 준다', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ status: 304 } as Response)

  await expect(fetchMaspi('"e1"')).resolves.toEqual({ kind: 'not-modified' })
  expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).headers).toEqual({ 'If-None-Match': '"e1"' })
})

it('목록에서 계약을 어긴 줄만 빼고, 모르는 등급도 그 줄을 뺀다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(
    ok({
      date: '2026-11-15',
      equipment: [줄, { ...줄, itemKey: 'broken', price: '33억' }, { ...줄, itemKey: 'odd', grade: 'lots' }],
      consumable: { world: 'scania', items: [{ ...줄, itemKey: 'life_whetstone', ringLevel: null, changePct: null }] },
    }),
  )

  const result = await fetchMarketItems('scania', null)

  expect(result).toMatchObject({ kind: 'ok' })
  if (result?.kind !== 'ok') throw new Error('받지 못했다')
  expect(result.body.equipment.map((entry) => entry.itemKey)).toEqual(['restraint_ring'])
  expect(result.body.consumable.items).toEqual([{ ...줄, itemKey: 'life_whetstone', ringLevel: null, changePct: null }])
})

it('7일 표가 모자라 범위가 없는 줄과 날은 low · high 가 null 로 오고, 빼지 않고 그대로 받는다', async () => {
  const 범위없음 = { ...줄, itemKey: 'life_whetstone', ringLevel: null, low: null, high: null }
  jest.spyOn(global, 'fetch').mockResolvedValue(
    ok({ date: '2026-11-15', equipment: [], consumable: { world: 'scania', items: [범위없음] } }),
  )
  await expect(fetchMarketItems('scania', null)).resolves.toMatchObject({ body: { consumable: { items: [범위없음] } } })

  const series = [
    { date: '2026-11-14', price: 760_000_000, low: 740_000_000, high: 770_000_000 },
    { date: '2026-11-15', price: 750_000_000, low: null, high: null },
  ]
  const { spark: _spark, ...head } = 범위없음
  jest.spyOn(global, 'fetch').mockResolvedValue(ok({ date: '2026-11-15', ...head, series }))
  await expect(fetchMarketItem({ itemKey: 'life_whetstone', ringLevel: null, world: 'scania' }, null)).resolves.toMatchObject({
    body: { low: null, high: null, series },
  })
})

it('그 월드의 시세가 없어 404 면 없다고 주고, 다른 실패와 계약을 어긴 몸은 null 이다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ status: 404 } as Response)
  await expect(fetchMarketItems('special', null)).resolves.toEqual({ kind: 'missing' })

  jest.spyOn(global, 'fetch').mockResolvedValue({ status: 502 } as Response)
  await expect(fetchMarketItems('scania', null)).resolves.toBeNull()

  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))
  await expect(fetchMaspi(null)).resolves.toBeNull()

  jest.spyOn(global, 'fetch').mockResolvedValue(ok({ date: '2026-11-15', close: '9119' }))
  await expect(fetchMaspi(null)).resolves.toBeNull()
})

it('상세는 아이템 key 와 반지 레벨 · 월드로 부르고, 날마다 값을 준다. 반지가 아니면 ring 을 비워 보낸다', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
    ok({
      date: '2026-11-15',
      itemKey: 'magic_eyepatch',
      ringLevel: null,
      price: 2_600_000_000,
      changePct: -7.8,
      low: 2_500_000_000,
      high: 2_800_000_000,
      grade: 'normal',
      series: [{ date: '2026-11-15', price: 2_600_000_000, low: 2_500_000_000, high: 2_800_000_000 }],
    }),
  )

  const result = await fetchMarketItem({ itemKey: 'magic_eyepatch', ringLevel: null, world: 'scania' }, null)

  expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://mapleroutine.store/v1/market/items/magic_eyepatch?ring=&world=scania')
  expect(result).toMatchObject({ kind: 'ok', body: { grade: 'normal', series: [{ date: '2026-11-15', price: 2_600_000_000 }] } })
})
