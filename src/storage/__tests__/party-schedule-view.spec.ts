import { installFakePreferences } from './fake-preferences'
import { getPartyScheduleView, setPartyScheduleView } from '../party-schedule-view'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('고른 적이 없거나 모르는 값이면 목록으로 연다', async () => {
  expect(await getPartyScheduleView()).toBe('list')

  await prefs.set('partyScheduleView', 'calendar')
  expect(await getPartyScheduleView()).toBe('list')
})

it('보드를 고르면 다음에도 보드로 연다', async () => {
  await setPartyScheduleView('board')

  expect(await getPartyScheduleView()).toBe('board')
})

