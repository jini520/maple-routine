/**
 * 강화 지출을 가르는 갈래 표. **`kind` 보다 하나 잘다.**
 *
 * `kind` 는 API 엔드포인트라 잠재 둘이 한 통에 온다. 그런데 본 잠재와 에디셔널은 비용 표가 아예 다르고
 * (에디셔널이 두 배 넘는다) 사용자가 따로 센다.
 *
 * **큐브는 안 가른다.** 한 번 본잠·에디로 갈라 봤고 되돌렸다(사용자 지정 2026-09-08). 갈라도 값이 안
 * 바뀌는데(감정비용은 장비 레벨 하나로 나온다) 줄만 둘로 늘었다.
 *
 * 저장되는 곳이 없다. 읽을 때 `kind` 와 `potential_type` 으로 정한다.
 */
export const ENHANCEMENT_CATEGORIES = [
  { key: 'cube_reset', name: '큐브 재설정' },
  { key: 'starforce', name: '스타포스' },
  { key: 'potential', name: '잠재능력' },
  { key: 'additional_potential', name: '에디셔널 잠재능력' },
] as const

export type EnhancementCategory = (typeof ENHANCEMENT_CATEGORIES)[number]['key']

const nameByKey = new Map<string, string>(ENHANCEMENT_CATEGORIES.map((category) => [category.key, category.name]))

/** 줄 제목에 적는 글자. */
export function enhancementCategoryNameOf(key: EnhancementCategory): string {
  return nameByKey.get(key)!
}
