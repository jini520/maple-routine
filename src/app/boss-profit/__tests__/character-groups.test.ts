// 캐릭터 그룹 계산. 두 `null` 을 가르는 케이스를 함께 본다.
//
// 이 파일이 지키는 것은 계산이지 화면이 아니다. "값을 안 매긴 드롭은 합에 안 들어간다"와
// "금액을 모르는 행의 0은 합산 편의값이지 표시값이 아니다"가 서로 다른 층이라는 사실이 여기서
// 시작해 `ItemRevenuePopover`·`BossProfitBossRow` 테스트로 이어진다.
import { dropRowKey } from '../../../features/boss-profit/store'
import type { BossProfitRow } from '../../../features/boss-profit/store'
import type { RecordedDrop } from '../../../types/drops'

import { groupTotalMeso, sumPayout } from '../character-groups'
import type { CharacterGroup } from '../character-groups'
import { 다른주간보스, PERIOD, 월간보스, 보스행, 주간보스, 주차소계 } from './harness'

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

describe('groupTotalMeso: 아이템 수익 합산', () => {
  it('보스 행 결정석 합에 그 행의 드롭 수익을 더한다', () => {
    const drops = { [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: priced }

    expect(groupTotalMeso(group([보스행()]), drops)).toBe(6_800_000_000 + 5_000_000_000)
  })

  it('드롭이 없으면 결정석 합 그대로다', () => {
    expect(groupTotalMeso(group([보스행()]), {})).toBe(6_800_000_000)
  })

  it('다른 행의 드롭은 세지 않는다. 키가 (ocid, boss, difficulty, periodKey) 다', () => {
    const drops = { [dropRowKey('ocid-1', 다른주간보스, '카오스', PERIOD)]: priced }

    expect(groupTotalMeso(group([보스행()]), drops)).toBe(6_800_000_000)
  })

  it('스킵·미입력은 더하지 않는다', () => {
    const drops = {
      [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: [
        { category: 'equipment' as const, itemName: '가디언 엔젤 링', quantity: 1 },
        { category: 'equipment' as const, itemName: '거대한 공포', quantity: 1, priceState: 'excluded' as const },
      ],
    }

    expect(groupTotalMeso(group([보스행()]), drops)).toBe(6_800_000_000)
  })
})

// 드롭 가격의 "미입력 ≠ 0원"과 **다른 `null`** 이다. 여기 0은 합산 편의값이고, 그 행의 화면에는
// 금액 대신 `미완료`·`가격 미확정` 배지가 선다(`BossProfitBossRow` 테스트가 그쪽을 지킨다).
describe('sumPayout: 금액을 모르는 행', () => {
  it('미완료 placeholder 와 가격 미확정 행은 0으로 접힌다', () => {
    const rows = [
      보스행({ isComplete: false, payoutMeso: null }),
      보스행({ boss: 다른주간보스, priceMeso: null, payoutMeso: null }),
    ]

    expect(sumPayout(rows)).toBe(0)
  })

  it('그 행들이 섞여 있어도 아는 금액은 온전히 더한다', () => {
    const rows = [보스행(), 보스행({ boss: 다른주간보스, payoutMeso: null })]

    expect(sumPayout(rows)).toBe(6_800_000_000)
  })
})

// 월간 탭은 금액의 원천이 주차 소계 하나다. 월간 보스 수익은 그 보스가 선 주의 소계 안에 이미
// 들어 있고, 행은 아바타 진행 링을 위해서만 그룹에 실려 온다. 함께 더하면 두 번 센다.
describe('월간 탭의 금액은 주차 소계가 전부다', () => {
  it('주차 소계가 있으면 보스 행을 안 더한다', () => {
    const 월간행 = 보스행({ boss: 월간보스, cycle: 'monthly', periodKey: '2026-08', payoutMeso: 9_000_000_000 })
    const 소계 = 주차소계({ totalMeso: 20_000_000_000 })

    expect(groupTotalMeso({ ...group([월간행]), weeklySubtotals: [소계] }, {})).toBe(20_000_000_000)
  })

  it('그 행에 붙은 드롭도 안 더한다', () => {
    const 월간행 = 보스행({ boss: 월간보스, cycle: 'monthly', periodKey: '2026-08', payoutMeso: 0 })
    const drops = {
      [dropRowKey(월간행.ocid, 월간행.boss, 월간행.difficulty, 월간행.periodKey)]: [
        { category: 'equipment' as const, itemName: '반지', quantity: 1, priceState: 'entered' as const, priceMeso: 5_000_000_000, priceShare: 1 },
      ],
    }

    expect(
      groupTotalMeso({ ...group([월간행]), weeklySubtotals: [주차소계({ totalMeso: 1_000 })] }, drops),
    ).toBe(1_000)
  })
})
