// 월드 리프한 기간에 같은 처치가 옛 ocid 와 새 ocid 로 한 번씩 선 기록의 짝짓기.
//
// ① 짝은 리프한 주와 그 달(새 ocid 의 주기별 가장 이른 기록 기간)에서만 찾는다.
// ② 옛 기록을 지우고 새 기록을 남긴다.
// ③ 새 기록의 파티원 수가 1 일 때만 옛 값으로 덮고 분배금을 다시 낸다. 2 이상은 새 카드에서 고친 값이다.

import type { BossProfitRecord } from '../../../storage/boss-profit'
import { planWorldLeapRecordPairs } from '../world-leap-records'

function record(overrides: Partial<BossProfitRecord>): BossProfitRecord {
  return {
    ocid: 'old',
    boss: '스우',
    difficulty: '하드',
    cycle: 'weekly',
    periodKey: '2026-09-10',
    partySize: 1,
    priceMeso: 1_000_000,
    payoutMeso: 1_000_000,
    recordedAt: '2026-09-11T00:00:00.000Z',
    world: '챌린저스2',
    ...overrides,
  }
}

const LEAP = { weekly: '2026-09-10', monthly: '2026-09' }

it('옛 기록을 지울 짝으로 내고, 새 기록의 파티원 수가 1 이면 옛 값으로 덮는다', () => {
  const stale = record({ ocid: 'old', partySize: 3, payoutMeso: 333_333 })
  const kept = record({ ocid: 'new', world: '엘리시움' })

  expect(
    planWorldLeapRecordPairs({ fromOcid: 'old', toOcid: 'new', leapPeriodKeys: LEAP, records: [stale, kept] }),
  ).toEqual([{ stale, kept: { ...kept, partySize: 3, payoutMeso: 333_333 }, keptChanged: true }])
})

it('새 기록의 파티원 수가 2 이상이면 새 카드에서 고친 값이라 지킨다', () => {
  const stale = record({ ocid: 'old', partySize: 3, payoutMeso: 333_333 })
  const kept = record({ ocid: 'new', partySize: 2, payoutMeso: 500_000 })

  expect(
    planWorldLeapRecordPairs({ fromOcid: 'old', toOcid: 'new', leapPeriodKeys: LEAP, records: [stale, kept] }),
  ).toEqual([{ stale, kept, keptChanged: false }])
})

it('둘 다 1 이면 새 기록을 다시 쓸 일이 없다', () => {
  const stale = record({ ocid: 'old' })
  const kept = record({ ocid: 'new' })

  expect(
    planWorldLeapRecordPairs({ fromOcid: 'old', toOcid: 'new', leapPeriodKeys: LEAP, records: [stale, kept] }),
  ).toEqual([{ stale, kept, keptChanged: false }])
})

// 새 ocid 는 리프 전 날짜를 못 불러 그 앞 기간 기록을 가질 수 없다. 결과는 같지만 판정에 기간을 둔다.
it('리프한 주가 아닌 기간의 같은 키는 짝이 아니다', () => {
  const stale = record({ ocid: 'old', periodKey: '2026-09-17' })
  const kept = record({ ocid: 'new', periodKey: '2026-09-17' })

  expect(
    planWorldLeapRecordPairs({ fromOcid: 'old', toOcid: 'new', leapPeriodKeys: LEAP, records: [stale, kept] }),
  ).toEqual([])
})

it('월간 보스는 리프한 달에서 짝을 찾는다', () => {
  const stale = record({ ocid: 'old', boss: '검은마법사', difficulty: '익스트림', cycle: 'monthly', periodKey: '2026-09' })
  const kept = record({ ocid: 'new', boss: '검은마법사', difficulty: '익스트림', cycle: 'monthly', periodKey: '2026-09' })

  expect(
    planWorldLeapRecordPairs({ fromOcid: 'old', toOcid: 'new', leapPeriodKeys: LEAP, records: [stale, kept] }),
  ).toEqual([{ stale, kept, keptChanged: false }])
})

// 새 ocid 가 아직 동기화 전이면 옛 기록 하나뿐이라 두 번 세지 않는다.
it('새 기록이 없는 옛 기록은 안 건드린다', () => {
  expect(
    planWorldLeapRecordPairs({
      fromOcid: 'old',
      toOcid: 'new',
      leapPeriodKeys: LEAP,
      records: [record({ ocid: 'old' }), record({ ocid: 'new', boss: '데미안' })],
    }),
  ).toEqual([])
})

it('주기의 리프 기간을 모르면 그 주기는 짝을 안 찾는다', () => {
  const stale = record({ ocid: 'old' })
  const kept = record({ ocid: 'new' })

  expect(
    planWorldLeapRecordPairs({
      fromOcid: 'old',
      toOcid: 'new',
      leapPeriodKeys: { monthly: '2026-09' },
      records: [stale, kept],
    }),
  ).toEqual([])
})

it('연결 밖 캐릭터의 기록은 안 본다', () => {
  expect(
    planWorldLeapRecordPairs({
      fromOcid: 'old',
      toOcid: 'new',
      leapPeriodKeys: LEAP,
      records: [record({ ocid: 'other' }), record({ ocid: 'new' })],
    }),
  ).toEqual([])
})
