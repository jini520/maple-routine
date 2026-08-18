import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BossDropRecord } from '@core/storage/boss-drops'

const {
  getAllBossDropRecordsMock,
  getAllBossProfitRecordKeysMock,
  getTrackedCharacterOcidsMock,
  getCachedCharacterBasicMock,
  getBossDropRecordsRevisionMock,
} = vi.hoisted(() => ({
  getAllBossDropRecordsMock: vi.fn(),
  getAllBossProfitRecordKeysMock: vi.fn(),
  getTrackedCharacterOcidsMock: vi.fn(),
  getCachedCharacterBasicMock: vi.fn(),
  getBossDropRecordsRevisionMock: vi.fn(() => 0),
}))

vi.mock('@core/storage/boss-drops', () => ({
  getAllBossDropRecords: getAllBossDropRecordsMock,
  getBossDropRecordsRevision: getBossDropRecordsRevisionMock,
}))
vi.mock('@core/storage/boss-profit', () => ({
  getAllBossProfitRecordKeys: getAllBossProfitRecordKeysMock,
}))
vi.mock('@core/storage/character-selection', () => ({
  getTrackedCharacterOcids: getTrackedCharacterOcidsMock,
}))
vi.mock('@core/storage/character-basic-cache', () => ({
  getCachedCharacterBasic: getCachedCharacterBasicMock,
}))

function dropRecord(overrides: Partial<BossDropRecord>): BossDropRecord {
  return {
    ocid: 'ocid-1',
    boss: '스우',
    difficulty: '하드',
    periodKey: '2026-07-09',
    dropIndex: 0,
    category: 'equipment',
    itemName: '루즈 컨트롤 머신 마크',
    slot: '얼굴장식',
    boxOrigin: null,
    ringLevel: null,
    priceState: null,
    priceMeso: null,
    priceShare: null,
    quantity: 1,
    // 히스토리는 이 값을 쓰지 않는다([[ADR-071]] 결정 2) — 그룹 재기록으로 덮이는 감사 필드다.
    recordedAt: '2026-07-31T00:00:00.000Z',
    ...overrides,
  }
}

async function loadStore() {
  const module = await import('../drop-history-store')
  module.useDropHistoryStore.setState({
    status: 'idle',
    groups: [],
    drought: null,
    charactersByOcid: {},
    loadedRevision: -1,
  })
  return module.useDropHistoryStore
}

beforeEach(() => {
  vi.resetModules()
  getAllBossDropRecordsMock.mockReset().mockResolvedValue([])
  getAllBossProfitRecordKeysMock.mockReset().mockResolvedValue([])
  getTrackedCharacterOcidsMock.mockReset().mockResolvedValue(['ocid-1'])
  getBossDropRecordsRevisionMock.mockReset().mockReturnValue(0)
  getCachedCharacterBasicMock
    .mockReset()
    .mockResolvedValue({ profile: { name: '메이플영웅', level: 290, imageUrl: 'https://img/1.png' } })
})

