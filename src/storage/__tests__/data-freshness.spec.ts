import { installFakePreferences } from './fake-preferences'
import { getDataFetchedAt, setDataFetchedAt } from '../data-freshness'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('dataFetchedAt')
})

describe('페이지별 데이터 호출 시각', () => {
  it('적은 적이 없으면 빈 맵', async () => {
    await expect(getDataFetchedAt()).resolves.toEqual({})
  })

  it('적은 것을 읽는다', async () => {
    await setDataFetchedAt('today', '2026-09-08T05:03:22.000Z')

    await expect(getDataFetchedAt()).resolves.toEqual({ today: '2026-09-08T05:03:22.000Z' })
  })

  // 한 칸에 다섯이 함께 산다. 한 페이지를 적을 때 나머지가 날아가면 안 된다.
  it('한 페이지를 적어도 나머지는 남는다', async () => {
    await setDataFetchedAt('today', '2026-09-08T05:00:00.000Z')
    await setDataFetchedAt('cashbook', '2026-09-08T06:00:00.000Z')

    await expect(getDataFetchedAt()).resolves.toEqual({
      today: '2026-09-08T05:00:00.000Z',
      cashbook: '2026-09-08T06:00:00.000Z',
    })
  })

  it('같은 페이지를 다시 적으면 덮는다', async () => {
    await setDataFetchedAt('today', '2026-09-08T05:00:00.000Z')
    await setDataFetchedAt('today', '2026-09-08T07:00:00.000Z')

    await expect(getDataFetchedAt()).resolves.toEqual({ today: '2026-09-08T07:00:00.000Z' })
  })

  it('깨진 값이면 빈 맵', async () => {
    await prefs.set('dataFetchedAt', '{정상적인 JSON 이 아니다')

    await expect(getDataFetchedAt()).resolves.toEqual({})
  })

  // 페이지 목록이 줄어든 뒤에도 옛 키가 남아 있을 수 있다.
  it('모르는 페이지와 문자열 아닌 값은 버린다', async () => {
    await prefs.set('dataFetchedAt', JSON.stringify({ today: '2026-09-08T05:00:00.000Z', 없는페이지: 'x', boss: 7 }))

    await expect(getDataFetchedAt()).resolves.toEqual({ today: '2026-09-08T05:00:00.000Z' })
  })
})
