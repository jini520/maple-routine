/**
 * 사냥터 참조표를 조회 모듈이 묶은 모양. 서버 응답(`types/game-data` 의 `HuntingGroundsTable`)은 지역 · 사냥터 ·
 * 레벨이 납작한 줄 표이고, `lib/cashbook/hunting-grounds` 가 지역 안에 사냥터를, 사냥터 안에 레벨을 품게 묶는다.
 * 값은 전부 사용자가 준 것이다.
 */

/** 지역이 요구하는 힘의 종류. 아이콘도 이것으로 갈린다(`lib/force-icons.ts`). */
export type ForceType = 'arcane' | 'authentic'

export interface HuntingGround {
  /** 기록이 사냥터를 가리키는 열쇠. `지역 key_번역` 이고 이름이 바뀌어도 그대로다. */
  readonly key: string
  /** 화면에 적는 이름. 전역 유일이다. */
  readonly name: string
  /** 아케인/어센틱 포스 요구치. 어느 쪽인지는 지역의 `forceType` 이 안다. */
  readonly force: number
  /** 맵에 한 번에 뜨는 몬스터 마릿수. */
  readonly mobs: number
  /**
   * 몬스터 레벨. 오름차순이다. **목록인 이유**는 원 자료가 lv.200-201(붙은 둘)과 lv.217,219(떨어진 둘)를
   * 둘 다 쓰기 때문이다. 한 값으로 접으면 그 구분이 사라진다. 셋 이상인 맵은 없다.
   */
  readonly levels: readonly number[]
}

export interface HuntingRegion {
  readonly key: string
  readonly name: string
  readonly forceType: ForceType
  /** 드롭다운에 서는 지역 아이콘 slug. 없으면 이름만 선다. */
  readonly iconMap: string | null
  readonly grounds: readonly HuntingGround[]
}
