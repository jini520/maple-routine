import { judgeEventWorld, type EventWorldJudgment } from '../../../lib/enhancement/world'
import { enhancementAnomaliesOf } from '../anomalies'
import type { EnhancementSource } from '../spending'

const entry = (over: Partial<EnhancementSource> = {}): EnhancementSource => ({
  kind: 'cube',
  dateKey: '2026-09-05',
  createdAt: '2026-09-05T10:00:00.000+09:00',
  characterName: '낟낟',
  targetItem: '아케인셰이드 클로',
  itemKey: 'arcane_umbra_knuckle',
  itemLevel: 200,
  payload: {},
  ...over,
})

/** 일반 월드 캐릭터에 붙인 줄의 판정. */
const NO_EVENT = (): EventWorldJudgment => ({ eventWorld: false, unknownWorld: null })
const starforce = (over: Partial<EnhancementSource> = {}, payload: Record<string, unknown> = {}) =>
  entry({ kind: 'starforce', itemLevel: null, payload: { before_starforce_count: 3, upgrade_item: '', ...payload }, ...over })
const potential = (payload: Record<string, unknown>) => entry({ kind: 'potential', payload })

// 원본을 버리므로, 합계에서 빠진 줄은 이 값이 운영자가 원인을 볼 유일한 단서다.
describe('합계에서 뺀 줄', () => {
  it('같은 날 · 종류 · 이유 · 장비는 한 줄로 센다', () => {
    const unknownItem = { itemKey: null, targetItem: '왕푸' }
    const rows = [starforce(unknownItem, { after_starforce_count: 15 }), starforce(unknownItem, { after_starforce_count: 15 })]

    expect(enhancementAnomaliesOf(rows, NO_EVENT)).toEqual([
      {
        historyDate: '2026-09-05',
        enhancementType: 'starforce',
        anomalyType: 'no_level',
        itemKey: null,
        itemName: '왕푸',
        rowCount: 2,
        detail: null,
      },
    ])
  })

  it('이유를 가른다', () => {
    const rows = [
      entry({ itemLevel: null }),
      starforce({}, { before_starforce_count: undefined }),
      potential({ potential_type: '모르는 재설정' }),
      potential({ potential_type: '잠재능력 재설정' }),
      // 노멀은 등급은 알지만 재설정 비용 표에 없다.
      potential({ potential_type: '잠재능력 재설정', before_potential_option: [{ value: 'x', grade: '노멀' }] }),
    ]

    expect(enhancementAnomaliesOf(rows, NO_EVENT).map((one) => [one.enhancementType, one.anomalyType])).toEqual([
      ['cube', 'no_level'],
      ['starforce', 'no_star'],
      ['potential', 'no_type'],
      ['potential', 'no_grade'],
      ['potential', 'no_cost'],
    ])
  })

  // 운영자는 10성 이상으로 올린 장비만 본다. 시도 뒤 성수를 모르는 줄은 기준을 넘었는지 몰라 뺀다.
  it('장비 표에 없는 장비의 스타포스는 시도 뒤 10성 이상인 줄만 센다', () => {
    const unknownItem = { itemKey: null, targetItem: '슈피겔만의 평범한 목걸이' }
    const rows = [
      starforce(unknownItem, { after_starforce_count: 9 }),
      starforce(unknownItem, { after_starforce_count: 10 }),
      starforce(unknownItem, { after_starforce_count: 22 }),
      starforce(unknownItem),
    ]

    expect(enhancementAnomaliesOf(rows, NO_EVENT).map((one) => [one.anomalyType, one.rowCount])).toEqual([['no_level', 2]])
  })

  // 메소가 안 드는 강화라 빼는 것이 정상이다. 알리면 상황의 양이 부푼다.
  it('전용 재화 줄과 값을 매긴 줄은 세지 않는다', () => {
    expect(enhancementAnomaliesOf([entry({ payload: { cube_type: '펄스 인핸서' }, itemLevel: null }), entry()], NO_EVENT)).toEqual([])
  })
})

describe('이벤트 월드를 판정하지 못한 줄', () => {
  // 새 이벤트 월드가 열린 것을 운영자가 이 보고로 안다. 월드 이름이 있어야 표에 넣을 수 있다.
  it('표에 없는 월드의 줄은 월드마다 세고 그 월드 이름을 싣는다', () => {
    const rows = [
      starforce({}, { world_name: '스페셜3' }),
      starforce({}, { world_name: '스페셜3' }),
      entry({ characterName: '새캐릭' }),
    ]
    const judgmentOf = (row: EnhancementSource) =>
      judgeEventWorld(
        String((row.payload as { world_name?: string }).world_name ?? ''),
        { worldName: row.characterName === '새캐릭' ? '스페셜3' : null, worldKey: null, preLeap: false },
      )

    expect(enhancementAnomaliesOf(rows, judgmentOf).map((one) => [one.enhancementType, one.rowCount, one.detail])).toEqual([
      ['starforce', 2, '스페셜3'],
      ['cube', 1, '스페셜3'],
    ])
  })

  // 붙이지 못한 줄은 합계에 들지 않는다. 판정할 것이 없다.
  it('캐릭터에 붙이지 못한 줄은 판정을 세지 않는다', () => {
    expect(enhancementAnomaliesOf([entry(), entry()], () => null)).toEqual([])
  })
})
