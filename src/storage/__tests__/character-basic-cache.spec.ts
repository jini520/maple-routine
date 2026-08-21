import { installFakePreferences } from './fake-preferences'
import type { CharacterBasicProfile } from '../../types'
import {
  clearCachedCharacterBasic,
  getAllCachedCharacterBasicOcids,
  getCachedCharacterBasic,
  setCachedCharacterBasic,
  type CachedCharacterBasicEntry,
} from '../character-basic-cache'

const ACCOUNT = 'account-1'

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

beforeEach(async () => {
  prefs = installFakePreferences()
  await clearCachedCharacterBasic(ACCOUNT, 'ocid-1')
})

describe('round-trip', () => {
  it('setCachedCharacterBasic 후 getCachedCharacterBasic으로 저장한 값을 그대로 읽는다', async () => {
    await setCachedCharacterBasic(ACCOUNT, 'ocid-1', sampleEntry)
    await expect(getCachedCharacterBasic('ocid-1')).resolves.toEqual(sampleEntry)
  })
})

// ADR-144 결정 2: 캐릭터 카드 2줄이 «레벨 + 직업»이고 위 층은 네트워크 없이 캐시로 그린다.
// 값의 출처는 character/list이고 **쓰는 쪽이 엔트리에 담아 넘긴다** — 저장 레이어는 그것을 그대로
// 왕복시킬 뿐이라, character/basic 응답이 직업을 준다고 단정하는 자리가 생기지 않는다.
describe('jobClass (ADR-144 결정 2)', () => {
  it('호출부가 담아 넘긴 jobClass를 그대로 왕복시킨다', async () => {
    const entry: CachedCharacterBasicEntry = {
      profile: { ...sampleProfile, jobClass: '아크메이지(썬,콜)' },
      cachedAt: sampleEntry.cachedAt,
    }
    await setCachedCharacterBasic(ACCOUNT, 'ocid-1', entry)

    await expect(getCachedCharacterBasic('ocid-1')).resolves.toEqual(entry)
  })

  it('직업이 없는 옛 엔트리는 던지지 않고 jobClass가 undefined다', async () => {
    await setCachedCharacterBasic(ACCOUNT, 'ocid-1', sampleEntry)

    const cached = await getCachedCharacterBasic('ocid-1')
    expect(cached?.profile.jobClass).toBeUndefined()
    expect(cached?.profile.name).toBe(sampleProfile.name)
  })
})

describe('저장된 값이 없는 경우', () => {
  it('캐시된 적 없는 ocid는 null을 반환한다', async () => {
    await expect(getCachedCharacterBasic('unknown-ocid')).resolves.toBeNull()
  })

  it('clearCachedCharacterBasic 이후에는 null을 반환한다', async () => {
    await setCachedCharacterBasic(ACCOUNT, 'ocid-1', sampleEntry)
    await clearCachedCharacterBasic(ACCOUNT, 'ocid-1')
    await expect(getCachedCharacterBasic('ocid-1')).resolves.toBeNull()
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 null을 반환한다', async () => {
    await prefs.set('characterBasicCache:ocid-broken', 'not-valid-json{')
    await expect(getCachedCharacterBasic('ocid-broken')).resolves.toBeNull()
  })
})

describe('쓰기 실패 전파', () => {
  it('Preferences.set이 reject되면 setCachedCharacterBasic도 에러를 그대로 전파한다', async () => {
    prefs.set.mockRejectedValueOnce(new Error('disk full'))
    await expect(setCachedCharacterBasic(ACCOUNT, 'ocid-1', sampleEntry)).rejects.toThrow('disk full')
  })
})

describe('getAllCachedCharacterBasicOcids (ADR-017 결정 6)', () => {
  afterEach(async () => {
    await clearCachedCharacterBasic(ACCOUNT, 'ocid-2')
    await clearCachedCharacterBasic(ACCOUNT, 'ocid-3')
  })

  it('아무것도 캐싱된 적 없으면 빈 배열을 반환한다', async () => {
    await expect(getAllCachedCharacterBasicOcids(ACCOUNT)).resolves.toEqual([])
  })

  it('setCachedCharacterBasic으로 저장한 ocid들이 인덱스에 나타난다', async () => {
    await setCachedCharacterBasic(ACCOUNT, 'ocid-1', sampleEntry)
    await setCachedCharacterBasic(ACCOUNT, 'ocid-2', sampleEntry)

    const ocids = await getAllCachedCharacterBasicOcids(ACCOUNT)
    expect(ocids.sort()).toEqual(['ocid-1', 'ocid-2'])
  })

  it('같은 ocid를 여러 번 저장해도 인덱스에 중복으로 쌓이지 않는다', async () => {
    await setCachedCharacterBasic(ACCOUNT, 'ocid-1', sampleEntry)
    await setCachedCharacterBasic(ACCOUNT, 'ocid-1', { ...sampleEntry, cachedAt: '2026-07-12T01:00:00.000Z' })

    const ocids = await getAllCachedCharacterBasicOcids(ACCOUNT)
    expect(ocids.filter((ocid) => ocid === 'ocid-1')).toHaveLength(1)
  })

  it('clearCachedCharacterBasic으로 지운 ocid는 인덱스에서도 빠진다', async () => {
    await setCachedCharacterBasic(ACCOUNT, 'ocid-1', sampleEntry)
    await setCachedCharacterBasic(ACCOUNT, 'ocid-2', sampleEntry)
    await clearCachedCharacterBasic(ACCOUNT, 'ocid-1')

    const ocids = await getAllCachedCharacterBasicOcids(ACCOUNT)
    expect(ocids).toEqual(['ocid-2'])
  })
})

