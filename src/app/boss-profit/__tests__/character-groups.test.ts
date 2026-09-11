// 캐릭터 그룹 계산. 두 `null` 을 가르는 케이스를 함께 본다.
//
// 이 파일이 지키는 것은 계산이지 화면이 아니다. "값을 안 매긴 드롭은 합에 안 들어간다"와
// "금액을 모르는 행의 0은 합산 편의값이지 표시값이 아니다"가 서로 다른 층이라는 사실이 여기서
// 시작해 `ItemRevenuePopover`·`BossProfitBossRow` 테스트로 이어진다.
import { dropRowKey } from '../../../features/boss-profit/store'
import type { BossProfitRow } from '../../../features/boss-profit/store'
import type { RecordedDrop } from '../../../types/drops'

import valuableDropsData from '../../../data/valuable-drops.json'

import {
  buildCharacterGroups,
  collectAllValuableDrops,
  collectGroupDrops,
  collectGroupValuableDrops,
  collectPayableDrops,
  groupTotalMeso,
  sumPayout,
} from '../character-groups'
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

// 미완료 행에도 드롭을 적을 수 있다(처치 직후 `complete_flag` 갱신 전에 적으라고 열어 둔 자리다).
// 그런데 그 행은 금액 자리에 `미완료` 배지를 세워 돈을 아예 안 그린다. 합만 그것을 더하면 **카드
// 어디에도 없는 돈이 총액에 선다**(사용자 보고).
const 고가드롭: RecordedDrop = {
  category: 'equipment',
  itemName: valuableDropsData.items[0],
  quantity: 1,
}

describe('미완료 행의 드롭은 돈으로 안 센다', () => {
  const 미완료 = 보스행({ isComplete: false, payoutMeso: null, defeatedOn: null })
  const 미완료드롭 = { [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: priced }

  it('미완료 행의 드롭은 합에 안 든다', () => {
    expect(groupTotalMeso(group([미완료]), 미완료드롭)).toBe(0)
  })

  it('완료로 바뀌면 같은 기록이 그대로 금액에 들어온다', () => {
    expect(groupTotalMeso(group([보스행()]), 미완료드롭)).toBe(6_800_000_000 + 5_000_000_000)
  })

  it('한 그룹에 섞여 있으면 완료된 행의 것만 더한다', () => {
    const drops = {
      [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: priced,
      [dropRowKey('ocid-1', 다른주간보스, '카오스', PERIOD)]: priced,
    }
    const 완료 = 보스행({ boss: 다른주간보스, difficulty: '카오스', payoutMeso: 1_000_000_000 })

    expect(groupTotalMeso(group([미완료, 완료]), drops)).toBe(1_000_000_000 + 5_000_000_000)
  })

  it('`collectPayableDrops` 는 미완료 행의 드롭을 빼고 모은다', () => {
    expect(collectPayableDrops(group([미완료]), 미완료드롭)).toEqual([])
    expect(collectPayableDrops(group([보스행()]), 미완료드롭)).toEqual(priced)
  })

  // 기록이 있는가 를 묻는 자리(today 의 `hasRecords`)가 이것을 쓴다. 적은 것을 못 찾게 되면 안 된다.
  it('`collectGroupDrops` 는 안 가른다. 기록 전부를 그대로 낸다', () => {
    expect(collectGroupDrops(group([미완료]), 미완료드롭)).toEqual(priced)
  })

  // 카드 겉면(골드 링·글로우·우상단 배지)이 이것을 본다. 미완료 행이 금액 자리에 `미완료` 를
  // 세우는데 같은 드롭이 카드를 두르면, 카드가 펼쳐 봐도 없는 것을 겉면에서 주장한다.
  it('미완료 행의 고가 드롭은 카드 겉면을 못 만든다', () => {
    const 고가 = { [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: [고가드롭] }

    expect(collectGroupValuableDrops(group([미완료]), 고가)).toEqual([])
    expect(collectAllValuableDrops([group([미완료])], 고가)).toEqual([])
  })

  it('완료된 행의 고가 드롭은 그대로 선다', () => {
    const 고가 = { [dropRowKey('ocid-1', 주간보스, '하드', PERIOD)]: [고가드롭] }

    expect(collectGroupValuableDrops(group([보스행()]), 고가)).toEqual([고가드롭])
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

// 이전으로 남겨진 ocid 는 동기화가 안 돌고 이번 주 기록도 없어 행이 0개다. 행에서만 카드를
// 만들면 그 캐릭터가 화면에서 통째로 사라져, 빠진 것 과 0원인 것 이 같아진다.
describe('buildCharacterGroups 의 조회 불가 카드', () => {
  const 조회불가 = { ocid: 'stranded', characterName: '지내우시', imageUrl: null }

  it('행이 없어도 카드를 세운다', () => {
    const groups = buildCharacterGroups([], [], [조회불가])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ ocid: 'stranded', characterName: '지내우시', bossRows: [] })
  })

  it('이미 행이 있는 캐릭터는 두 번 안 만든다', () => {
    const groups = buildCharacterGroups([보스행()], [], [
      { ocid: 보스행().ocid, characterName: '아무개', imageUrl: null },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].bossRows).toHaveLength(1)
  })

  // 행이 있는 카드가 먼저 서야 화면 순서가 지금과 안 갈린다. 순서는 `orderByTracked` 가 다시
  // 세우지만, 그 함수는 추적 목록에 없는 캐릭터의 차례를 이 배열 순서로 둔다.
  it('행에서 만든 카드 뒤에 붙는다', () => {
    const groups = buildCharacterGroups([보스행()], [], [조회불가])

    expect(groups.map((group) => group.ocid)).toEqual([보스행().ocid, 'stranded'])
  })

  it('안 넘기면 지금과 같다', () => {
    expect(buildCharacterGroups([보스행()], [])).toHaveLength(1)
  })
})
