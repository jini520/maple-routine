import { installFakePreferences } from './fake-preferences'
import { getLastHunts, setLastHunt } from '../last-hunts'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('한 번도 안 적었으면 빈 표다', async () => {
  expect(await getLastHunts()).toEqual({})
})

it('캐릭터마다 따로 기억한다', async () => {
  await setLastHunt('ocid-1', { groundKey: 'geardrak_basement_1', boosts: ['union'], unionTier: 3 })
  await setLastHunt('ocid-2', { groundKey: 'arteria_west', boosts: [], unionTier: 3 })

  expect(await getLastHunts()).toEqual({
    'ocid-1': { groundKey: 'geardrak_basement_1', boosts: ['union'], unionTier: 3 },
    'ocid-2': { groundKey: 'arteria_west', boosts: [], unionTier: 3 },
  })
})

it('같은 캐릭터를 다시 적으면 그 몫만 바뀐다', async () => {
  await setLastHunt('ocid-1', { groundKey: 'geardrak_basement_1', boosts: ['union'], unionTier: 3 })
  await setLastHunt('ocid-2', { groundKey: 'arteria_west', boosts: [], unionTier: 3 })
  await setLastHunt('ocid-1', { groundKey: 'geardrak_basement_2_1', boosts: [], unionTier: 3 })

  expect(await getLastHunts()).toEqual({
    'ocid-1': { groundKey: 'geardrak_basement_2_1', boosts: [], unionTier: 3 },
    'ocid-2': { groundKey: 'arteria_west', boosts: [], unionTier: 3 },
  })
})

it('사냥터 key 가 비었으면 안 적는다', async () => {
  await setLastHunt('ocid-1', { groundKey: '', boosts: [], unionTier: 3 })

  expect(await prefs.get('lastHunts')).toBeNull()
})

/**
 * 모양이 어긋난 값은 없는 것으로 본다. 세우는 쪽이 그 값을 고르개에 세우면 목록에 없는 값을 든
 * 줄이 된다. 한 캐릭터 몫이 상했으면 그 몫만 뺀다.
 */
it('상한 값은 빈 표이고, 상한 캐릭터 몫은 뺀다', async () => {
  await prefs.set('lastHunts', '{')
  expect(await getLastHunts()).toEqual({})

  await prefs.set('lastHunts', '[]')
  expect(await getLastHunts()).toEqual({})

  await prefs.set(
    'lastHunts',
    JSON.stringify({
      'ocid-1': { groundKey: 'geardrak_basement_1', boosts: ['union'], unionTier: 3 },
      'ocid-2': { groundKey: 1, boosts: [] },
      'ocid-3': { groundKey: 'arteria_west', boosts: [1], unionTier: 3 },
      'ocid-4': null,
    }),
  )
  expect(await getLastHunts()).toEqual({
    'ocid-1': { groundKey: 'geardrak_basement_1', boosts: ['union'], unionTier: 3 },
  })
})

