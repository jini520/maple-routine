import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { getDataFetchedAt } from '../../../storage/data-freshness'
import { useDataFreshness } from '../freshness'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('dataFetchedAt')
  useDataFreshness.setState({ fetchedAt: {} })
})

describe('restore', () => {
  it('저장된 맵을 올린다', async () => {
    await prefs.set('dataFetchedAt', JSON.stringify({ cashbook: '2026-09-08T05:00:00.000Z' }))

    await useDataFreshness.getState().restore()

    expect(useDataFreshness.getState().fetchedAt).toEqual({ cashbook: '2026-09-08T05:00:00.000Z' })
  })

  // 줄 하나가 안 그려질 뿐이다. 부팅을 막을 일이 아니다.
  it('저장소가 던져도 빈 맵으로 선다', async () => {
    prefs.get.mockRejectedValue(new Error('저장소 고장'))

    await expect(useDataFreshness.getState().restore()).resolves.toBeUndefined()
    expect(useDataFreshness.getState().fetchedAt).toEqual({})
  })
})

describe('markFetched', () => {
  it('그 페이지의 시각을 지금으로 적고 저장한다', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-08T05:03:22.000Z'))

    await useDataFreshness.getState().markFetched('cashbook')

    expect(useDataFreshness.getState().fetchedAt.cashbook).toBe('2026-09-08T05:03:22.000Z')
    await expect(getDataFetchedAt()).resolves.toEqual({ cashbook: '2026-09-08T05:03:22.000Z' })
    jest.useRealTimers()
  })

  // 방금 받은 것은 방금 받은 것이다. 저장 실패가 그 사실을 못 바꾼다.
  it('저장이 실패해도 화면 값은 남는다', async () => {
    prefs.set.mockRejectedValue(new Error('저장소 고장'))

    await expect(useDataFreshness.getState().markFetched('cashbook')).resolves.toBeUndefined()
    expect(useDataFreshness.getState().fetchedAt.cashbook).toBeDefined()
  })
})
