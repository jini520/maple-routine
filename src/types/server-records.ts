/**
 * 강화 합계에서 빼거나 이벤트 월드를 판정하지 못한 줄을 날짜 · 종류 · 이유 · 장비마다 센 값. 그대로 요청 몸의 한 줄이라 칸 이름이
 * 서버 표 `enhancement_anomalies` 를 따른다. 캐릭터 이름과 아이템 key 는 싣지 않는다.
 */
export interface EnhancementAnomaly {
  historyDate: string
  /** 강화 내역을 받은 넥슨 API */
  apiType: 'cube' | 'starforce' | 'potential' | 'soul_potential'
  /** 합계에서 빠진 이유 */
  reason: 'event_world_unknown' | 'no_level' | 'no_grade' | 'no_star' | 'no_type' | 'no_cost'
  /** 응답의 장비 이름. 판정하지 못한 줄은 장비와 무관해 빈 글자다 */
  itemName: string
  rowCount: number
  /** 캐릭터 목록 요청의 실패 이유. 판정하지 못한 줄만 있다 */
  detail: string | null
}
