// 1.0.12 까지의 `character/basic` 캐시. 이제 읽고 지우기만 한다. 업데이트 뒤 첫 실행이 쿼리 캐시로 옮긴 뒤
// 지우므로, 읽기가 옛 모양을 그대로 받아 주는지와 지우기가 실제 키에 닿는지를 본다.
import { installFakePreferences } from './fake-preferences'
import type { CharacterBasicProfile } from '../../types'
import {
  clearCachedCharacterBasic,
  clearCharacterBasicCacheIndex,
  getCachedCharacterBasic,
  type CachedCharacterBasicEntry,
} from '../character-basic-cache'

const sampleProfile: CharacterBasicProfile = {
  name: '낟낟',
  level: 293,
  imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/abc?wmotion=W02',
  accessFlag: true,
}

const sampleEntry: CachedCharacterBasicEntry = {
  profile: sampleProfile,
  cachedAt: '2026-07-12T00:05:00.000Z',
}

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

async function seed(ocid: string, entry: CachedCharacterBasicEntry): Promise<void> {
  await prefs.set(`characterBasicCache:${ocid}`, JSON.stringify(entry))
}

// 직업은 character/list 가 주는 값이라 옛 엔트리에는 없을 수 있다. 없는 값을 지어내지 않는다.
describe('jobClass', () => {
  it('직업이 없는 옛 엔트리는 던지지 않고 jobClass가 undefined다', async () => {
    await seed('ocid-1', sampleEntry)

    const cached = await getCachedCharacterBasic('ocid-1')
    expect(cached?.profile.jobClass).toBeUndefined()
    expect(cached?.profile.name).toBe(sampleProfile.name)
  })
})

// 월드 key 가 생기기 전 캐시. 쿼리 캐시로 옮기는 자리가 이 값을 그대로 넣으므로 읽을 때 채운다.
describe('월드 key', () => {
  it('월드 key 가 없는 옛 엔트리는 읽을 때 월드 이름으로 채운다', async () => {
    await seed('ocid-1', { ...sampleEntry, profile: { ...sampleProfile, world: '챌린저스2' } })

    expect((await getCachedCharacterBasic('ocid-1'))?.profile.worldKey).toBe('challengers_2')
  })

  it('월드를 모르는 엔트리는 월드 key 도 채우지 않는다', async () => {
    await seed('ocid-1', sampleEntry)

    expect((await getCachedCharacterBasic('ocid-1'))?.profile.worldKey).toBeUndefined()
  })

  it('이미 든 월드 key 는 그대로 둔다', async () => {
    await seed('ocid-1', {
      ...sampleEntry,
      profile: { ...sampleProfile, world: '엘리시움', worldKey: 'elysium' },
    })

    expect((await getCachedCharacterBasic('ocid-1'))?.profile.worldKey).toBe('elysium')
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 null을 반환한다', async () => {
    await prefs.set('characterBasicCache:ocid-broken', 'not-valid-json{')
    await expect(getCachedCharacterBasic('ocid-broken')).resolves.toBeNull()
  })
})

// 옮긴 뒤 지우는 자리(`seedScheduleQueriesFromLegacyCache`)가 부른다. 키 이름이 어긋나면 옛 값이 기기에 영영 남는다.
describe('지우기', () => {
  it('엔트리 키와 전역 · 계정별 인덱스 키를 지운다', async () => {
    await seed('ocid-1', sampleEntry)
    await prefs.set('characterBasicCache:index', JSON.stringify(['ocid-1']))
    await prefs.set('characterBasicCache:index:account-1', JSON.stringify(['ocid-1']))
    await prefs.set('characterBasicCache:index:account-2', JSON.stringify(['ocid-1']))

    await clearCachedCharacterBasic('ocid-1')
    await clearCharacterBasicCacheIndex(['account-1', 'account-2'])

    await expect(getCachedCharacterBasic('ocid-1')).resolves.toBeNull()
    await expect(prefs.get('characterBasicCache:index')).resolves.toBeNull()
    await expect(prefs.get('characterBasicCache:index:account-1')).resolves.toBeNull()
    await expect(prefs.get('characterBasicCache:index:account-2')).resolves.toBeNull()
  })
})
