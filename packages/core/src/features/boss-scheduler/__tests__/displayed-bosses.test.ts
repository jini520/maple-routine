// 지금까지 이 판정은 `BossScreen` 을 렌더해야만 검증됐다(지역 함수였다) — 화면으로 보면 «카드가
// 몇 장인가» 까지만 알 수 있고 «어느 규칙이 그 장 수를 만들었는가» 는 못 본다. 꺼낸 김에 입출력으로
// 직접 못 박는다([[ADR-146]] 결정 8).
import { describe, expect, it } from 'vitest'

import type { BossCharacterView } from '../store'
import { displayedBosses } from '../displayed-bosses'
import { matchBossContent, type MatchedBoss } from '@core/lib/boss-matching'
import type { BossContent, BossCycle, BossDifficulty } from '@core/types'
import type { ManualTrackedItem } from '@core/types/scheduler'

function boss(
  overrides: Partial<BossContent> & { name: string; difficulty: BossDifficulty; cycle: BossCycle },
): MatchedBoss {
  return matchBossContent({
    isRegistered: false,
    isComplete: false,
    ownComplete: false,
    ...overrides,
  })
}

function character(overrides: Partial<BossCharacterView> = {}): BossCharacterView {
  return {
    ocid: 'ocid-1',
    characterName: '단풍',
    weeklyBosses: [],
    monthlyBosses: [],
    weeklyBossClearCount: null,
    weeklyBossClearLimitCount: null,
    isStale: false,
    syncedAt: null,
    error: null,
    ...overrides,
  }
}

function bossItem(contentName: string, difficulty: string): ManualTrackedItem {
  return { contentName, kind: 'boss', difficulty }
}

describe('displayedBosses — 자동 모드', () => {
  // [[ADR-031]] 결정 5: 등록한 난이도가 있으면 그것만(중복 카드 방지), 없으면 완료한 난이도를 대신.
  it('등록된 보스와 «미등록이지만 완료된» 보스를 함께 보여준다', () => {
    const registered = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })
    const unregisteredComplete = boss({
      name: '루시드',
      difficulty: '하드',
      cycle: 'weekly',
      isComplete: true,
      ownComplete: true,
    })
    const unregisteredIncomplete = boss({ name: '윌', difficulty: '하드', cycle: 'weekly' })

    const result = displayedBosses(
      character({ weeklyBosses: [registered, unregisteredComplete, unregisteredIncomplete] }),
      'weekly',
      'auto',
      null,
    )

    expect(result.map((entry) => entry.apiName)).toEqual(['스우', '루시드'])
  })

  // 같은 보스를 여러 난이도로 받아도 등록된 난이도가 있으면 그 행만 남는다 — 카드가 겹치지 않게.
  it('같은 보스의 등록 난이도가 있으면 완료된 다른 난이도는 카드로 서지 않는다', () => {
    const registeredHard = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })
    const completeNormal = boss({
      name: '스우',
      difficulty: '노멀',
      cycle: 'weekly',
      isComplete: true,
      ownComplete: true,
    })

    const result = displayedBosses(
      character({ weeklyBosses: [registeredHard, completeNormal] }),
      'weekly',
      'auto',
      null,
    )

    expect(result).toEqual([registeredHard])
  })

  it('cycle 이 주간·월간을 가른다 — 자동 모드는 캐릭터 뷰의 두 목록에서 고른다', () => {
    const weekly = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })
    const monthly = boss({ name: '검은마법사', difficulty: '하드', cycle: 'monthly', isRegistered: true })
    const view = character({ weeklyBosses: [weekly], monthlyBosses: [monthly] })

    expect(displayedBosses(view, 'weekly', 'auto', null)).toEqual([weekly])
    expect(displayedBosses(view, 'monthly', 'auto', null)).toEqual([monthly])
  })

  // 자동 모드는 게임 등록이 진실이라 멤버십을 아예 안 본다 — 모드 전환 직후 남아 있는 수동 목록이
  // 자동 화면에 새지 않는다.
  it('멤버십이 있어도 자동 모드에서는 그것을 읽지 않는다', () => {
    const registered = boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })

    const result = displayedBosses(character({ weeklyBosses: [registered] }), 'weekly', 'auto', {
      'ocid-1': [bossItem('루시드', '하드')],
    })

    expect(result).toEqual([registered])
  })
})

