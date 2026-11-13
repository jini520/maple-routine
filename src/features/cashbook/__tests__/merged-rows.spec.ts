// 하루 목록에서 헥사 매트릭스 · 아이템 구매를 캐릭터마다 한 줄로 합친다.
//
// 기록 원장은 그대로 기록마다 하나다. today · 통계가 같은 원장을 읽으므로, 합치는 일은 하루 목록이 받은 줄에서만 한다.
import { imageOfPath } from '../../../assets/__tests__/asset-uri'
import type { SpendRecord } from '../../../storage/spend'
import { mergeDayRows, mergedRowIconOf, type DayRow, type MergedDayRow } from '../merged-rows'
import type { DayRecord } from '../records'

const spend = (over: Partial<SpendRecord> & Pick<SpendRecord, 'id' | 'recordedAt'>): DayRecord => ({
  kind: 'spend',
  characterName: over.ocid === null ? '' : '루디',
  record: {
    ocid: 'ocid-1',
    spentOn: '2026-11-13',
    category: 'item_purchase',
    item: null,
    itemKey: null,
    formItemKeys: null,
    itemKind: null,
    levelFrom: null,
    levelTo: null,
    quantity: null,
    mesoAmount: 0,
    tariffMeso: null,
    pointAmount: null,
    pointPer100mMeso: null,
    mesoMarketFeePercent: null,
    cashAmount: null,
    hexa: null,
    ...over,
  },
})

const 헥사 = { fragmentCount: 100, untradableFragmentCount: 0, fragmentPrice: 1, useStorage: false, storageAsSpend: false, storageUses: [] }
const 헥사스킬 = (id: string, recordedAt: string, mesoAmount = 0): DayRecord =>
  spend({ id, recordedAt, mesoAmount, category: 'hexa_matrix', itemKey: '창룡파천검 : 만참', levelFrom: 25, levelTo: 28, hexa: { ...헥사, activation: null } })
const 헥사스탯 = (id: string, recordedAt: string): DayRecord =>
  spend({ id, recordedAt, category: 'hexa_matrix', itemKey: 'hexa_stat_1', hexa: { ...헥사, activation: false } })

const 결정석 = { kind: 'bossCrystal', ocid: 'ocid-1', characterName: '루디', payoutMeso: 1, count: 1, bosses: [] } as unknown as DayRecord

/** 줄의 모양을 글자로. 합친 줄은 갈래와 묶인 기록의 차례다. */
function shapeOf(rows: readonly DayRow[]): string[] {
  return rows.map((row) => {
    if (row.kind === 'merged') return `${row.category}[${row.records.map((entry) => entry.record.id).join(',')}]`
    return row.kind === 'spend' || row.kind === 'income' ? row.record.id : row.kind
  })
}

function mergedOf(records: readonly DayRecord[]): MergedDayRow {
  const merged = mergeDayRows(records).find((row): row is MergedDayRow => row.kind === 'merged')
  if (merged === undefined) throw new Error('합친 줄이 없다')
  return merged
}

describe('mergeDayRows', () => {
  // 헥사 스킬과 헥사 스탯은 같은 `hexa_matrix` 갈래라 한 줄에 든다. 자동 줄과 다른 갈래는 제자리다.
  it('같은 날 같은 캐릭터의 헥사 · 구매 기록이 둘 이상이면 갈래마다 한 줄로 합친다', () => {
    const rows = mergeDayRows([
      결정석,
      헥사스킬('hexa-1', '2026-11-13T09:00:00Z'),
      spend({ id: 'etc-1', recordedAt: '2026-11-13T09:30:00Z', category: 'etc' }),
      spend({ id: 'buy-1', recordedAt: '2026-11-13T10:00:00Z' }),
      헥사스탯('hexa-2', '2026-11-13T11:00:00Z'),
      spend({ id: 'buy-2', recordedAt: '2026-11-13T12:00:00Z' }),
    ])

    expect(shapeOf(rows)).toEqual(['bossCrystal', 'hexa_matrix[hexa-1,hexa-2]', 'etc-1', 'item_purchase[buy-1,buy-2]'])
  })

  // 한 건이면 지금 줄 그대로다(누르면 바로 시트). 캐릭터 없는 옛 기록은 누구 것인지 몰라 묶지 않는다.
  it('한 건 · 캐릭터 없는 기록 · 다른 캐릭터 · 다른 갈래는 합치지 않는다', () => {
    const records = [
      헥사스킬('hexa-1', '2026-11-13T09:00:00Z'),
      spend({ id: 'buy-none-1', recordedAt: '2026-11-13T09:10:00Z', ocid: null }),
      spend({ id: 'buy-none-2', recordedAt: '2026-11-13T09:20:00Z', ocid: null }),
      spend({ id: 'buy-1', recordedAt: '2026-11-13T09:30:00Z' }),
      spend({ id: 'buy-other', recordedAt: '2026-11-13T09:40:00Z', ocid: 'ocid-2' }),
      spend({ id: 'symbol-1', recordedAt: '2026-11-13T09:50:00Z', category: 'symbol' }),
      spend({ id: 'symbol-2', recordedAt: '2026-11-13T10:00:00Z', category: 'symbol' }),
    ]

    expect(shapeOf(mergeDayRows(records))).toEqual(records.map((entry) => (entry as { record: { id: string } }).record.id))
  })

  // 받은 차례가 아니라 적은 시각으로 정한다. 그래야 펼친 칸의 차례와 대표 그림의 같은 금액 순서가 받은 배열에 기대지 않는다.
  it('묶인 기록은 적은 순이고, 합친 줄은 가장 먼저 적은 기록의 자리에 선다', () => {
    const rows = mergeDayRows([
      spend({ id: 'buy-late', recordedAt: '2026-11-13T12:00:00Z' }),
      spend({ id: 'etc-1', recordedAt: '2026-11-13T10:00:00Z', category: 'etc' }),
      spend({ id: 'buy-early', recordedAt: '2026-11-13T09:00:00Z' }),
    ])

    expect(shapeOf(rows)).toEqual(['etc-1', 'item_purchase[buy-early,buy-late]'])
  })
})

