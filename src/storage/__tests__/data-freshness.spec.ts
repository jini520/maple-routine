import { installFakePreferences } from './fake-preferences'
import { getRealtimeFetchedAt } from '../data-freshness'

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await prefs.remove('dataFetchedAt')
})

describe('실시간 데이터를 마지막으로 받은 시각', () => {
  // 깨진 값 때문에 화면이 서지 않느니 줄 하나를 안 그리는 편이 낫다.
  it('못 읽는 값이면 null', async () => {
    await prefs.set('dataFetchedAt', '시각이 아니다')

    await expect(getRealtimeFetchedAt()).resolves.toBeNull()
  })
})
