import type { BossDropRecord } from '../../../storage/boss-drops'

jest.mock('../../../storage/boss-drops', () => ({ getAllBossDropRecords: jest.fn() }))
jest.mock('../../../storage/boss-profit', () => ({
  getAllBossProfitRecordKeys: jest.fn(),
  getRecordedCharacterOcids: jest.fn(),
}))
jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
jest.mock('../../character-profile/resolve', () => ({ resolveDisplayProfiles: jest.fn() }))

import { dropHistoryOptions, loadDropHistory } from '../drop-history-query'

const { getAllBossDropRecords: getAllBossDropRecordsMock } = jest.requireMock('../../../storage/boss-drops') as Record<string, jest.Mock>
const {
  getAllBossProfitRecordKeys: getAllBossProfitRecordKeysMock,
  getRecordedCharacterOcids: getRecordedCharacterOcidsMock,
} = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
const { getTrackedCharacterOcids: getTrackedCharacterOcidsMock } = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>
const { resolveDisplayProfiles: resolveDisplayProfilesMock } = jest.requireMock('../../character-profile/resolve') as Record<string, jest.Mock>

function dropRecord(overrides: Partial<BossDropRecord>): BossDropRecord {
  return {
    ocid: 'ocid-1',
    bossKey: 'lotus',
    boss: '스우',
    difficulty: 'hard',
    periodKey: '2026-07-09',
    dropIndex: 0,
    dropRecordId: 'drop-1',
    world: null,
    worldKey: null,
    category: 'equipment',
    itemKey: 'loose_control_machine_mark',
    itemName: '루즈 컨트롤 머신 마크',
    boxOriginKey: null,
    boxOrigin: null,
    ringLevel: null,
    priceState: null,
    priceMeso: null,
    priceSplitMode: 'even',
    pricePartySize: null,
    priceShare: null,
    priceMyShare: null,
    saleFeePercent: null,
    splitFeePercent: null,
    saleFeeAuto: false,
    splitFeeAuto: false,
    quantity: 1,
    // 히스토리는 이 값을 쓰지 않는다. 그룹 재기록으로 덮이는 감사 필드다.
    recordedAt: '2026-07-31T00:00:00.000Z',
    pricedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  getAllBossDropRecordsMock.mockReset().mockResolvedValue([])
  getAllBossProfitRecordKeysMock.mockReset().mockResolvedValue([])
  getTrackedCharacterOcidsMock.mockReset().mockResolvedValue(['ocid-1'])
  getRecordedCharacterOcidsMock.mockReset().mockResolvedValue([])
  resolveDisplayProfilesMock
    .mockReset()
    .mockImplementation(async (ocids: readonly string[]) =>
      new Map(
        [...new Set(ocids)].map((ocid) => [
          ocid,
          { name: '메이플영웅', imageUrl: 'https://img/1.png', world: null, worldKey: null, level: 290 },
        ]),
      ),
    )
})

describe('dropHistoryOptions', () => {
  // 드롭 입력 시트가 쓰고 자동 기록이 난이도를 확정하면 이 쿼리가 다시 읽혀야 한다. 표를 안 적으면 무효화가 안 닿아
  // 히스토리와 today 의 드롭 위젯이 옛 값에 머문다.
  it('드롭 기록과 보스 기록 표를 읽는 쿼리로 적는다', () => {
    expect(dropHistoryOptions.meta?.tables).toEqual(['boss_drop_records', 'boss_profit_records'])
  })
})