describe('옛 한 벌을 그 캐릭터 몫으로 옮긴다', () => {
  it('사냥터와 켠 아이템을 그 ocid 몫으로 옮기고 옛 키 둘을 지운다', async () => {
    await prefs.set('lastHuntSelection', '{"ocid":"ocid-1","groundKey":"geardrak_basement_1"}')
    await prefs.set('lastHuntToggles', '{"boosts":["union","potion"]}')

    expect(await getLastHunts()).toEqual({
      'ocid-1': { groundKey: 'geardrak_basement_1', boosts: ['union', 'potion'], unionTier: 3 },
    })
    expect(JSON.parse((await prefs.get('lastHunts'))!)).toEqual({
      'ocid-1': { groundKey: 'geardrak_basement_1', boosts: ['union', 'potion'], unionTier: 3 },
    })
    expect(await prefs.get('lastHuntSelection')).toBeNull()
    expect(await prefs.get('lastHuntToggles')).toBeNull()
  })

  it('켠 아이템이 없었으면 빈 목록으로 옮긴다', async () => {
    await prefs.set('lastHuntSelection', '{"ocid":"ocid-1","groundKey":"geardrak_basement_1"}')

    expect(await getLastHunts()).toEqual({
      'ocid-1': { groundKey: 'geardrak_basement_1', boosts: [], unionTier: 3 },
    })
  })

  it('옛 fragmentsDeferred 는 버리고 켠 아이템만 옮긴다', async () => {
    await prefs.set('lastHuntSelection', '{"ocid":"ocid-1","groundKey":"geardrak_basement_1"}')
    await prefs.set('lastHuntToggles', '{"fragmentsDeferred":true,"boosts":["union"]}')

    expect(await getLastHunts()).toEqual({
      'ocid-1': { groundKey: 'geardrak_basement_1', boosts: ['union'], unionTier: 3 },
    })
  })

  it('사냥터 이름을 든 더 옛 모양은 key 를 찾아 옮긴다', async () => {
    await prefs.set('lastHuntSelection', '{"ocid":"ocid-1","ground":"지하 1층"}')

    expect(await getLastHunts()).toEqual({
      'ocid-1': { groundKey: 'geardrak_basement_1', boosts: [], unionTier: 3 },
    })
  })

  it('캐릭터 없는 한 벌 · 못 찾는 이름 · 사냥터 없는 아이템은 버리고 옛 키를 지운다', async () => {
    for (const [selection, toggles] of [
      ['{"ocid":null,"groundKey":"geardrak_basement_1"}', '{"boosts":["union"]}'],
      ['{"ocid":"ocid-1","ground":"없어진 사냥터"}', null],
      [null, '{"boosts":["union"]}'],
      ['{', null],
    ] as const) {
      prefs = installFakePreferences()
      if (selection !== null) await prefs.set('lastHuntSelection', selection)
      if (toggles !== null) await prefs.set('lastHuntToggles', toggles)

      expect(await getLastHunts()).toEqual({})
      expect(await prefs.get('lastHuntSelection')).toBeNull()
      expect(await prefs.get('lastHuntToggles')).toBeNull()
    }
  })

  // 새 키가 이미 있으면 옛 키는 옮길 것이 아니라 남은 찌꺼기다. 새 값을 덮으면 안 된다.
  it('새 키가 이미 있으면 옛 키를 안 읽는다', async () => {
    await prefs.set('lastHunts', '{"ocid-2":{"groundKey":"arteria_west","boosts":[]}}')
    await prefs.set('lastHuntSelection', '{"ocid":"ocid-1","groundKey":"geardrak_basement_1"}')

    expect(await getLastHunts()).toEqual({ 'ocid-2': { groundKey: 'arteria_west', boosts: [], unionTier: 3 } })
  })
})

/** 유니온의 부 단계도 캐릭터별로 든다. 단계가 없는 옛 기억은 3단계다. */
describe('유니온의 부 단계', () => {
  it('적은 단계를 그대로 돌려준다', async () => {
    await setLastHunt('ocid-1', { groundKey: 'geardrak_basement_1', boosts: ['union'], unionTier: 1 })

    expect(await getLastHunts()).toEqual({
      'ocid-1': { groundKey: 'geardrak_basement_1', boosts: ['union'], unionTier: 1 },
    })
  })

  it('단계가 없거나 어긋난 기억은 3단계로 읽는다', async () => {
    await prefs.set(
      'lastHunts',
      JSON.stringify({
        'ocid-1': { groundKey: 'geardrak_basement_1', boosts: [] },
        'ocid-2': { groundKey: 'arteria_west', boosts: [], unionTier: 5 },
      }),
    )

    expect(await getLastHunts()).toEqual({
      'ocid-1': { groundKey: 'geardrak_basement_1', boosts: [], unionTier: 3 },
      'ocid-2': { groundKey: 'arteria_west', boosts: [], unionTier: 3 },
    })
  })
})
