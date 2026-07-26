// 보스 드롭 기록(ADR-038). 기록만(수익 미반영) — 레코드는 나중에 시세 소스로 재평가 가능한
// 구조로만 남기고 금액은 담지 않는다.

import type { BossDifficulty } from './scheduler'

// item-drop-table.json의 카테고리 키(영문). UI 라벨(고정/장비/소비)은 표시 계층에서 매핑.
export const DROP_CATEGORIES = ['fixed', 'equipment', 'consumable'] as const
export type DropCategory = (typeof DROP_CATEGORIES)[number]

// 선택 가능한 드롭 후보(장비·소비)의 카테고리. 고정은 읽기 전용이라 여기서 제외(ADR-040).
export const SELECTABLE_DROP_CATEGORIES = ['equipment', 'consumable'] as const
export type SelectableDropCategory = (typeof SELECTABLE_DROP_CATEGORIES)[number]

// 드롭 피커 후보 = 한 보스의 전 난이도 장비·소비 아이템을 name+slot으로 통합한 것(ADR-040).
// 난이도 무관 통합 표시라 difficulties에 이 후보가 등장하는 난이도를 정규 순서로 담는다.
export interface DropCandidate {
  name: string
  category: SelectableDropCategory
  slot?: string
  set?: string
  note?: string
  difficulties: BossDifficulty[]
}

// 고정 드롭은 난이도마다 값이 달라 통합하지 않고 난이도별 그룹으로 읽기 전용 표시(ADR-040).
export interface FixedDropItem {
  name: string
  amount?: string
  slot?: string
}
export interface FixedDropGroup {
  difficulty: BossDifficulty
  items: FixedDropItem[]
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
