// 잡지 않은 보스에 남은 드롭을 고르는 규칙. **순수 함수라 여기서 직접 못박는다.**
//
// 이 판정이 틀리면 사용자가 적은 판매가까지 함께 사라지므로 안전 장치 넷을 케이스로
// 하나씩 세운다. **행이 없다** 가 **안 잡았다** 를 뜻하지 않는 경우가 그 넷이다.
import type { BossDropRecord } from '../../../storage/boss-drops'
import { planOrphanDropCleanup } from '../orphan-drops'
import type { BossProfitRow } from '../rows'

const WEEK = '2026-08-27'

function record(overrides: Partial<BossDropRecord> = {}): BossDropRecord {
  return {
    ocid: 'ocid-1',
    boss: '자쿰',
    difficulty: '카오스',
    periodKey: WEEK,
    dropIndex: 0,
    category: 'equipment',
    itemName: '칠흑의 보스 반지 상자',
    slot: null,
    boxOrigin: null,
    ringLevel: null,
    quantity: 1,
    recordedAt: '2026-08-27T00:00:00.000Z',
    priceState: null,
    priceMeso: null,
    priceShare: null,
    ...overrides,
  }
}

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '단풍',
    imageUrl: null,
    world: null,
    boss: '매그너스',
    difficulty: '하드',
    cycle: 'weekly',
    periodKey: WEEK,
    periodLabel: '이번 주',
    priceMeso: 10_000_000,
    maxPartySize: 6,
    partySize: 1,
    payoutMeso: 10_000_000,
    isComplete: true,
    ...overrides,
  }
}

function plan(overrides: Partial<Parameters<typeof planOrphanDropCleanup>[0]> = {}) {
  return planOrphanDropCleanup({
    rows: [row()],
    records: [record()],
    trustedOcids: new Set(['ocid-1']),
    knownPeriodKeys: new Set([WEEK]),
    ...overrides,
  })
}

describe('planOrphanDropCleanup', () => {
  it('설 자리도 처치 기록도 없는 드롭 그룹을 고른다', () => {
    expect(plan()).toEqual([
      { ocid: 'ocid-1', boss: '자쿰', difficulty: '카오스', periodKey: WEEK, dropCount: 1 },
    ])
  })

  it('같은 그룹의 기록 수를 함께 센다. 토스트가 말할 값이다', () => {
    expect(plan({ records: [record({ dropIndex: 0 }), record({ dropIndex: 1 })] })[0].dropCount).toBe(2)
  })

  it('행이 있는 보스의 드롭은 건드리지 않는다', () => {
    expect(plan({ rows: [row({ boss: '자쿰', difficulty: '카오스' })] })).toEqual([])
  })

  // 안전 장치 ①. 난이도만 다른 행이 있으면 그것은 고아가 아니라 **난이도 키가 어긋난 것** 이고,
  // 옮기는 일은 이관의 몫이다.
  it('같은 보스의 다른 난이도 행이 있으면 지우지 않는다. 이관의 몫이다', () => {
    expect(plan({ rows: [row({ boss: '자쿰', difficulty: '노멀' })] })).toEqual([])
  })

  // 안전 장치 ②. 백필된 적 없는 과거 주는 기록이 통째로 비어 `행 없음`이 아무것도 뜻하지 않는다.
  it('그 캐릭터·기간에 행이 하나도 없으면 판정하지 않는다', () => {
    expect(plan({ rows: [] })).toEqual([])
    expect(plan({ rows: [row({ periodKey: '2026-08-20' })] })).toEqual([])
    expect(plan({ rows: [row({ ocid: 'ocid-2' })] })).toEqual([])
  })

  // 안전 장치 ③. 가격 미확정 보스는 완료여도 자동 기록이 안 남는다(`auto-record.ts` 의
  // `row.priceMeso === null` 가드). 참조표 밖 이름이 정확히 그 경우다.
  it('결정석 가격을 모르는 보스는 지우지 않는다', () => {
    expect(plan({ records: [record({ boss: '알 수 없는 보스' })] })).toEqual([])
  })

  // 안전 장치 ④. 동기화가 실패해 낡은 캐시로 그려진 캐릭터, 그리고 이 회차가 모르는 기간.
  it('믿을 수 없는 캐릭터는 지우지 않는다', () => {
    expect(plan({ trustedOcids: new Set() })).toEqual([])
  })

  it('이 회차가 모르는 기간은 지우지 않는다', () => {
    expect(plan({ knownPeriodKeys: new Set() })).toEqual([])
  })

  // 이 결정이 겨누는 실제 상황. 12마리를 채워 미완료 placeholder 가 사라진 자리.
  it('한도 마감으로 사라진 행의 드롭이 정확히 그 대상이다', () => {
    const result = planOrphanDropCleanup({
      // 열두 마리를 잡아 행이 열둘, 그중 `자쿰`은 없다(한도 마감으로 걷혔다).
      rows: [row({ boss: '매그너스' }), row({ boss: '스우' })],
      records: [record({ boss: '자쿰' }), record({ boss: '스우', difficulty: '하드' })],
      trustedOcids: new Set(['ocid-1']),
      knownPeriodKeys: new Set([WEEK]),
    })

    expect(result.map((group) => group.boss)).toEqual(['자쿰'])
  })
})
