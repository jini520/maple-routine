// 주간 결정석 판매 한도를 넘긴 처치 고르기.
//
// 고른 처치는 0 메소로 읽힌다. 차례가 끝까지 정해져 있어야 다시 판정해도 같은 처치가 0 이 된다.

import { overCrystalLimitIds, type CrystalLimitRecord } from '../crystal-limit'

/** 메이플 ID 마다 세는 첫 주. */
const WEEK = '2026-11-19'
/** 월드마다 세던 마지막 주. */
const OLD_WEEK = '2026-11-12'

let nextId = 0

function record(overrides: Partial<CrystalLimitRecord> = {}): CrystalLimitRecord {
  nextId += 1
  return {
    id: `period-${nextId}`,
    ocid: 'ocid-a',
    bossKey: 'zakum',
    difficulty: 'chaos',
    cycle: 'weekly',
    periodKey: WEEK,
    worldKey: 'scania',
    payoutMeso: 100,
    crystalExcluded: false,
    ...overrides,
  }
}

const OPTIONS = {
  limit: 2,
  mapleIdOfOcid: { 'ocid-a': 'maple-1', 'ocid-b': 'maple-1', 'ocid-c': 'maple-1', 'ocid-x': 'maple-1' },
  orderedOcids: ['ocid-a', 'ocid-b', 'ocid-c'],
}

describe('overCrystalLimitIds: 한도를 넘긴 처치 고르기', () => {
  it('넘친 개수만큼 내 몫이 낮은 기록을 고른다', () => {
    const low = record({ bossKey: 'zakum', payoutMeso: 100 })
    const records = [
      record({ bossKey: 'magnus', payoutMeso: 300 }),
      low,
      record({ bossKey: 'papulatus', payoutMeso: 200 }),
    ]

    expect(overCrystalLimitIds(records, OPTIONS)).toEqual(new Set([low.id]))
  })

  it('한도 안이면 아무것도 고르지 않는다', () => {
    const records = [record({ bossKey: 'zakum' }), record({ bossKey: 'magnus' })]

    expect(overCrystalLimitIds(records, OPTIONS)).toEqual(new Set())
  })

  // `제외` 는 판 결정석이 아니라 한도에 안 든다. 그것을 빼고도 넘칠 때만 고른다.
  it('`제외` 를 먼저 빼고 센다', () => {
    const excluded = record({ bossKey: 'zakum', payoutMeso: 10, crystalExcluded: true })
    const middle = record({ bossKey: 'magnus', payoutMeso: 200 })
    const records = [excluded, middle, record({ bossKey: 'papulatus', payoutMeso: 300 })]

    expect(overCrystalLimitIds(records, OPTIONS)).toEqual(new Set())
    expect(overCrystalLimitIds(records, { ...OPTIONS, limit: 1 })).toEqual(new Set([middle.id]))
  })

  it('내 몫이 같으면 추적 순서의 앞 캐릭터부터 고른다', () => {
    const front = record({ ocid: 'ocid-a', bossKey: 'zakum' })
    const records = [record({ ocid: 'ocid-b', bossKey: 'zakum' }), front]

    expect(overCrystalLimitIds(records, { ...OPTIONS, limit: 1 })).toEqual(new Set([front.id]))
  })

  it('추적하지 않는 캐릭터는 추적 캐릭터 뒤에 선다', () => {
    const tracked = record({ ocid: 'ocid-c', bossKey: 'zakum' })
    const records = [record({ ocid: 'ocid-x', bossKey: 'zakum' }), tracked]

    expect(overCrystalLimitIds(records, { ...OPTIONS, limit: 1 })).toEqual(new Set([tracked.id]))
  })

  it('같은 캐릭터 안에서는 보스 표의 앞 보스부터 고른다', () => {
    const zakum = record({ bossKey: 'zakum' })
    const records = [record({ bossKey: 'magnus' }), zakum]

    expect(overCrystalLimitIds(records, { ...OPTIONS, limit: 1 })).toEqual(new Set([zakum.id]))
  })

  it('2026-11-19 주부터는 메이플 ID 의 일반 월드를 한 줄로 세고 챌린저스 월드는 따로 센다', () => {
    const scania = record({ worldKey: 'scania', payoutMeso: 100 })
    const records = [
      scania,
      record({ ocid: 'ocid-b', worldKey: 'luna', payoutMeso: 200 }),
      record({ ocid: 'ocid-c', worldKey: 'challengers_2', payoutMeso: 50 }),
    ]

    expect(overCrystalLimitIds(records, { ...OPTIONS, limit: 1 })).toEqual(new Set([scania.id]))
  })

  it('그 전 주는 월드마다 센다', () => {
    const records = [
      record({ periodKey: OLD_WEEK, worldKey: 'scania' }),
      record({ periodKey: OLD_WEEK, ocid: 'ocid-b', worldKey: 'luna' }),
    ]

    expect(overCrystalLimitIds(records, { ...OPTIONS, limit: 1 })).toEqual(new Set())
  })

  it('주마다, 메이플 ID 마다 따로 센다', () => {
    const records = [
      record({ periodKey: WEEK }),
      record({ periodKey: '2026-11-26' }),
      record({ ocid: 'ocid-b' }),
    ]
    const mapleIdOfOcid = { 'ocid-a': 'maple-1', 'ocid-b': 'maple-2' }

    expect(overCrystalLimitIds(records, { ...OPTIONS, limit: 1, mapleIdOfOcid })).toEqual(new Set())
  })

  // 한도 줄에 넣을 수 없는 처치는 0 으로 만들 근거도 없다.
  it('월간 · 시즌 보스와 월드 · 메이플 ID 를 모르는 기록은 넣지 않는다', () => {
    const records = [
      record({ bossKey: 'zakum' }),
      record({ bossKey: 'black_mage', cycle: 'monthly', periodKey: '2026-11' }),
      record({ bossKey: 'meirin', difficulty: 'normal' }),
      record({ bossKey: 'magnus', worldKey: null }),
      record({ ocid: 'ocid-unknown', bossKey: 'magnus' }),
    ]

    expect(overCrystalLimitIds(records, { ...OPTIONS, limit: 1 })).toEqual(new Set())
  })
})
