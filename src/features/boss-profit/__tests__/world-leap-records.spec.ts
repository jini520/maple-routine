// 월드 리프한 기간에 같은 처치가 옛 ocid 와 새 ocid 로 한 번씩 선 기록의 짝짓기.
//
// ① 짝은 리프한 주와 그 달(새 ocid 의 주기별 가장 이른 기록 기간)에서만 찾는다.
// ② 옛 기록을 지우고 새 기록을 남긴다.
// ③ 새 기록의 파티원 수가 1 일 때만 옛 값으로 덮고 분배금을 다시 낸다. 2 이상은 새 카드에서 고친 값이다.

jest.mock('../../../storage/character-world-leaps', () => ({ getCharacterWorldLeaps: jest.fn() }))
jest.mock('../../../storage/boss-profit', () => ({
  getEarliestBossProfitPeriodKeys: jest.fn(),
  getBossProfitRecords: jest.fn(),
  upsertBossProfitRecord: jest.fn(),
  deleteBossProfitRecord: jest.fn(),
}))
jest.mock('../../../storage/boss-drops', () => ({
  getBossDropRecords: jest.fn(),
  replaceBossDropRecords: jest.fn(),
}))

import type { BossDropRecord } from '../../../storage/boss-drops'
import type { BossProfitRecord } from '../../../storage/boss-profit'
import type { RecordedDrop } from '../../../types/drops'
import { cleanUpWorldLeapDuplicates, mergeWorldLeapDrops, planWorldLeapRecordPairs } from '../world-leap-records'

const { getCharacterWorldLeaps: linksMock } = jest.requireMock('../../../storage/character-world-leaps') as Record<
  string,
  jest.Mock
>
const {
  getEarliestBossProfitPeriodKeys: earliestMock,
  getBossProfitRecords: recordsMock,
  upsertBossProfitRecord: upsertMock,
  deleteBossProfitRecord: deleteMock,
} = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
const { getBossDropRecords: dropsMock, replaceBossDropRecords: replaceDropsMock } = jest.requireMock(
  '../../../storage/boss-drops',
) as Record<string, jest.Mock>

function record(overrides: Partial<BossProfitRecord>): BossProfitRecord {
  return {
    ocid: 'old',
    bossKey: 'lotus',
    boss: '스우',
    difficulty: 'hard',
    cycle: 'weekly',
    periodKey: '2026-09-10',
    partySize: 1,
    priceMeso: 1_000_000,
    payoutMeso: 1_000_000,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    recordedAt: '2026-09-11T00:00:00.000Z',
    world: '챌린저스2',
    worldKey: 'challengers_2',
    ...overrides,
  }
}

const LEAP = { weekly: '2026-09-10', monthly: '2026-09' }

