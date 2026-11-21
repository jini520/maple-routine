import { contentIdOf } from '../../lib/scheduler/contents'
import { findWorld } from '../../lib/world/worlds'
import { installFakePreferences } from './fake-preferences'
import type { SharedProgressEntry } from '../../types'
import {
  getAccountSharedProgress,
  getWorldSharedProgress,
  setAccountSharedProgressEntry,
  setWorldSharedProgressEntry,
} from '../shared-progress-cache'

/** 일간 컨텐츠(몬스터파크)의 진행. 기간은 그날 날짜다. */
const dailyEntry: SharedProgressEntry = {
  active: true,
  kind: 'contents',
  nowCount: 7,
  maxCount: 14,
  questState: null,
  lastUpdatedBucket: '2026-07-21',
}

/** 주간 컨텐츠의 진행. 기간은 그 주의 목요일이다. */
const weeklyEntry: SharedProgressEntry = {
  active: false,
  kind: 'quest',
  nowCount: 0,
  maxCount: 1,
  questState: 1,
  lastUpdatedBucket: '2026-07-16',
}

const ELYSIUM_ID = findWorld('elysium')!.id

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

// 같은 월드라도 메이플 ID 가 다르면 따로 센다. 섞이면 다른 메이플 ID 캐릭터의 진행이 내 진행으로 보인다.
describe('world 원장', () => {
  it('같은 월드에 다른 항목을 추가로 저장해도 기존 항목이 유지된다', async () => {
    await setWorldSharedProgressEntry('maple-a', 'elysium', 'monster_park', dailyEntry)
    await setWorldSharedProgressEntry('maple-a', 'elysium', 'maple_union_weekly_dragon', weeklyEntry)

    await expect(getWorldSharedProgress('maple-a', 'elysium')).resolves.toEqual({
      monster_park: dailyEntry,
      maple_union_weekly_dragon: weeklyEntry,
    })
  })

  it('같은 월드라도 메이플 ID 마다 따로 둔다', async () => {
    await setWorldSharedProgressEntry('maple-a', 'elysium', 'monster_park', dailyEntry)

    await expect(getWorldSharedProgress('maple-b', 'elysium')).resolves.toEqual({})
  })

  // 원장 키는 월드 줄 id 로 짓는다. 표에 없는 월드는 가리킬 원장이 없다.
  it('표에 없는 월드는 빈 원장으로 읽고, 적으려 하면 던진다', async () => {
    await expect(getWorldSharedProgress('maple-a', '없는월드')).resolves.toEqual({})
    await expect(setWorldSharedProgressEntry('maple-a', '없는월드', 'monster_park', dailyEntry)).rejects.toThrow()
  })
})

// 저장은 서버 `shared_content_progress` 와 같은 칸이다. 종류는 컨텐츠 줄에 있고, 기간은 그 컨텐츠의 주기로 적는다.
describe('저장 모양', () => {
  it('키는 월드 줄 id, 열쇠는 컨텐츠 줄 id 이고, 일간은 D · 주간은 W 기간 값으로 적으며 종류를 적지 않는다', async () => {
    await setWorldSharedProgressEntry('maple-a', 'elysium', 'monster_park', dailyEntry)
    await setAccountSharedProgressEntry('maple-a', 'epic_dungeon_nightmare_paradise', { ...weeklyEntry, kind: 'contents' })

    expect(JSON.parse((await prefs.get(`worldSharedProgress:maple-a:${ELYSIUM_ID}`))!)).toEqual({
      [contentIdOf('monster_park')!]: { isRegistered: true, nowCount: 7, maxCount: 14, questState: null, periodCode: 'D20260721' },
    })
    expect(JSON.parse((await prefs.get('accountSharedProgress:maple-a'))!)).toEqual({
      [contentIdOf('epic_dungeon_nightmare_paradise')!]: { isRegistered: false, nowCount: 0, maxCount: 1, questState: 1, periodCode: 'W202629' },
    })
  })

  // 게임 데이터에서 빠진 컨텐츠는 병합이 쓸 수 없다. 공유 범위가 컨텐츠 표에 있다.
  it('게임 데이터에 없는 컨텐츠 줄 id 는 건너뛰고, 종류는 컨텐츠 줄에서 채운다', async () => {
    await prefs.set(
      'accountSharedProgress:maple-a',
      JSON.stringify({
        '없는-id': { isRegistered: true, nowCount: 1, maxCount: 1, questState: null, periodCode: 'W202629' },
        [contentIdOf('maple_union_pc_cafe_weekly_dragon')!]: { isRegistered: false, nowCount: 0, maxCount: 1, questState: 1, periodCode: 'W202629' },
      }),
    )

    await expect(getAccountSharedProgress('maple-a')).resolves.toEqual({ maple_union_pc_cafe_weekly_dragon: weeklyEntry })
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 빈 객체를 반환한다', async () => {
    await prefs.set(`worldSharedProgress:maple-a:${ELYSIUM_ID}`, 'not-valid-json{')
    await expect(getWorldSharedProgress('maple-a', 'elysium')).resolves.toEqual({})
  })
})
