// 행 도메인 순수 함수 직접 검증 — store.ts 에서 분리하며 비로소 가능해진 것이다(ADR-094 5단계).
//
// 그 전에는 export 된 것이 dropRowKey 하나뿐이라, 89개 스토어 테스트가 전부 스토어를 거쳐
// 간접 검증했다. 정렬처럼 "입력을 어떻게 주느냐"가 핵심인 로직은 그 방식으로는 경우를
// 만들기가 번거로워, 실제로 결정적 정렬(ADR-036·#28)에 직접 붙은 테스트가 없었다.
import { describe, expect, it } from 'vitest'
import { filterRowsForTab, matchesRowKey, sortRowsByOcidOrder, sumRowsPayout } from '../rows'
import type { BossProfitRow } from '../store'

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    imageUrl: null,
    world: null,
    boss: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    periodKey: '2026-07-09',
    periodLabel: '이번 주',
    priceMeso: 10_000_000,
    maxPartySize: 6,
    partySize: 2,
    payoutMeso: 5_000_000,
    isComplete: true,
    ...overrides,
  }
}

describe('sortRowsByOcidOrder', () => {
  it('sortedOcids 순서를 1차 키로 쓴다', () => {
    const rows = [row({ ocid: 'b' }), row({ ocid: 'a' })]

    const sorted = sortRowsByOcidOrder(rows, ['a', 'b'])

    expect(sorted.map((r) => r.ocid)).toEqual(['a', 'b'])
  })

  // ADR-036·#28: 예전에는 ocid 로만 정렬하고 stable sort 에 기대 보스 순서를 데이터 소스가
  // 만든 순서 그대로 물려받았는데, 그 소스 순서가 비결정적이라(ORDER BY 없는 조회, Map 삽입
  // 순서) 로드마다 보스 순서가 달라졌다.
  it('같은 캐릭터 안에서는 참조 데이터 순서로 보스를 결정적으로 정렬한다', () => {
    const rows = [row({ boss: '스우' }), row({ boss: '자쿰' }), row({ boss: '루시드' })]

    const once = sortRowsByOcidOrder(rows, ['ocid-1']).map((r) => r.boss)
    const twice = sortRowsByOcidOrder([...rows].reverse(), ['ocid-1']).map((r) => r.boss)

    // 입력 순서가 달라도 결과가 같아야 "결정적"이다.
    expect(twice).toEqual(once)
  })

  it('sortedOcids 밖의 캐릭터는 뒤로 보내되 서로 섞이지 않는다', () => {
    const rows = [row({ ocid: 'z' }), row({ ocid: 'a' }), row({ ocid: 'y' })]

    const sorted = sortRowsByOcidOrder(rows, ['a'])

    expect(sorted[0].ocid).toBe('a')
    expect(sorted.slice(1).map((r) => r.ocid)).toEqual(['y', 'z'])
  })

  it('원본 배열을 변형하지 않는다', () => {
    const rows = [row({ ocid: 'b' }), row({ ocid: 'a' })]

    sortRowsByOcidOrder(rows, ['a', 'b'])

    expect(rows.map((r) => r.ocid)).toEqual(['b', 'a'])
  })
})

describe('filterRowsForTab', () => {
  it('탭(cycle)과 기간이 모두 맞는 행만 남긴다', () => {
    const rows = [
      row({ cycle: 'weekly', periodKey: '2026-07-09' }),
      row({ cycle: 'monthly', periodKey: '2026-07-09' }),
      row({ cycle: 'weekly', periodKey: '2026-07-02' }),
    ]

    const kept = filterRowsForTab(rows, 'weekly', '2026-07-09')

    expect(kept).toHaveLength(1)
    expect(kept[0].cycle).toBe('weekly')
    expect(kept[0].periodKey).toBe('2026-07-09')
  })
})

describe('sumRowsPayout', () => {
  it('payoutMeso를 더한다', () => {
    expect(sumRowsPayout([row({ payoutMeso: 100 }), row({ payoutMeso: 250 })])).toBe(350)
  })

  it('빈 배열은 0이다 — "기록 없음"과 "0메소"를 호출부가 구분할 수 있게 던지지 않는다', () => {
    expect(sumRowsPayout([])).toBe(0)
  })
})

describe('matchesRowKey', () => {
  const key = {
    ocid: 'ocid-1',
    boss: '자쿰',
    difficulty: '카오스' as const,
    cycle: 'weekly' as const,
    periodKey: '2026-07-09',
  }

  it('다섯 필드가 모두 같아야 같은 행이다', () => {
    expect(matchesRowKey(row(), key)).toBe(true)
  })

  it('난이도만 달라도 다른 행이다 — 등록 난이도 ≠ 처치 난이도 오류의 근원(ADR-033)', () => {
    expect(matchesRowKey(row({ difficulty: '하드' }), key)).toBe(false)
  })
})