describe('mergedRowIconOf', () => {
  // 직접 친 이름은 그림이 없어 건너뛴다. 갈래 카드의 구매 그림(`고통의 근원`)은 그 아이템을 산 것으로 읽혀 쓰지 않는다.
  it('아이템 구매는 금액이 큰 기록부터 보아 그림이 있는 첫 아이템의 그림이다', () => {
    const merged = mergedOf([
      spend({ id: 'typed', recordedAt: '2026-11-13T09:00:00Z', item: '직접 친 장비', mesoAmount: 5_000_000_000 }),
      spend({ id: 'trace', recordedAt: '2026-11-13T10:00:00Z', itemKey: 'spell_trace', itemKind: 'etc', quantity: 3_000, mesoAmount: 105_000_000 }),
      spend({ id: 'belt', recordedAt: '2026-11-13T11:00:00Z', itemKey: 'dreamy_belt', itemKind: 'equipment', mesoAmount: 3_200_000_000 }),
    ])

    expect(mergedRowIconOf(merged)).toBe(imageOfPath('items/dark_boss_belt.png'))
    expect(imageOfPath('items/dark_boss_belt.png')).not.toBeNull()
  })

  it('금액이 같으면 먼저 적은 기록의 그림이다', () => {
    const merged = mergedOf([
      spend({ id: 'belt', recordedAt: '2026-11-13T11:00:00Z', itemKey: 'dreamy_belt', itemKind: 'equipment', mesoAmount: 1_000_000_000 }),
      spend({ id: 'trace', recordedAt: '2026-11-13T10:00:00Z', itemKey: 'spell_trace', itemKind: 'etc', quantity: 1, mesoAmount: 1_000_000_000 }),
    ])

    expect(mergedRowIconOf(merged)).toBe(imageOfPath('items/spell_trace.webp'))
    expect(imageOfPath('items/spell_trace.webp')).not.toBeNull()
  })

  it('그림이 있는 기록이 없으면 비어 있고, 화면은 지금 아이콘을 그린다', () => {
    const merged = mergedOf([
      spend({ id: 'typed-1', recordedAt: '2026-11-13T09:00:00Z', item: '직접 친 장비', mesoAmount: 2 }),
      spend({ id: 'typed-2', recordedAt: '2026-11-13T10:00:00Z', item: '직접 친 소비', mesoAmount: 1 }),
    ])

    expect(mergedRowIconOf(merged)).toBeNull()
  })

  // 가장 비싼 기록이 코어 그림을 가져도 그것을 쓰지 않는다. 금액으로 고르는 것은 아이템 구매만이다.
  it('헥사 매트릭스는 갈래 카드의 헥사 매트릭스 그림이다', () => {
    const merged = mergedOf([헥사스킬('hexa-1', '2026-11-13T09:00:00Z', 4_830_000_000), 헥사스탯('hexa-2', '2026-11-13T10:00:00Z')])

    expect(mergedRowIconOf(merged)).toBe(imageOfPath('items/hexa_matrix.webp'))
    expect(imageOfPath('items/hexa_matrix.webp')).not.toBeNull()
  })
})
