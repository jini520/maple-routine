// 보스 드롭 기록(ADR-038). 기록만(수익 미반영) — 레코드는 나중에 시세 소스로 재평가 가능한
// 구조로만 남기고 금액은 담지 않는다.

// item-drop-table.json의 카테고리 키(영문). UI 라벨(고정/장비/소비)은 표시 계층에서 매핑.
export const DROP_CATEGORIES = ['fixed', 'equipment', 'consumable'] as const
export type DropCategory = (typeof DROP_CATEGORIES)[number]

// 드롭 피커 후보 = item-drop-table.json의 한 아이템
export interface DropCandidate {
  name: string
  category: DropCategory
  amount?: string
  slot?: string
  set?: string
  note?: string
}

// 랜덤 상자 개봉 결과 — 반지 상자: itemName + ringLevel, 칠흑 장신구 상자: itemName만
export interface BoxResult {
  boxName: string
  itemName: string
  ringLevel?: number
}

// 한 보스에서 기록된 드롭 하나. 상자 개봉 결과면 itemName은 실제 나온 아이템(반지/장신구)이고
// boxOrigin에 상자명이 남는다. 금액은 저장하지 않는다(시세는 별도 소스에서 조인 — ADR-038).
export interface RecordedDrop {
  category: DropCategory
  itemName: string
  slot?: string
  boxOrigin?: string
  ringLevel?: number
  quantity: number
}
