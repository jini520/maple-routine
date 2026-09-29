import { installFakePreferences } from './fake-preferences'
import { getStatsCumulativeStart, setStatsCumulativeStart } from '../stats-cumulative-start'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('고른 적이 없으면 null 이다(기록이 처음 있는 날부터)', async () => {
  expect(await getStatsCumulativeStart()).toBeNull()
})

it('고른 날을 기억한다', async () => {
  await setStatsCumulativeStart('2026-08-01')

  expect(await getStatsCumulativeStart()).toBe('2026-08-01')
})

it('null 로 두면 지운다', async () => {
  await setStatsCumulativeStart('2026-08-01')
  await setStatsCumulativeStart(null)

  expect(await prefs.get('statsCumulativeStart')).toBeNull()
})

it('날짜 모양이 아닌 값은 없는 것으로 읽는다', async () => {
  await prefs.set('statsCumulativeStart', '어제')

  expect(await getStatsCumulativeStart()).toBeNull()
})
