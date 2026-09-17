import { installFakePreferences } from './fake-preferences'
import { getLastHuntToggles, setLastHuntToggles } from '../last-hunt-toggles'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('한 번도 안 적었으면 null 이다', async () => {
  expect(await getLastHuntToggles()).toBeNull()
})

it('넣은 값을 그대로 돌려준다', async () => {
  await setLastHuntToggles({ boosts: ['union', 'potion'] })

  expect(await getLastHuntToggles()).toEqual({ boosts: ['union', 'potion'] })
})

it('아무것도 안 켠 것도 기억한다. 끈 것과 안 적은 것은 다르다', async () => {
  await setLastHuntToggles({ boosts: [] })

  expect(await getLastHuntToggles()).toEqual({ boosts: [] })
})

// 조각 체크박스가 있던 때 적은 값. 켠 아이템은 그대로 쓰고 체크는 버린다.
it('옛 값의 fragmentsDeferred 는 무시하고 켠 아이템만 읽는다', async () => {
  await prefs.set('lastHuntToggles', '{"fragmentsDeferred":true,"boosts":["union"]}')

  expect(await getLastHuntToggles()).toEqual({ boosts: ['union'] })
})

/**
 * 모양이 어긋난 값은 **없는 것으로 본다**. 세우는 쪽이 그 값을 체크박스에 세우면 화면에는 아무
 * 체크도 없는데 새 기록에는 그 글자가 박히는 상태가 된다.
 */
it('상한 값은 없는 것으로 본다', async () => {
  await prefs.set('lastHuntToggles', '{')
  expect(await getLastHuntToggles()).toBeNull()

  await prefs.set('lastHuntToggles', '{"fragmentsDeferred":true}')
  expect(await getLastHuntToggles()).toBeNull()

  await prefs.set('lastHuntToggles', '{"boosts":[1]}')
  expect(await getLastHuntToggles()).toBeNull()
})
