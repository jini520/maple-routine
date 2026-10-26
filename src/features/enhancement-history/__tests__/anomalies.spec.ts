import { enhancementAnomaliesOf } from '../anomalies'
import type { EnhancementSource } from '../spending'

const entry = (over: Partial<EnhancementSource> = {}): EnhancementSource => ({
  kind: 'cube',
  dateKey: '2026-09-05',
  characterName: '낟낟',
  targetItem: '아케인셰이드 클로',
  itemKey: 'arcane_umbra_knuckle',
  itemLevel: 200,
  payload: {},
  ...over,
})

const NO_EVENT = new Set<string>()
const starforce = (over: Partial<EnhancementSource> = {}, payload: Record<string, unknown> = {}) =>
  entry({ kind: 'starforce', itemLevel: null, payload: { before_starforce_count: 3, upgrade_item: '', ...payload }, ...over })
const potential = (payload: Record<string, unknown>) => entry({ kind: 'potential', payload })

// 원본을 버리므로, 합계에서 빠진 줄은 이 값이 운영자가 원인을 볼 유일한 단서다.
describe('합계에서 뺀 줄', () => {
  it('같은 날 · 종류 · 이유 · 장비는 한 줄로 센다', () => {
    const unknownItem = { itemKey: null, targetItem: '왕푸' }

    expect(enhancementAnomaliesOf([starforce(unknownItem), starforce(unknownItem)], NO_EVENT, null)).toEqual([
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

    expect(enhancementAnomaliesOf(rows, NO_EVENT, null).map((one) => [one.enhancementType, one.anomalyType])).toEqual([
      ['cube', 'no_level'],
      ['starforce', 'no_star'],
      ['potential', 'no_type'],
      ['potential', 'no_grade'],
      ['potential', 'no_cost'],
    ])
  })

  // 메소가 안 드는 강화라 빼는 것이 정상이다. 알리면 상황의 양이 부푼다.
  it('전용 재화 줄과 값을 매긴 줄은 세지 않는다', () => {
    expect(enhancementAnomaliesOf([entry({ payload: { cube_type: '펄스 인핸서' }, itemLevel: null }), entry()], NO_EVENT, null)).toEqual([])
  })
})

describe('이벤트 월드를 판정하지 못한 줄', () => {
  it('목록을 못 받은 회차는 월드를 모르는 줄을 날짜 · 종류마다 세고 실패 이유를 싣는다', () => {
    const rows = [entry(), entry(), starforce({}, { world_name: '엘리시움' })]

    expect(enhancementAnomaliesOf(rows, null, 'Error: 503')).toEqual([
      {
        historyDate: '2026-09-05',
        enhancementType: 'cube',
        anomalyType: 'event_world_unknown',
        itemKey: null,
        itemName: '',
        rowCount: 2,
        detail: 'Error: 503',
      },
    ])
  })
})