it('옛 기록을 지울 짝으로 내고, 새 기록의 파티원 수가 1 이면 옛 값으로 덮는다', () => {
  const stale = record({ ocid: 'old', partySize: 3, payoutMeso: 333_333 })
  const kept = record({ ocid: 'new', world: '엘리시움', worldKey: 'elysium' })

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
  const stale = record({ ocid: 'old', bossKey: 'black_mage', boss: '검은마법사', difficulty: 'extreme', cycle: 'monthly', periodKey: '2026-09' })
  const kept = record({ ocid: 'new', bossKey: 'black_mage', boss: '검은마법사', difficulty: 'extreme', cycle: 'monthly', periodKey: '2026-09' })

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
      records: [record({ ocid: 'old' }), record({ ocid: 'new', bossKey: 'damien', boss: '데미안' })],
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

/** 테스트가 쓰는 드롭 이름의 key. `drop-items.json` 과 같다. */
const KEY_BY_NAME: Record<string, string> = {
  '루즈 컨트롤 머신 마크': 'loose_control_machine_mark',
  '마력이 깃든 안대': 'magic_eyepatch',
  '리스트레인트 링': 'restraint_ring',
  '웨폰퍼프 - I링': 'weapon_puff_i_ring',
  '홍옥의 보스 반지 상자': 'red_boss_ring_box',
}

function drop(itemName: string, overrides: Partial<RecordedDrop> = {}): RecordedDrop {
  return { category: 'equipment', itemKey: KEY_BY_NAME[itemName] ?? null, itemName, quantity: 1, ...overrides }
}

// 같은 드롭은 같은 타일이다. 일반 아이템은 아이템 key, 상자 결과는 상자 key.
describe('mergeWorldLeapDrops', () => {
  it('새 카드 드롭을 그대로 두고 새 카드에 없는 옛 카드 드롭을 뒤에 붙인다', () => {
    expect(mergeWorldLeapDrops([drop('루즈 컨트롤 머신 마크')], [drop('마력이 깃든 안대')])).toEqual([
      drop('루즈 컨트롤 머신 마크'),
      drop('마력이 깃든 안대'),
    ])
  })

  it('같은 아이템이면 새 카드 쪽이 남는다. 옛 카드의 가격은 버린다', () => {
    const kept = drop('루즈 컨트롤 머신 마크')
    const stale = drop('루즈 컨트롤 머신 마크', { priceState: 'entered', priceMeso: 1_000_000_000 })

    expect(mergeWorldLeapDrops([kept], [stale])).toEqual([kept])
  })

  it('같은 상자면 나온 반지가 달라도 새 카드 결과만 남는다', () => {
    const box = { category: 'consumable' as const, boxOriginKey: 'red_boss_ring_box', boxOrigin: '홍옥의 보스 반지 상자' }
    const kept = drop('리스트레인트 링', { ...box, ringLevel: 3 })
    const stale = drop('웨폰퍼프 - I링', { ...box, ringLevel: 4 })

    expect(mergeWorldLeapDrops([kept], [stale])).toEqual([kept])
  })

  // 이름을 바꿔도 옛 기록이 같은 아이템으로 따라온다. 그래서 적힌 이름이 달라도 key 가 같으면 같은 타일이다.
  it('적힌 이름이 달라도 아이템 key 가 같으면 같은 드롭이다', () => {
    const kept = drop('마력이 깃든 안대')
    const stale = drop('옛 이름의 안대', { itemKey: 'magic_eyepatch' })

    expect(mergeWorldLeapDrops([kept], [stale])).toEqual([kept])
  })

  it('key 가 없는 옛 기록은 적힌 이름으로 가른다', () => {
    const first = drop('익셉셔널 해머')
    const second = drop('익셉셔널 해머')
    const other = drop('루인 포스실드')

    expect(mergeWorldLeapDrops([first], [second, other])).toEqual([first, other])
  })

  it('옛 카드 안에서 같은 아이템이 겹치면 앞선 하나만 붙인다', () => {
    const first = drop('마력이 깃든 안대', { priceState: 'entered', priceMeso: 500_000_000 })
    const second = drop('마력이 깃든 안대')

    expect(mergeWorldLeapDrops([], [first, second])).toEqual([first])
  })
})

describe('cleanUpWorldLeapDuplicates', () => {
  const NOW = new Date('2026-09-14T03:00:00.000Z')
  const stale = record({ ocid: 'old', partySize: 3, payoutMeso: 333_333 })
  const kept = record({ ocid: 'new', world: '엘리시움', worldKey: 'elysium' })

  function stored(ocid: string, dropIndex: number, itemName: string, overrides: Partial<BossDropRecord> = {}): BossDropRecord {
    return {
      ocid,
      bossKey: 'lotus',
      boss: '스우',
      difficulty: 'hard',
      periodKey: '2026-09-10',
      dropIndex,
      category: 'equipment',
      itemKey: KEY_BY_NAME[itemName] ?? null,
      itemName,
      slot: null,
      boxOriginKey: null,
      boxOrigin: null,
      ringLevel: null,
      quantity: 1,
      recordedAt: '2026-09-11T00:00:00.000Z',
      priceState: null,
      priceMeso: null,
      priceShare: null,
      priceMyShare: null,
      saleFeePercent: null,
      splitFeePercent: null,
      saleFeeAuto: false,
      splitFeeAuto: false,
      ...overrides,
    }
  }

  beforeEach(() => {
    linksMock.mockReset().mockResolvedValue([{ fromOcid: 'old', toOcid: 'new', linkedAt: '2026-09-13T00:00:00.000Z' }])
    earliestMock.mockReset().mockResolvedValue({ weekly: '2026-09-10', monthly: '2026-09' })
    recordsMock.mockReset().mockResolvedValue([stale, kept])
    dropsMock.mockReset().mockResolvedValue([])
    upsertMock.mockReset().mockResolvedValue(undefined)
    deleteMock.mockReset().mockResolvedValue(undefined)
    replaceDropsMock.mockReset().mockResolvedValue(undefined)
  })

  it('리프한 주와 그 달의 기록만 읽어 옛 기록을 지우고 지운 수를 돌려준다', async () => {
    await expect(cleanUpWorldLeapDuplicates(NOW)).resolves.toBe(1)

    expect(earliestMock).toHaveBeenCalledWith('new')
    expect(recordsMock).toHaveBeenCalledWith(['old', 'new'], ['2026-09-10', '2026-09'])
    expect(deleteMock).toHaveBeenCalledWith(stale)
  })

  it('새 기록 파티원 수가 1 이면 옛 값으로 다시 쓴다', async () => {
    await cleanUpWorldLeapDuplicates(NOW)

    expect(upsertMock).toHaveBeenCalledWith({ ...kept, partySize: 3, payoutMeso: 333_333 })
  })

  it('옛 카드 드롭을 새 카드에 합치고 옛 키를 비운다. 새 쪽을 먼저 쓴다', async () => {
    dropsMock.mockResolvedValue([
      stored('new', 0, '루즈 컨트롤 머신 마크'),
      stored('old', 0, '루즈 컨트롤 머신 마크', { priceState: 'entered', priceMeso: 1_000_000_000 }),
      stored('old', 1, '마력이 깃든 안대', { priceState: 'entered', priceMeso: 500_000_000, priceShare: 3 }),
    ])
    const order: string[] = []
    replaceDropsMock.mockImplementation(async (ocid: string) => void order.push(`drops:${ocid}`))
    deleteMock.mockImplementation(async () => void order.push('delete'))

    await cleanUpWorldLeapDuplicates(NOW)

    expect(replaceDropsMock).toHaveBeenCalledWith(
      'new',
      'lotus',
      'hard',
      '2026-09-10',
      [
        { category: 'equipment', itemKey: 'loose_control_machine_mark', itemName: '루즈 컨트롤 머신 마크', quantity: 1 },
        {
          category: 'equipment',
          itemKey: 'magic_eyepatch',
          itemName: '마력이 깃든 안대',
          quantity: 1,
          priceState: 'entered',
          priceMeso: 500_000_000,
          priceShare: 3,
        },
      ],
      NOW.toISOString(),
    )
    expect(replaceDropsMock).toHaveBeenCalledWith('old', 'lotus', 'hard', '2026-09-10', [], NOW.toISOString())
    expect(order).toEqual(['drops:new', 'drops:old', 'delete'])
  })

  // 중간에 앱이 죽어 새 카드에 이미 합쳐졌으면 다음 회차가 같은 짝을 다시 찾는다. 두 번 붙이면 안 된다.
  it('옛 카드 드롭이 이미 새 카드에 다 있으면 새 카드를 다시 안 쓴다', async () => {
    dropsMock.mockResolvedValue([stored('new', 0, '마력이 깃든 안대'), stored('old', 0, '마력이 깃든 안대')])

    await cleanUpWorldLeapDuplicates(NOW)

    expect(replaceDropsMock).not.toHaveBeenCalledWith('new', expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything())
    expect(replaceDropsMock).toHaveBeenCalledWith('old', 'lotus', 'hard', '2026-09-10', [], NOW.toISOString())
  })

  it('새 ocid 에 기록이 없으면 아무것도 안 읽는다', async () => {
    earliestMock.mockResolvedValue({})

    await expect(cleanUpWorldLeapDuplicates(NOW)).resolves.toBe(0)
    expect(recordsMock).not.toHaveBeenCalled()
  })

  // 한 연결의 실패가 다른 연결의 정리를 막으면 안 된다. 다음 회차가 다시 온다.
  it('한 연결이 던져도 다음 연결은 정리한다', async () => {
    linksMock.mockResolvedValue([
      { fromOcid: 'broken', toOcid: 'x', linkedAt: '2026-09-13T00:00:00.000Z' },
      { fromOcid: 'old', toOcid: 'new', linkedAt: '2026-09-13T00:00:00.000Z' },
    ])
    earliestMock.mockImplementation(async (ocid: string) => {
      if (ocid === 'x') throw new Error('sqlite')
      return { weekly: '2026-09-10' }
    })

    await expect(cleanUpWorldLeapDuplicates(NOW)).resolves.toBe(1)
    expect(deleteMock).toHaveBeenCalledWith(stale)
  })
})
