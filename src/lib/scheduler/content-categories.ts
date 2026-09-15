/**
 * 컨텐츠 갈래 표. 템플릿(`scheduler-content-template.json`) 줄의 `category` 가 이 key 를 든다.
 *
 * 코드가 이 값으로 카드 모양 · 길드 판정 · 계열 한도를 가르는 고정 목록이라 JSON 이 아니라 여기 둔다. 카드
 * 라벨(`에픽 던전`)과 today 공유 위젯의 계열 머리글이 같은 글자를 쓴다.
 */
export const CONTENT_CATEGORIES = [
  { key: 'monster_park', name: '몬스터파크' },
  { key: 'daily_quest', name: '일일 퀘스트' },
  // 에픽 던전은 ID 당 1회라 개별 `최대 1회` 대신 이 태그를 단다.
  { key: 'epic_dungeon', name: '에픽 던전', tag: 'ID당 1회' },
  { key: 'maple_union', name: '메이플 유니온' },
  // 결계 · 퀘스트마다 `최대 1회` 가 붙으면 목록이 시끄러워 태그를 숨긴다(`null`).
  { key: 'arcane_river_quest', name: '아케인리버 지역 퀘스트', tag: null },
  { key: 'weekly_quest', name: '주간 퀘스트' },
  { key: 'mu_lung_dojo', name: '무릉도장' },
  { key: 'guild', name: '길드' },
] as const satisfies readonly { key: string; name: string; tag?: string | null }[]

export type ContentCategoryKey = (typeof CONTENT_CATEGORIES)[number]['key']

/** 관리 화면 주간 목록의 갈래 차례. 여기 없는 갈래는 뒤에 첫 등장 순서로 선다. */
export const WEEKLY_CATEGORY_ORDER: readonly ContentCategoryKey[] = [
  'epic_dungeon',
  'monster_park',
  'guild',
  'arcane_river_quest',
  'weekly_quest',
  'mu_lung_dojo',
  'maple_union',
]

export function contentCategoryNameOf(key: ContentCategoryKey): string {
  return CONTENT_CATEGORIES.find((category) => category.key === key)!.name
}

/**
 * 갈래의 참고 태그. `undefined` 는 갈래가 태그를 정하지 않는다는 뜻이고(기본 규칙을 쓴다), `null` 은 숨긴다.
 */
export function contentCategoryTagOf(key: ContentCategoryKey): string | null | undefined {
  const category = CONTENT_CATEGORIES.find((each) => each.key === key)
  return category !== undefined && 'tag' in category ? category.tag : undefined
}
