/** 묶음의 한 건 결과. 실패한 건만 평소 대기 표에 넣는다. */
export type BatchItemResult = { recordId: string | null; ok: true } | { recordId: string | null; ok: false; reason: string }

/** 강화 합계에서 빼거나 이벤트 월드를 판정하지 못한 줄을 날짜 · 종류 · 이유 · 장비마다 센 값. 캐릭터 이름은 싣지 않는다. */
export interface EnhancementAnomaly {
  historyDate: string
  enhancementType: 'cube' | 'starforce' | 'potential' | 'soul_potential'
  anomalyType: 'event_world_unknown' | 'no_level' | 'no_grade' | 'no_star' | 'no_type' | 'no_cost'
  itemKey: string | null
  /** 응답의 장비 이름. 판정하지 못한 줄은 장비와 무관해 빈 글자다 */
  itemName: string
  rowCount: number
  /** 캐릭터 목록 요청의 실패 이유. 판정하지 못한 줄만 있다 */
  detail: string | null
}
