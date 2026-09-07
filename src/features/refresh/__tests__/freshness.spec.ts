import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { getRealtimeFetchedAt } from '../../../storage/data-freshness'
import { useDataFreshness } from '../freshness'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('dataFetchedAt')
  useDataFreshness.setState({ fetchedAt: null })
})

describe('restore', () => {
  it('저장된 값을 올린다', async () => {
    await prefs.set('dataFetchedAt', '2026-09-08T05:00:00.000Z')

    await useDataFreshness.getState().restore()

    expect(useDataFreshness.getState().fetchedAt).toBe('2026-09-08T05:00:00.000Z')
  })

  // 줄 하나가 안 그려질 뿐이다. 부팅을 막을 일이 아니다.
  it('저장소가 던져도 null 로 선다', async () => {
    prefs.get.mockRejectedValue(new Error('저장소 고장'))

    await expect(useDataFreshness.getState().restore()).resolves.toBeUndefined()
    expect(useDataFreshness.getState().fetchedAt).toBeNull()
  })
})

describe('markRealtimeFetch', () => {
  it('알린 시각을 올리고 저장한다', async () => {
    await useDataFreshness.getState().markRealtimeFetch('2026-09-08T05:03:22.000Z')

    expect(useDataFreshness.getState().fetchedAt).toBe('2026-09-08T05:03:22.000Z')
    await expect(getRealtimeFetchedAt()).resolves.toBe('2026-09-08T05:03:22.000Z')
  })

  // 회차에 합류한 호출이 같은 결과를 들고 한 번 더 알린다. 실패한 캐릭터는 캐시의 옛 값을 들고 온다.
  it('뒤로 안 간다', async () => {
    await useDataFreshness.getState().markRealtimeFetch('2026-09-08T07:00:00.000Z')

    await useDataFreshness.getState().markRealtimeFetch('2026-09-08T05:00:00.000Z')

    expect(useDataFreshness.getState().fetchedAt).toBe('2026-09-08T07:00:00.000Z')
  })

  // 회차가 전부 실패하면 알릴 시각이 없다. 그 자리에서 빈 문자열이 온다.
  it('못 읽는 값은 아무것도 안 한다', async () => {
    await useDataFreshness.getState().markRealtimeFetch('')

    expect(useDataFreshness.getState().fetchedAt).toBeNull()
    await expect(getRealtimeFetchedAt()).resolves.toBeNull()
  })

  // 방금 받은 것은 방금 받은 것이다. 저장 실패가 그 사실을 못 바꾼다.
  it('저장이 실패해도 화면 값은 남는다', async () => {
    prefs.set.mockRejectedValue(new Error('저장소 고장'))

    await expect(
      useDataFreshness.getState().markRealtimeFetch('2026-09-08T05:03:22.000Z'),
    ).resolves.toBeUndefined()
    expect(useDataFreshness.getState().fetchedAt).toBe('2026-09-08T05:03:22.000Z')
  })
})
