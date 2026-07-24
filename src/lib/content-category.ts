import type { SchedulerContentTemplateEntry } from './manual-content-merge'

export interface ContentCategoryItem {
  entry: SchedulerContentTemplateEntry
  /** 접두사를 뗀 표시용 이름 (토글·저장은 entry.content_name으로 한다) */
  displayName: string
}

export interface ContentCategoryGroup {
  /** 카테고리 헤더 라벨. null이면 헤더 없이 단독 행으로 렌더한다. */
  label: string | null
  items: ContentCategoryItem[]
}

// content_name에 이미 들어있는 접두사에서 카테고리를 도출한다.
//  - "[X] Y"        → 카테고리 X, 표시명 Y
//  - "에픽 던전 : Y" → 카테고리 "에픽 던전", 표시명 Y
//  - 그 외          → 카테고리 없음(label null, 단독 행), 표시명 = 원본
const BRACKET_PREFIX = /^\[([^\]]+)\]\s*(.*)$/
const EPIC_DUNGEON_PREFIX = /^(에픽 던전)\s*:\s*(.*)$/

// 접두사로 도출되지 않거나(단독 항목), 접두사와 다른 그룹으로 묶어야 하는 항목의 명시적 카테고리.
// content_name → 카테고리. 게임 도메인 분류라 AI가 추정하지 않고 사용자(도메인 전문가)가 지정한 값만
// 반영한다(ADR-006 확인 완료, 2026-07-24). 표시명은 접두사 제거 결과를 그대로 쓰고 카테고리만 덮어쓴다.
const CATEGORY_OVERRIDE: Record<string, string> = {
  // 일간: 단독이지만 그룹화하고 주간 몬스터파크와 아이콘을 통일한다
  몬스터파크: '몬스터파크',
  // 주간: 아케인리버 지역 결계·퀘스트를 한 그룹으로 (성실한 조사는 [주간 퀘스트]에서 이 그룹으로 이동)
  '에르다 스펙트럼': '아케인리버 지역 퀘스트',
  '배고픈 무토': '아케인리버 지역 퀘스트',
  '미드나잇 체이서': '아케인리버 지역 퀘스트',
  '스피릿 세이비어': '아케인리버 지역 퀘스트',
  '엔하임 디펜스': '아케인리버 지역 퀘스트',
  '프로텍트 에스페라': '아케인리버 지역 퀘스트',
  '[주간 퀘스트] 성실한 조사에 대한 보답': '아케인리버 지역 퀘스트',
  // 주간: 단독이지만 그룹화
  무릉도장: '무릉도장',
}

// 카운트 참고 태그의 도메인 오버라이드 — 리셋/제한 규칙(월드당·ID당 등)이라 사용자 지정값만 반영한다
// (ADR-006 확인 완료, 2026-07-24). null = 태그 숨김. 아이템(content_name) → 카테고리 → 기본 규칙 순.
const TAG_BY_CONTENT: Record<string, string | null> = {
  몬스터파크: '월드 당 최대 14회', // 일간
  '[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?': 'ID당 2회', // 주간
}
const TAG_BY_CATEGORY: Record<string, string | null> = {
  '에픽 던전': 'ID당 1회',
  '아케인리버 지역 퀘스트': null, // 개별 "최대 1회" 태그 숨김
}

// 컨텐츠 관리 페이지 행 우측의 참고 태그 문구(없으면 null). 오버라이드가 없을 때만 기본 규칙
// (카운트형이고 상한이 있으면 "최대 N회")을 쓴다.
export function contentCountTag(
  entry: SchedulerContentTemplateEntry,
  category: string | null,
): string | null {
  const itemTag = TAG_BY_CONTENT[entry.content_name]
  if (itemTag !== undefined) return itemTag
  const categoryTag = category !== null ? TAG_BY_CATEGORY[category] : undefined
  if (categoryTag !== undefined) return categoryTag
  return entry.type === 'contents' && entry.max_count > 0 ? `최대 ${entry.max_count}회` : null
}

function parse(name: string): { category: string | null; displayName: string } {
  const override = CATEGORY_OVERRIDE[name]
  const bracket = BRACKET_PREFIX.exec(name)
  if (bracket !== null) {
    return { category: override ?? bracket[1].trim(), displayName: bracket[2].trim() }
  }
  const epic = EPIC_DUNGEON_PREFIX.exec(name)
  if (epic !== null) {
    return { category: override ?? '에픽 던전', displayName: epic[2].trim() }
  }
  return { category: override ?? null, displayName: name }
}

// 접두사 없는 항목은 label:null 단독 그룹으로 그 자리에 두고, 카테고리 첫 등장 순서를 보존한다.
export const WEEKLY_CATEGORY_ORDER = [
  '에픽 던전',
  '몬스터파크',
  '길드',
  '아케인리버 지역 퀘스트',
  '주간 퀘스트',
  '무릉도장',
  '메이플 유니온',
] as const

export function categorizeContentEntries(
  entries: SchedulerContentTemplateEntry[],
  categoryOrder?: readonly string[],
): ContentCategoryGroup[] {
  const order: string[] = []
  const groups = new Map<string, ContentCategoryGroup>()
  let standaloneCount = 0

  for (const entry of entries) {
    const { category, displayName } = parse(entry.content_name)
    if (category === null) {
      // 단독 항목마다 유니크 키 — 실제 카테고리명은 trim되므로 선행 공백 접두사면 절대 안 겹친다
      const key = ` standalone-${standaloneCount++}`
      order.push(key)
      groups.set(key, { label: null, items: [{ entry, displayName }] })
      continue
    }
    let group = groups.get(category)
    if (group === undefined) {
      group = { label: category, items: [] }
      groups.set(category, group)
      order.push(category)
    }
    group.items.push({ entry, displayName })
  }

  const result = order.map((key) => {
    const group = groups.get(key)
    if (group === undefined) throw new Error(`카테고리 그룹 조회 실패: ${key}`)
    return group
  })

  if (categoryOrder === undefined) return result

  // categoryOrder에 있는 카테고리를 그 순서로 앞세운다. 목록에 없는 카테고리·단독(label null)은
  // 동일 순위라 안정 정렬 덕에 첫 등장 순서를 유지하며 뒤에 온다.
  const rankOf = (label: string | null): number => {
    if (label === null) return categoryOrder.length
    const index = categoryOrder.indexOf(label)
    return index === -1 ? categoryOrder.length : index
  }
  return [...result].sort((a, b) => rankOf(a.label) - rankOf(b.label))
}
