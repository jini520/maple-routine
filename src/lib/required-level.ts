import weeklyBossesData from '../data/weekly-bosses.json'
import schedulerContentTemplate from '../data/scheduler-content-template.json'

// ADR-055 결정 4: 요구 레벨(진행 가능 최소 레벨) 조회를 한 곳에 모은다. 값은 게임 레퍼런스
// 데이터에서만 오고 코드가 추정하지 않는다([[ADR-006]]) — 보스는 (보스, 난이도)별 맵,
// 컨텐츠는 난이도 개념이 없어 항목당 단일 값이다.

interface BossRequiredLevelEntry {
  boss: string
  requiredLevels?: Record<string, number>
}

interface ContentRequiredLevelEntry {
  content_name: string
  requiredLevel?: number
}

// 화면이 행마다 반복 조회하므로 모듈 로드 시 한 번만 인덱싱한다(boss-matching의 정규 순서 맵과 동일 패턴).
const BOSS_REQUIRED_LEVELS = new Map<string, Record<string, number>>()
for (const section of ['weekly', 'eventWeekly', 'monthly'] as const) {
  for (const entry of weeklyBossesData[section] as BossRequiredLevelEntry[]) {
    if (entry.requiredLevels !== undefined && !BOSS_REQUIRED_LEVELS.has(entry.boss)) {
      BOSS_REQUIRED_LEVELS.set(entry.boss, entry.requiredLevels)
    }
  }
}

const CONTENT_REQUIRED_LEVELS = new Map<string, number>()
for (const section of ['daily', 'weekly'] as const) {
  for (const entry of schedulerContentTemplate[section] as ContentRequiredLevelEntry[]) {
    if (entry.requiredLevel !== undefined && !CONTENT_REQUIRED_LEVELS.has(entry.content_name)) {
      CONTENT_REQUIRED_LEVELS.set(entry.content_name, entry.requiredLevel)
    }
  }
}

// 보스 표시명 + 난이도의 요구 레벨. 참조표에 없는 보스·난이도이거나 값이 미확정이면 null이다.
export function getBossRequiredLevel(boss: string, difficulty: string): number | null {
  return BOSS_REQUIRED_LEVELS.get(boss)?.[difficulty] ?? null
}

// 컨텐츠 항목명의 요구 레벨. 템플릿에 없는 항목이거나 레벨 제한이 없어 필드를 생략한 항목이면 null이다.
export function getContentRequiredLevel(contentName: string): number | null {
  return CONTENT_REQUIRED_LEVELS.get(contentName) ?? null
}

// ADR-055 결정 5: 모르면 잠그지 않는다. 요구 레벨이 미확정이거나(데이터 공백) 캐릭터 레벨
// 캐시가 없으면(콜드 스타트) 통과시킨다 — 거짓 잠금은 사용자가 할 수 있는 일을 없애면서
// 틀린 이유만 보여주지만, 거짓 허용은 사용자가 직접 해제할 수 있다.
export function isLevelLocked(characterLevel: number | null, requiredLevel: number | null): boolean {
  if (characterLevel === null || requiredLevel === null) {
    return false
  }
  return characterLevel < requiredLevel
}