describe('loadDropHistory', () => {
  it('전 기간 드롭 기록을 기간별로 묶어 최신 순으로 담는다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ periodKey: '2026-07-16' }),
      dropRecord({ periodKey: '2026-07-09' }),
    ])

    const data = await loadDropHistory()

    expect(getAllBossDropRecordsMock).toHaveBeenCalledWith(['ocid-1'])
    expect(data.groups.map((group) => group.periodKey)).toEqual(['2026-07-16', '2026-07-09'])
  })

  // today 의 `최고가 아이템`(entered 만 순위)·`가격 미입력`(undefined 만 카운트)이 이 세 필드를
  // 읽는다. 빠지면 저장은 됐는데 최고가는 영영 비고 미입력 건수는 안 준다.
  it('가격 세 필드를 함께 담는다. 빠지면 `입력해도 미입력`이 된다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ priceState: 'entered', priceMeso: 1_200_000_000, priceShare: 2 }),
    ])

    const data = await loadDropHistory()

    expect(data.groups[0].records[0]).toMatchObject({
      priceState: 'entered',
      priceMeso: 1_200_000_000,
      priceShare: 2,
    })
  })

  it('저장 계층의 null 은 undefined 로 정규화한다. `미입력`과 `0메소`가 갈린다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ priceState: null, priceMeso: null, priceShare: null }),
    ])

    const record = (await loadDropHistory()).groups[0].records[0]

    expect(record.priceState).toBeUndefined()
    expect(record.priceMeso).toBeUndefined()
    expect(record.priceShare).toBeUndefined()
  })

  it('확정 난이도 조합의 획득 불가 기록을 거른다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ itemKey: 'loose_control_machine_mark', itemName: '루즈 컨트롤 머신 마크', dropIndex: 0 }), // 하드+익스 → 유지
      dropRecord({ itemKey: 'complete_under_control', itemName: '컴플리트 언더컨트롤', dropIndex: 1 }), // 익스 전용 → 제거
    ])
    getAllBossProfitRecordKeysMock.mockResolvedValue([
      { ocid: 'ocid-1', bossKey: 'lotus', boss: '스우', difficulty: 'hard', periodKey: '2026-07-09' },
    ])

    const data = await loadDropHistory()

    expect(data.groups[0].records.map((record) => record.itemName)).toEqual(['루즈 컨트롤 머신 마크'])
  })

  // 이관이 이름을 못 찾아 key 가 빈 옛 기록. 못 찾은 것이 못 먹은 것은 아니라 숨기지 않는다.
  it('확정 난이도 조합이어도 아이템 key 가 없는 옛 기록은 거르지 않는다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([dropRecord({ itemKey: null, itemName: '익셉셔널 해머' })])
    getAllBossProfitRecordKeysMock.mockResolvedValue([
      { ocid: 'ocid-1', bossKey: 'lotus', boss: '스우', difficulty: 'hard', periodKey: '2026-07-09' },
    ])

    const data = await loadDropHistory()

    expect(data.groups[0].records.map((record) => record.itemName)).toEqual(['익셉셔널 해머'])
  })

  it('수익 기록이 없는(=난이도 미확정) 조합은 거르지 않는다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ itemKey: 'complete_under_control', itemName: '컴플리트 언더컨트롤' }),
    ])
    getAllBossProfitRecordKeysMock.mockResolvedValue([])

    const data = await loadDropHistory()

    expect(data.groups[0].records).toHaveLength(1)
  })

  it('고가 미획득 기간 요약을 계산한다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ periodKey: '2026-07-09', itemKey: 'loose_control_machine_mark', itemName: '루즈 컨트롤 머신 마크' }),
    ])

    const data = await loadDropHistory(new Date('2026-07-31T03:00:00.000Z'))

    expect(data.drought).toMatchObject({ periodKey: '2026-07-09', weeksSince: 3 })
  })

  it('고가 기록이 없으면 요약이 null이다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ itemKey: 'restraint_ring', itemName: '리스트레인트 링', category: 'consumable' }),
    ])

    const data = await loadDropHistory()

    expect(data.drought).toBeNull()
  })

  it('추적 캐릭터도 기록도 없으면 DB를 조회하지 않고 빈 목록으로 끝낸다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(null)

    const data = await loadDropHistory()

    expect(getAllBossDropRecordsMock).not.toHaveBeenCalled()
    expect(data.groups).toEqual([])
  })

  // 캐릭터를 관리 목록에서 빼도 그 캐릭터가 먹은 것은 히스토리에 남아야 한다. 기록은 원래부터
  // 안 지워졌고 조회 범위만 추적 목록이었다.
  it('추적에서 빠진 캐릭터도 기록이 있으면 조회 범위에 든다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
    getRecordedCharacterOcidsMock.mockResolvedValue(['ocid-1', 'ocid-해제'])

    await loadDropHistory()

    expect(getAllBossDropRecordsMock).toHaveBeenCalledWith(['ocid-1', 'ocid-해제'])
  })

  it('추적 목록이 비어도 기록이 있으면 조회한다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(null)
    getRecordedCharacterOcidsMock.mockResolvedValue(['ocid-해제'])

    await loadDropHistory()

    expect(getAllBossDropRecordsMock).toHaveBeenCalledWith(['ocid-해제'])
  })

  // 빈 배열로 바꾸면 쿼리가 성공으로 들고 화면이 기록이 없습니다 라는 거짓 빈 상태를 그린다. 던져야 `failed` 가 된다.
  it('조회가 실패하면 던진다. 빈 목록으로 위장하지 않는다', async () => {
    getAllBossDropRecordsMock.mockRejectedValue(new Error('SQLite 죽음'))

    await expect(loadDropHistory()).rejects.toThrow('SQLite 죽음')
  })
})