describe('displayedBosses — 수동 모드', () => {
  // [[ADR-035]] 결정 3·6·12: 게임 등록 여부가 아니라 «앱에서 관리하는 멤버십» 이 표시 목록을 정한다.
  it('추적 멤버십이 표시 목록을 정한다 — 등록·동기화된 적 없는 보스도 카드로 선다', () => {
    const result = displayedBosses(character(), 'weekly', 'manual', {
      'ocid-1': [bossItem('스우', '하드')],
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      apiName: '스우',
      difficulty: '하드',
      cycle: 'weekly',
      isRegistered: false,
      isComplete: false,
      matchedBossName: '스우',
    })
  })

  it('멤버십에 없는 보스는 등록·완료돼 있어도 카드로 서지 않는다', () => {
    const registeredComplete = boss({
      name: '루시드',
      difficulty: '하드',
      cycle: 'weekly',
      isRegistered: true,
      isComplete: true,
      ownComplete: true,
    })

    const result = displayedBosses(
      character({ weeklyBosses: [registeredComplete] }),
      'weekly',
      'manual',
      { 'ocid-1': [bossItem('스우', '하드')] },
    )

    expect(result.map((entry) => entry.apiName)).toEqual(['스우'])
  })

  // 완료 여부는 멤버십에 복제하지 않고 동기화 결과에서 즉석 조회한다(단일 진실 공급원).
  it('동기화 결과의 완료 여부가 멤버십 항목에 붙는다', () => {
    const synced = boss({
      name: '스우',
      difficulty: '하드',
      cycle: 'weekly',
      isRegistered: true,
      isComplete: true,
      ownComplete: true,
    })

    const result = displayedBosses(character({ weeklyBosses: [synced] }), 'weekly', 'manual', {
      'ocid-1': [bossItem('스우', '하드')],
    })

    expect(result[0]).toMatchObject({ apiName: '스우', difficulty: '하드', isComplete: true })
  })

  // 조회 대상이 주간·월간 두 목록을 합친 것이라, 월간 보스를 추적해도 주간 탭에 새지 않는다.
  it('멤버십 목록을 cycle 로 가른다 — 월간 추적은 주간 탭에 오지 않는다', () => {
    const tracked = {
      'ocid-1': [bossItem('스우', '하드'), bossItem('검은마법사', '하드')],
    }
    const view = character()

    expect(displayedBosses(view, 'weekly', 'manual', tracked).map((entry) => entry.apiName)).toEqual(['스우'])
    expect(displayedBosses(view, 'monthly', 'manual', tracked).map((entry) => entry.apiName)).toEqual([
      '검은마법사',
    ])
  })

  it('보스가 아닌 멤버십 항목(컨텐츠)은 걸러진다', () => {
    const result = displayedBosses(character(), 'weekly', 'manual', {
      'ocid-1': [bossItem('스우', '하드'), { contentName: '몬스터파크', kind: 'daily' }],
    })

    expect(result.map((entry) => entry.apiName)).toEqual(['스우'])
  })

  it('멤버십 맵이 null 이거나 그 ocid 키가 없으면 빈 목록', () => {
    const view = character({
      weeklyBosses: [boss({ name: '스우', difficulty: '하드', cycle: 'weekly', isRegistered: true })],
    })

    expect(displayedBosses(view, 'weekly', 'manual', null)).toEqual([])
    expect(displayedBosses(view, 'weekly', 'manual', {})).toEqual([])
    expect(displayedBosses(view, 'weekly', 'manual', { 'ocid-2': [bossItem('스우', '하드')] })).toEqual([])
  })

  // 화면이 캐릭터를 인자로 받는 이유([[ADR-142]] 결정 4) — 레일의 링은 «선택되지 않은» 캐릭터의
  // 목록도 세야 하고, 그 목록은 그 캐릭터의 ocid 로 뽑은 멤버십이어야 한다.
  it('멤버십은 인자로 받은 캐릭터의 ocid 로 뽑는다', () => {
    const result = displayedBosses(character({ ocid: 'ocid-2' }), 'weekly', 'manual', {
      'ocid-1': [bossItem('스우', '하드')],
      'ocid-2': [bossItem('루시드', '하드')],
    })

    expect(result.map((entry) => entry.apiName)).toEqual(['루시드'])
  })
})
