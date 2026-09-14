/**
 * 보스 드롭 기록. 기록만(수익 미반영). 레코드는 나중에 시세 소스로 재평가 가능한
 * 구조로만 남기고 금액은 담지 않는다.
 */

import type { BossDifficulty } from './scheduler'

// item-drop-table.json의 카테고리 키(영문). UI 라벨(고정/장비/소비)은 표시 계층에서 매핑.
export const DROP_CATEGORIES = ['fixed', 'equipment', 'consumable'] as const
export type DropCategory = (typeof DROP_CATEGORIES)[number]

// 선택 가능한 드롭 후보(장비·소비)의 카테고리. 고정은 읽기 전용이라 여기서 제외.
export const SELECTABLE_DROP_CATEGORIES = ['equipment', 'consumable'] as const
export type SelectableDropCategory = (typeof SELECTABLE_DROP_CATEGORIES)[number]

// 드롭 피커 후보 = 한 보스의 전 난이도 장비·소비 아이템을 아이템 key+slot으로 통합한 것.
// 난이도 무관 통합 표시라 difficulties에 이 후보가 등장하는 난이도를 정규 순서로 담는다.
export interface DropCandidate {
  /** 아이템 key(`drop-items.json`). */
  key: string
  /** 마스터 표의 지금 이름. */
  name: string
  category: SelectableDropCategory
  slot?: string
  set?: string
  note?: string
  difficulties: BossDifficulty[]
}

// 고정 드롭은 난이도마다 값이 달라 통합하지 않고 난이도별 그룹으로 읽기 전용 표시.
export interface FixedDropItem {
  key: string
  name: string
  amount?: string
  slot?: string
}
export interface FixedDropGroup {
  difficulty: BossDifficulty
  items: FixedDropItem[]
}

// 랜덤 상자 개봉 결과. 반지 상자: itemName + ringLevel, 칠흑 장신구 상자: itemName만
export interface BoxResult {
  boxName: string
  itemName: string
  ringLevel?: number
}

// 한 보스에서 기록된 드롭 하나. 상자 개봉 결과면 itemName은 실제 나온 아이템(반지/장신구)이고
// boxOrigin에 상자명이 남는다. 가격은 기록 한 건에 붙는 실제 판매가다(#185).의
// "금액을 저장하지 않는다"를 뒤집은 자리이고, 그래서 세 필드가 전부 optional이다(옛 기록엔 없다).
export interface RecordedDrop {
  category: DropCategory
  /** 아이템 key. 이름만 저장된 옛 기록에서 이관이 못 찾았으면 `null` 이다. */
  itemKey: string | null
  /** 적을 때의 이름. 보이는 이름은 key 로 찾고, key 가 없을 때만 이 값을 쓴다. */
  itemName: string
  slot?: string
  /** 상자 결과면 상자의 아이템 key. 상자 결과인데 `null` 이면 이관이 상자 이름을 못 찾았다. */
  boxOriginKey?: string | null
  boxOrigin?: string
  ringLevel?: number
  quantity: number
  /**
   * 가격 상태. `undefined` = 미입력.
   *
   * `'excluded'`(기록 안함)는 이 아이템은 값을 매길 만하지 않다 는 사용자의 결정이다. 화면의
   * 스킵과 다르다. 스킵은 아직 안 팔렸다, 팔리면 그때 넣겠다 라 상태를 바꾸지 않고 미입력에
   * 머문다. 그래서 스킵은 저장되는 값이 없다.
   */
  priceState?: 'entered' | 'excluded'
  /** 입력한 판매 **총액**(메소). 수량이 2 이상이어도 묶음가 하나다. */
  priceMeso?: number
  /** 분배 인원 스냅샷. 입력 시 그 행의 파티원 수로 씨를 뿌리고 저장 후 독립한다. */
  priceShare?: number
}
