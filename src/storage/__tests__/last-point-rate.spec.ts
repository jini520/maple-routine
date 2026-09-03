import { installFakePreferences } from './fake-preferences'
import { getLastPointRate, setLastPointRate } from '../last-point-rate'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('한 번도 안 넣었으면 null 이다', async () => {
  expect(await getLastPointRate()).toBeNull()
})

it('넣은 값을 그대로 돌려준다', async () => {
  await setLastPointRate(1_180)

  expect(await getLastPointRate()).toBe(1_180)
})

// 0 이나 NaN 이 기본값으로 들어가면 환산이 나눗셈이라 화면이 깨진다.
it('상한 값은 없는 것으로 본다', async () => {
  await prefs.set('lastPointRate', '0')
  expect(await getLastPointRate()).toBeNull()

  await prefs.set('lastPointRate', '메포')
  expect(await getLastPointRate()).toBeNull()
})

it('상한 값은 아예 안 쓴다', async () => {
  await setLastPointRate(0)
  await setLastPointRate(Number.NaN)

  expect(await prefs.get('lastPointRate')).toBeNull()
})
