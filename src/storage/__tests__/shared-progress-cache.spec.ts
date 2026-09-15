import { installFakePreferences } from './fake-preferences'
import type { SharedProgressEntry } from '../../types'
import {
  getAccountSharedProgress,
  getWorldSharedProgress,
  setAccountSharedProgressEntry,
  setWorldSharedProgressEntry,
} from '../shared-progress-cache'

const sampleEntry: SharedProgressEntry = {
  active: true,
  kind: 'contents',
  nowCount: 7,
  maxCount: 14,
  questState: null,
  lastUpdatedBucket: '2026-07-21',
}

const KEYS_USED_IN_TESTS = [
  'worldSharedProgress:엘리시움',
  'worldSharedProgress:elysium',
  'worldSharedProgress:scania',
  'accountSharedProgress:acc-1',
  'accountSharedProgress:acc-2',
  'accountSharedProgress:acc-unknown',
]

let prefs = installFakePreferences()

beforeEach(async () => {
  prefs = installFakePreferences()
  await Promise.all(KEYS_USED_IN_TESTS.map((key) => prefs.remove(key)))
})

describe('world 원장', () => {
  it('저장된 적 없는 월드는 빈 객체를 반환한다', async () => {
    await expect(getWorldSharedProgress('scania')).resolves.toEqual({})
  })

  it('setWorldSharedProgressEntry 후 같은 월드에서 그대로 읽힌다', async () => {
    await setWorldSharedProgressEntry('elysium', 'monster_park', sampleEntry)
    await expect(getWorldSharedProgress('elysium')).resolves.toEqual({ monster_park: sampleEntry })
    // 원장 키는 월드 key 다.
    expect(await prefs.get('worldSharedProgress:elysium')).not.toBeNull()
  })

  it('같은 월드에 다른 항목을 추가로 저장해도 기존 항목이 유지된다', async () => {
    await setWorldSharedProgressEntry('elysium', 'monster_park', sampleEntry)
    const second: SharedProgressEntry = { ...sampleEntry, nowCount: 3 }
    await setWorldSharedProgressEntry('elysium', 'maple_union_weekly_dragon', second)

    await expect(getWorldSharedProgress('elysium')).resolves.toEqual({
      monster_park: sampleEntry,
      maple_union_weekly_dragon: second,
    })
  })

  it('다른 월드끼리는 서로 격리된다', async () => {
    await setWorldSharedProgressEntry('elysium', 'monster_park', sampleEntry)
    await expect(getWorldSharedProgress('scania')).resolves.toEqual({})
  })
})

// 이 원장은 다시 받을 수 없어 옮긴다. 옛 키의 월드 부분은 월드 표의 이름이다.
describe('월드 key 이관', () => {
  it('월드 이름 키의 옛 원장을 월드 key 키로 옮기고 옛 키를 지운다', async () => {
    await prefs.set('worldSharedProgress:엘리시움', JSON.stringify({ monster_park: sampleEntry }))

    await expect(getWorldSharedProgress('elysium')).resolves.toEqual({ monster_park: sampleEntry })
    expect(await prefs.get('worldSharedProgress:엘리시움')).toBeNull()
    expect(JSON.parse((await prefs.get('worldSharedProgress:elysium'))!)).toEqual({ monster_park: sampleEntry })
  })

  it('새 키에 이미 값이 있으면 덮지 않고 옛 키만 지운다', async () => {
    const fresh: SharedProgressEntry = { ...sampleEntry, nowCount: 1 }
    await prefs.set('worldSharedProgress:elysium', JSON.stringify({ monster_park: fresh }))
    await prefs.set('worldSharedProgress:엘리시움', JSON.stringify({ monster_park: sampleEntry }))

    await expect(getWorldSharedProgress('elysium')).resolves.toEqual({ monster_park: fresh })
    expect(await prefs.get('worldSharedProgress:엘리시움')).toBeNull()
  })

  it('쓰기 전에도 옛 원장을 옮겨 옛 항목을 잃지 않는다', async () => {
    await prefs.set('worldSharedProgress:엘리시움', JSON.stringify({ monster_park: sampleEntry }))
    const second: SharedProgressEntry = { ...sampleEntry, nowCount: 3 }

    await setWorldSharedProgressEntry('elysium', 'maple_union_weekly_dragon', second)

    await expect(getWorldSharedProgress('elysium')).resolves.toEqual({
      monster_park: sampleEntry,
      maple_union_weekly_dragon: second,
    })
  })
})

describe('account 원장', () => {
  it('저장된 적 없는 계정은 빈 객체를 반환한다', async () => {
    await expect(getAccountSharedProgress('acc-unknown')).resolves.toEqual({})
  })

  it('setAccountSharedProgressEntry 후 같은 계정에서 그대로 읽힌다', async () => {
    await setAccountSharedProgressEntry('acc-1', 'epic_dungeon_nightmare_paradise', sampleEntry)
    await expect(getAccountSharedProgress('acc-1')).resolves.toEqual({ epic_dungeon_nightmare_paradise: sampleEntry })
  })

  it('다른 계정끼리는 서로 격리된다', async () => {
    await setAccountSharedProgressEntry('acc-1', 'epic_dungeon_nightmare_paradise', sampleEntry)
    await expect(getAccountSharedProgress('acc-2')).resolves.toEqual({})
  })
})

// 컨텐츠 이름을 열쇠로 들던 옛 원장. 다시 받을 수 없는 값이라 버리지 않고 읽을 때 key 로 옮긴다.
describe('컨텐츠 key 이관', () => {
  it('이름 열쇠를 컨텐츠 key 로 옮긴다. 띄어쓰기가 달라도 찾고, 표에 없는 이름은 버린다', async () => {
    await prefs.set(
      'worldSharedProgress:elysium',
      JSON.stringify({ 몬스터파크: sampleEntry, '에픽던전:악몽선경': sampleEntry, 없어진컨텐츠: sampleEntry }),
    )

    await expect(getWorldSharedProgress('elysium')).resolves.toEqual({
      monster_park: sampleEntry,
      epic_dungeon_nightmare_paradise: sampleEntry,
    })
  })

  it('옛 원장에 새 항목을 쓰면 새 모양으로 덮어쓴다', async () => {
    await prefs.set('accountSharedProgress:acc-1', JSON.stringify({ '에픽 던전 : 하이마운틴': sampleEntry }))

    await setAccountSharedProgressEntry('acc-1', 'epic_dungeon_nightmare_paradise', sampleEntry)

    expect(JSON.parse((await prefs.get('accountSharedProgress:acc-1'))!)).toEqual({
      epic_dungeon_high_mountain: sampleEntry,
      epic_dungeon_nightmare_paradise: sampleEntry,
    })
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 빈 객체를 반환한다', async () => {
    await prefs.set('worldSharedProgress:elysium', 'not-valid-json{')
    await expect(getWorldSharedProgress('elysium')).resolves.toEqual({})
  })
})
