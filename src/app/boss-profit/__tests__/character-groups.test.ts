// 캐릭터 합계에 아이템 수익이 들어가는지([[ADR-124]] 결정 7). 보스 행 금액은 결정석만 담고
// 드롭은 **읽는 시점에** 더하므로, 그 덧셈이 여기서 한 번만 일어나야 한다.
import { describe, expect, it } from 'vitest'
import { groupTotalMeso } from '../character-groups'
import type { CharacterGroup } from '../character-groups'
import { dropRowKey } from '../../../features/boss-profit/store'
import type { BossProfitRow } from '../../../features/boss-profit/store'
import type { RecordedDrop } from '../../../types/drops'

const PERIOD = '2026-08-06'

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '지내우시',
    imageUrl: null,
    world: null,
    boss: '스우',
    difficulty: '하드',
    cycle: 'weekly',
    periodKey: PERIOD,
    periodLabel: '이번 주',
    priceMeso: 20_400_000_000,
    maxPartySize: 6,
    partySize: 3,
    payoutMeso: 6_800_000_000,
    isComplete: true,
    ...overrides,
  }
}

function group(rows: BossProfitRow[]): CharacterGroup {
  return { ocid: 'ocid-1', characterName: '지내우시', imageUrl: null, bossRows: rows, weeklySubtotals: [] }
}

const priced: RecordedDrop[] = [
  {
    category: 'equipment',
    itemName: '루즈 컨트롤 머신 마크',
    quantity: 1,
    priceState: 'entered',
    priceMeso: 15_000_000_000,
    priceShare: 3,
  },
]

describe('groupTotalMeso — 아이템 수익 합산 (ADR-124)', () => {
  it('보스 행 결정석 합에 그 행의 드롭 수익을 더한다', () => {
    const rows = [row()]
    const drops = { [dropRowKey('ocid-1', '스우', '하드', PERIOD)]: priced }

    expect(groupTotalMeso(group(rows), drops)).toBe(6_800_000_000 + 5_000_000_000)
  })

  it('드롭이 없으면 결정석 합 그대로다', () => {
    expect(groupTotalMeso(group([row()]), {})).toBe(6_800_000_000)
  })

  it('다른 행의 드롭은 세지 않는다 — 키가 (ocid, boss, difficulty, periodKey) 다', () => {
    const drops = { [dropRowKey('ocid-1', '더스크', '카오스', PERIOD)]: priced }

    expect(groupTotalMeso(group([row()]), drops)).toBe(6_800_000_000)
  })

  it('스킵·미입력은 더하지 않는다', () => {
    const drops = {
      [dropRowKey('ocid-1', '스우', '하드', PERIOD)]: [
        { category: 'equipment' as const, itemName: '가디언 엔젤 링', quantity: 1 },
        { category: 'equipment' as const, itemName: '거대한 공포', quantity: 1, priceState: 'excluded' as const },
      ],
    }

    expect(groupTotalMeso(group([row()]), drops)).toBe(6_800_000_000)
  })
})