describe('계정별 인덱스 (ADR-086 결정 9)', () => {
  const OTHER = 'account-2'

  afterEach(async () => {
    await clearCachedCharacterBasic(ACCOUNT, 'ocid-1')
    await clearCachedCharacterBasic(OTHER, 'ocid-9')
    await prefs.remove('characterBasicCache:index')
    await prefs.remove('selectedAccountId')
  })

  it('다른 계정에 캐싱한 ocid는 이 계정 인덱스에 나타나지 않는다', async () => {
    await setCachedCharacterBasic(ACCOUNT, 'ocid-1', sampleEntry)
    await setCachedCharacterBasic(OTHER, 'ocid-9', sampleEntry)

    await expect(getAllCachedCharacterBasicOcids(ACCOUNT)).resolves.toEqual(['ocid-1'])
    await expect(getAllCachedCharacterBasicOcids(OTHER)).resolves.toEqual(['ocid-9'])
  })

  it('엔트리 자체는 계정과 무관하게 읽힌다 — 되돌아오면 따뜻한 캐시를 재사용한다', async () => {
    await setCachedCharacterBasic(OTHER, 'ocid-9', sampleEntry)
    await expect(getCachedCharacterBasic('ocid-9')).resolves.toEqual(sampleEntry)
  })

  it('전역 인덱스(레거시)를 저장된 selectedAccountId의 인덱스로 1회 이관하고 전역 키를 지운다', async () => {
    await prefs.set('selectedAccountId', ACCOUNT)
    await prefs.set('characterBasicCache:index', JSON.stringify(['ocid-1']))

    await expect(getAllCachedCharacterBasicOcids(ACCOUNT)).resolves.toEqual(['ocid-1'])
    await expect(prefs.get('characterBasicCache:index')).resolves.toBeNull()
  })

  it('이관은 인자가 아니라 저장된 selectedAccountId를 따른다 — 커밋 전 후보 계정에 흘러들지 않는다', async () => {
    await prefs.set('selectedAccountId', ACCOUNT)
    await prefs.set('characterBasicCache:index', JSON.stringify(['ocid-1']))

    // 계정 변경 도중 후보 계정(OTHER)으로 먼저 조회해도 이관 대상은 ACCOUNT다.
    await expect(getAllCachedCharacterBasicOcids(OTHER)).resolves.toEqual([])
    await expect(getAllCachedCharacterBasicOcids(ACCOUNT)).resolves.toEqual(['ocid-1'])
  })

  it('selectedAccountId가 아직 없으면 이관을 미루고 전역 키를 남긴다', async () => {
    await prefs.set('characterBasicCache:index', JSON.stringify(['ocid-1']))

    await expect(getAllCachedCharacterBasicOcids(ACCOUNT)).resolves.toEqual([])
    await expect(prefs.get('characterBasicCache:index')).resolves.toBe(JSON.stringify(['ocid-1']))
  })
})

describe('인덱스 갱신 동시성 (2026-07-14 정정)', () => {
  const raceOcids = Array.from({ length: 10 }, (_, i) => `race-ocid-${i}`)

  afterEach(async () => {
    await Promise.all(raceOcids.map((ocid) => clearCachedCharacterBasic(ACCOUNT, ocid)))
  })

  it('여러 캐릭터를 동시에 캐싱해도 인덱스에서 유실되는 ocid가 없다', async () => {
    await Promise.all(raceOcids.map((ocid) => setCachedCharacterBasic(ACCOUNT, ocid, sampleEntry)))

    const ocids = await getAllCachedCharacterBasicOcids(ACCOUNT)
    expect(new Set(ocids)).toEqual(new Set(raceOcids))

    for (const ocid of raceOcids) {
      await expect(getCachedCharacterBasic(ocid)).resolves.toEqual(sampleEntry)
    }
  })
})