describe('useDropHistoryStore.load', () => {
  it('전 기간 드롭 기록을 기간별로 묶어 최신 순으로 담는다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ periodKey: '2026-07-16' }),
      dropRecord({ periodKey: '2026-07-09' }),
    ])
    const store = await loadStore()

    await store.getState().load()

    expect(getAllBossDropRecordsMock).toHaveBeenCalledWith(['ocid-1'])
    expect(store.getState().status).toBe('ready')
    expect(store.getState().groups.map((group) => group.periodKey)).toEqual([
      '2026-07-16',
      '2026-07-09',
    ])
  })

  // today 의 「최고가 아이템」(entered 만 순위)·「가격 미입력」(undefined 만 카운트)이 이 세 필드를
  // 읽는다. 빠지면 저장은 됐는데 최고가는 영영 비고 미입력 건수는 안 준다([[ADR-124]] 결정 4).
  it('가격 세 필드를 함께 담는다 — 빠지면 「입력해도 미입력」이 된다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ priceState: 'entered', priceMeso: 1_200_000_000, priceShare: 2 }),
    ])
    const store = await loadStore()

    await store.getState().load()

    expect(store.getState().groups[0].records[0]).toMatchObject({
      priceState: 'entered',
      priceMeso: 1_200_000_000,
      priceShare: 2,
    })
  })

  it('저장 계층의 null 은 undefined 로 정규화한다 — 「미입력」과 「0메소」가 갈린다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ priceState: null, priceMeso: null, priceShare: null }),
    ])
    const store = await loadStore()

    await store.getState().load()

    const record = store.getState().groups[0].records[0]
    expect(record.priceState).toBeUndefined()
    expect(record.priceMeso).toBeUndefined()
    expect(record.priceShare).toBeUndefined()
  })

  it('캐릭터 이름·아바타를 ocid로 찾을 수 있게 함께 담는다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([dropRecord({})])
    const store = await loadStore()

    await store.getState().load()

    expect(store.getState().charactersByOcid['ocid-1']).toEqual({
      ocid: 'ocid-1',
      characterName: '메이플영웅',
      imageUrl: 'https://img/1.png',
    })
  })

  it('확정 난이도 조합의 획득 불가 기록을 거른다 (ADR-071 결정 6)', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ itemName: '루즈 컨트롤 머신 마크', dropIndex: 0 }), // 하드+익스 → 유지
      dropRecord({ itemName: '컴플리트 언더컨트롤', slot: null, dropIndex: 1 }), // 익스 전용 → 제거
    ])
    getAllBossProfitRecordKeysMock.mockResolvedValue([
      { ocid: 'ocid-1', boss: '스우', difficulty: '하드', periodKey: '2026-07-09' },
    ])
    const store = await loadStore()

    await store.getState().load()

    expect(store.getState().groups[0].records.map((record) => record.itemName)).toEqual([
      '루즈 컨트롤 머신 마크',
    ])
  })

  it('수익 기록이 없는(=난이도 미확정) 조합은 거르지 않는다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ itemName: '컴플리트 언더컨트롤', slot: null }),
    ])
    getAllBossProfitRecordKeysMock.mockResolvedValue([])
    const store = await loadStore()

    await store.getState().load()

    expect(store.getState().groups[0].records).toHaveLength(1)
  })

  it('고가 미획득 기간 요약을 계산한다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ periodKey: '2026-07-09', itemName: '루즈 컨트롤 머신 마크' }),
    ])
    const store = await loadStore()

    await store.getState().load(new Date('2026-07-31T03:00:00.000Z'))

    expect(store.getState().drought).toMatchObject({ periodKey: '2026-07-09', weeksSince: 3 })
  })

  it('고가 기록이 없으면 요약이 null이다', async () => {
    getAllBossDropRecordsMock.mockResolvedValue([
      dropRecord({ itemName: '리스트레인트 링', category: 'consumable', slot: null }),
    ])
    const store = await loadStore()

    await store.getState().load()

    expect(store.getState().drought).toBeNull()
  })

  it('추적 캐릭터가 없으면 DB를 조회하지 않고 빈 목록으로 끝낸다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(null)
    const store = await loadStore()

    await store.getState().load()

    expect(getAllBossDropRecordsMock).not.toHaveBeenCalled()
    expect(store.getState().status).toBe('ready')
    expect(store.getState().groups).toEqual([])
  })

  // 이 화면이 push 페이지일 때는 열 때마다 새로 마운트돼 늘 최신을 읽었다. `today` 가 **탭**으로
  // 같은 스토어를 상시 구독하면서 «내 스냅샷이 낡았나» 를 물을 수 있어야 했다.
  it('스냅샷을 «읽기 전» 리비전으로 찍는다 — 읽는 중에 들어온 변경을 본 것으로 표시하지 않는다', async () => {
    getBossDropRecordsRevisionMock.mockReturnValue(7)
    getAllBossDropRecordsMock.mockImplementation(async () => {
      // 조회가 도는 사이 다른 화면이 기록을 바꿨다.
      getBossDropRecordsRevisionMock.mockReturnValue(8)
      return [dropRecord({})]
    })
    const store = await loadStore()

    await store.getState().load()

    // 8 로 찍으면 그 변경을 이미 반영한 것이 되어 영영 다시 읽지 않는다.
    expect(store.getState().loadedRevision).toBe(7)
  })

  it('추적 캐릭터가 없는 조기 종료에도 리비전을 찍는다 — 그 상태도 «지금의 사실» 이다', async () => {
    getBossDropRecordsRevisionMock.mockReturnValue(3)
    getTrackedCharacterOcidsMock.mockResolvedValue([])
    const store = await loadStore()

    await store.getState().load()

    expect(store.getState().loadedRevision).toBe(3)
  })

  it('실패에는 리비전을 찍지 않는다 — 스냅샷이 없으므로 다음 진입이 다시 시도해야 한다', async () => {
    getBossDropRecordsRevisionMock.mockReturnValue(5)
    getAllBossDropRecordsMock.mockRejectedValue(new Error('SQLite 죽음'))
    const store = await loadStore()

    await store.getState().load()

    expect(store.getState().loadedRevision).toBe(-1)
  })

  it('조회가 실패하면 failed다 — 빈 목록("기록이 없습니다")으로 위장하지 않는다', async () => {
    getAllBossDropRecordsMock.mockRejectedValue(new Error('SQLite 죽음'))
    const store = await loadStore()

    await store.getState().load()

    expect(store.getState().status).toBe('failed')
    expect(store.getState().groups).toEqual([])
  })
})
