/**
 * 사냥터 참조표의 모양.
 *
 * 값은 `src/data/hunting-grounds.json` 이고 **전부 사용자가 준 것**이다 — 이 파일은
 * 그 형태에 이름만 붙인다. 형태가 실제 파일과 맞는지는 `data/__tests__/hunting-grounds.spec.ts`.
 */

/** 지역이 요구하는 힘의 종류 — 아이콘도 이것으로 갈린다(`lib/force-icons.ts`). */
export type ForceType = 'arcane' | 'authentic'

export interface HuntingGround {
  /** **전역 유일**이다(408개 중 중복 0) — 그래서 기록은 이름만 적고 지역을 되짚는다. */
  readonly name: string
  /** 아케인/어센틱 포스 요구치. 어느 쪽인지는 지역의 `forceType` 이 안다. */
  readonly force: number
  /** 맵에 한 번에 뜨는 몬스터 마릿수. */
  readonly mobs: number
  /**
   * 몬스터 레벨. **배열인 이유**는 원 자료가 lv.200-201(붙은 둘)과 lv.217,219(떨어진 둘)를
   * 둘 다 쓰기 때문이다 — 한 값으로 접으면 그 구분이 사라진다. 셋 이상인 맵은 없다.
   */
  readonly levels: readonly number[]
}

export interface HuntingRegion {
  /** `assets/maps/icons/` 의 기존 지역 슬러그와 **같은 글자**다. */
  readonly slug: string
  readonly name: string
  /** 아케인 리버·그란디스 — 사용자가 나눈 묶음이다. */
  readonly group: string
  readonly forceType: ForceType
  /** 지역이 덮는 레벨 범위. **캐릭터 레벨 ±20 과 겹치는지**를 이 둘로 잰다(결정 6). */
  readonly minLevel: number
  readonly maxLevel: number
  readonly grounds: readonly HuntingGround[]
}

export interface HuntingGroundTable {
  readonly regions: readonly HuntingRegion[]
}
