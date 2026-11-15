import { installFakePreferences } from './fake-preferences'
import {
  getLastEpicDungeonRewards,
  moveLastEpicDungeonRewardsToOcid,
  setLastEpicDungeonReward,
} from '../last-epic-dungeon-rewards'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('던전마다 마지막 주인을 바꾸고, 주인마다 고른 형태별 항목 key 를 남긴다', async () => {
  await setLastEpicDungeonReward('high_mountain', { ocid: 'ocid-1' }, { exp: 'high_mountain_1' })
  await setLastEpicDungeonReward('high_mountain', { accountId: 'maple-a' }, { sol_erda: 'high_mountain_2' })
  await setLastEpicDungeonReward('angler_company', { ocid: 'ocid-2' }, { exp: 'angler_company_2' })

  expect(await getLastEpicDungeonRewards()).toEqual({
    high_mountain: {
      last: { accountId: 'maple-a' },
      characters: { 'ocid-1': { exp: 'high_mountain_1' } },
      accounts: { 'maple-a': { sol_erda: 'high_mountain_2' } },
    },
    angler_company: {
      last: { ocid: 'ocid-2' },
      characters: { 'ocid-2': { exp: 'angler_company_2' } },
      accounts: {},
    },
  })
})

it('같은 주인이 다시 적으면 그 주인의 단계만 바뀐다', async () => {
  await setLastEpicDungeonReward('high_mountain', { ocid: 'ocid-1' }, { exp: 'high_mountain_1' })
  await setLastEpicDungeonReward('high_mountain', { ocid: 'ocid-2' }, { exp: 'high_mountain_2' })
  await setLastEpicDungeonReward('high_mountain', { ocid: 'ocid-1' }, { sol_erda: 'high_mountain_1' })

  expect(await getLastEpicDungeonRewards()).toEqual({
    high_mountain: {
      last: { ocid: 'ocid-1' },
      characters: { 'ocid-1': { sol_erda: 'high_mountain_1' }, 'ocid-2': { exp: 'high_mountain_2' } },
      accounts: {},
    },
  })
})

// 모양이 틀린 값을 세우면 목록에 없는 주인이나 단계가 줄에 남는다. 한 던전이 상했다고 다른 던전의 기억까지 버리지 않는다.
it('상한 값은 빈 표이고, 마지막 주인이 틀린 던전과 모양이 틀린 주인 몫만 뺀다', async () => {
  await prefs.set('lastEpicDungeonRewards', '{')
  expect(await getLastEpicDungeonRewards()).toEqual({})

  await prefs.set(
    'lastEpicDungeonRewards',
    JSON.stringify({
      high_mountain: {
        last: { ocid: 'ocid-1' },
        characters: { 'ocid-1': { exp: 'high_mountain_1' }, 'ocid-2': { exp: 2 }, 'ocid-3': null },
        accounts: { 'maple-a': {} },
      },
      angler_company: { last: { ocid: '' }, characters: {}, accounts: {} },
      nightmare_paradise: { last: null, characters: {}, accounts: {} },
    }),
  )
  expect(await getLastEpicDungeonRewards()).toEqual({
    high_mountain: { last: { ocid: 'ocid-1' }, characters: { 'ocid-1': { exp: 'high_mountain_1' } }, accounts: {} },
  })
})

describe('월드 리프하면 옛 ocid 를 새 ocid 로 옮긴다', () => {
  it('옛 캐릭터의 단계를 새 ocid 로 옮기고, 마지막 주인이 옛 ocid 면 새 ocid 로 바꾼다', async () => {
    await setLastEpicDungeonReward('high_mountain', { ocid: 'old-1' }, { exp: 'high_mountain_1' })

    await moveLastEpicDungeonRewardsToOcid('old-1', 'new-1')

    expect(await getLastEpicDungeonRewards()).toEqual({
      high_mountain: { last: { ocid: 'new-1' }, characters: { 'new-1': { exp: 'high_mountain_1' } }, accounts: {} },
    })
  })

  // 리프 뒤에 새 캐릭터로 고른 단계다. 옛 값으로 덮지 않는다.
  it('새 ocid 의 단계가 있으면 새 것을 두고 옛 몫은 지운다', async () => {
    await setLastEpicDungeonReward('high_mountain', { ocid: 'new-1' }, { sol_erda: 'high_mountain_2' })
    await setLastEpicDungeonReward('high_mountain', { ocid: 'old-1' }, { exp: 'high_mountain_1' })

    await moveLastEpicDungeonRewardsToOcid('old-1', 'new-1')

    expect(await getLastEpicDungeonRewards()).toEqual({
      high_mountain: { last: { ocid: 'new-1' }, characters: { 'new-1': { sol_erda: 'high_mountain_2' } }, accounts: {} },
    })
  })

  it('옮길 것이 없으면 쓰지 않는다', async () => {
    await moveLastEpicDungeonRewardsToOcid('old-1', 'new-1')

    expect(await prefs.get('lastEpicDungeonRewards')).toBeNull()
  })
})
