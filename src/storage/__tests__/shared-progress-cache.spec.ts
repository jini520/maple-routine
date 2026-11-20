import { installFakePreferences } from './fake-preferences'
import type { SharedProgressEntry } from '../../types'
import {
  getWorldSharedProgress,
  setAccountSharedProgressEntry,
  setWorldSharedProgressEntry,
  splitWorldSharedProgress,
} from '../shared-progress-cache'

const sampleEntry: SharedProgressEntry = {
  active: true,
  kind: 'contents',
  nowCount: 7,
  maxCount: 14,
  questState: null,
  lastUpdatedBucket: '2026-07-21',
}

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

// 같은 월드라도 메이플 ID 가 다르면 따로 센다. 섞이면 다른 메이플 ID 캐릭터의 진행이 내 진행으로 보인다.
describe('world 원장', () => {
  it('같은 월드에 다른 항목을 추가로 저장해도 기존 항목이 유지된다', async () => {
    await setWorldSharedProgressEntry('maple-a', 'elysium', 'monster_park', sampleEntry)
    const second: SharedProgressEntry = { ...sampleEntry, nowCount: 3 }
    await setWorldSharedProgressEntry('maple-a', 'elysium', 'maple_union_weekly_dragon', second)

    await expect(getWorldSharedProgress('maple-a', 'elysium')).resolves.toEqual({
      monster_park: sampleEntry,
      maple_union_weekly_dragon: second,
    })
  })

  it('같은 월드라도 메이플 ID 마다 따로 둔다', async () => {
    await setWorldSharedProgressEntry('maple-a', 'elysium', 'monster_park', sampleEntry)

    await expect(getWorldSharedProgress('maple-b', 'elysium')).resolves.toEqual({})
  })
})

// 이 원장은 넥슨에서 다시 받을 수 없어 버리지 않고 베낀다.
describe('월드로만 묶던 옛 원장 나누기', () => {
  it('그 월드에 추적 캐릭터가 있는 메이플 ID 마다 베끼고, 옛 원장은 지운다', async () => {
    await prefs.set('worldSharedProgress:elysium', JSON.stringify({ monster_park: sampleEntry }))
    await prefs.set('worldSharedProgress:scania', JSON.stringify({ monster_park: sampleEntry }))

    await splitWorldSharedProgress([
      { accountId: 'maple-a', worldKey: 'elysium' },
      { accountId: 'maple-b', worldKey: 'elysium' },
    ])

    await expect(getWorldSharedProgress('maple-a', 'elysium')).resolves.toEqual({ monster_park: sampleEntry })
    await expect(getWorldSharedProgress('maple-b', 'elysium')).resolves.toEqual({ monster_park: sampleEntry })
    expect(await prefs.get('worldSharedProgress:elysium')).toBeNull()
    expect(await prefs.get('worldSharedProgress:scania')).toBeNull()
  })

  // 더 옛 원장은 월드 이름을 열쇠로 들었다. 표 이름이 곧 API 표기다.
  it('월드 이름 열쇠의 옛 원장도 베낀다', async () => {
    await prefs.set('worldSharedProgress:엘리시움', JSON.stringify({ monster_park: sampleEntry }))

    await splitWorldSharedProgress([{ accountId: 'maple-a', worldKey: 'elysium' }])

    await expect(getWorldSharedProgress('maple-a', 'elysium')).resolves.toEqual({ monster_park: sampleEntry })
    expect(await prefs.get('worldSharedProgress:엘리시움')).toBeNull()
  })

  it('새 원장에 이미 적힌 항목이 이기고, 한 번 나눈 뒤에는 다시 돌지 않는다', async () => {
    const fresh: SharedProgressEntry = { ...sampleEntry, nowCount: 1 }
    await setWorldSharedProgressEntry('maple-a', 'elysium', 'monster_park', fresh)
    await prefs.set('worldSharedProgress:elysium', JSON.stringify({ monster_park: sampleEntry, maple_union_weekly_dragon: sampleEntry }))

    await splitWorldSharedProgress([{ accountId: 'maple-a', worldKey: 'elysium' }])
    await prefs.set('worldSharedProgress:elysium', JSON.stringify({ monster_park: sampleEntry }))
    await splitWorldSharedProgress([{ accountId: 'maple-b', worldKey: 'elysium' }])

    await expect(getWorldSharedProgress('maple-a', 'elysium')).resolves.toEqual({
      monster_park: fresh,
      maple_union_weekly_dragon: sampleEntry,
    })
    await expect(getWorldSharedProgress('maple-b', 'elysium')).resolves.toEqual({})
  })
})

// 컨텐츠 이름을 열쇠로 들던 옛 원장. 다시 받을 수 없는 값이라 버리지 않고 읽을 때 key 로 옮긴다.
describe('컨텐츠 key 이관', () => {
  it('이름 열쇠를 컨텐츠 key 로 옮긴다. 띄어쓰기가 달라도 찾고, 표에 없는 이름은 버린다', async () => {
    await prefs.set(
      'worldSharedProgress:maple-a:elysium',
      JSON.stringify({ 몬스터파크: sampleEntry, '에픽던전:악몽선경': sampleEntry, 없어진컨텐츠: sampleEntry }),
    )

    await expect(getWorldSharedProgress('maple-a', 'elysium')).resolves.toEqual({
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
    await prefs.set('worldSharedProgress:maple-a:elysium', 'not-valid-json{')
    await expect(getWorldSharedProgress('maple-a', 'elysium')).resolves.toEqual({})
  })
})
