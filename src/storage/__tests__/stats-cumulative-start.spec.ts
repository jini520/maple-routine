import { installFakePreferences } from './fake-preferences'
import { getStatsCumulativeStart } from '../stats-cumulative-start'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('날짜 모양이 아닌 값은 없는 것으로 읽는다', async () => {
  await prefs.set('statsCumulativeStart', '어제')

  expect(await getStatsCumulativeStart()).toBeNull()
})
