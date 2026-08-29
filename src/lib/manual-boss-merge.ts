import weeklyBossesData from '../data/weekly-bosses.json'
import { compareBossOrder, matchBossContent } from './boss-matching'
import type { BossContent, BossCycle } from '../types'
import type { ManualTrackedItem } from '../types/scheduler'

interface BossReferenceEntry {
  boss: string
}

// weekly-bosses.json에서 보스명 → cycle 조회 테이블(weekly/eventWeekly → 'weekly', monthly → 'monthly').
// 수동 추적 항목은 이 파일의 boss 값을 그대로 contentName으로 저장하므로 정확 일치로 조회하고,
// 없으면 'weekly'로 안전하게 폴백한다(크래시 금지).
const BOSS_CYCLE_BY_NAME = new Map<string, BossCycle>()
for (const entry of [
  ...(weeklyBossesData.weekly as BossReferenceEntry[]),
  ...(weeklyBossesData.eventWeekly as BossReferenceEntry[]),
]) {
  BOSS_CYCLE_BY_NAME.set(entry.boss, 'weekly')
}
for (const entry of weeklyBossesData.monthly as BossReferenceEntry[]) {
  BOSS_CYCLE_BY_NAME.set(entry.boss, 'monthly')
}

function lookupCycle(bossName: string): BossCycle {
  return BOSS_CYCLE_BY_NAME.get(bossName) ?? 'weekly'
}

// ADR-035 결정 6·12: 수동 모드 보스 표시 목록은 멤버십(tracked)만으로 결정하고, 완료 여부는
// 동기화 결과(synced)에서 즉석 조회한다 — 값을 멤버십에 복제하지 않는다(단일 진실 공급원).
// 보스는 카운트형 진행값이 없어 별도 템플릿 기본값 파일이 필요 없다(한 번도 동기화된 적 없는
// 보스는 "미완료"가 자연스러운 기본값).
//
// - tracked: kind === 'boss'인 manualTrackedContent 항목만 넘긴다(호출부에서 필터링).
// - synced: 이 캐릭터의 bossContents(cycle 무관 전체, name은 API 원문 apiName).
// 반환 순서는 tracked(추가/삭제 순서)가 아니라 weekly-bosses.json 순서(보스 관리 페이지와 동일)를
// 따른다 — 항목을 추가·제거해도 순서가 흔들리지 않게 고정한다(ADR-035 결정 20). BossScreen이 이
// 결과를 cycle로 필터만 하므로 주간/월간 탭 각각이 관리 페이지와 같은 순서로 나온다.
export function mergeManualBossList(
  tracked: ManualTrackedItem[],
  synced: BossContent[],
): BossContent[] {
  // ADR-035 결정 20: weekly-bosses.json 정규 순서(보스 관리 페이지 BOSSES_BY_TAB와 동일)로 정렬한다.
  // **비교자는 boss-matching의 공용 compareBossOrder다**([[ADR-186]] 결정 2 — [[ADR-036]]에서 사설
  // 사본을 흡수한 뒤, 정렬 키 셋까지 그 함수 하나로 합쳤다). 그래서 참조 밖 보스끼리도 난이도·
  // 이름으로 완전히 갈린다 — 종전의 «멤버십 순서 유지»(안정 정렬에 기댄 계약)를 이것이 덮는다.
  // 관리 화면이 참조표에서만 고르므로 실제로는 참조표에서 보스가 빠진 뒤 남은 저장분에만 걸린다.
  const ordered = [...tracked].sort((a, b) =>
    compareBossOrder({ boss: a.contentName, difficulty: a.difficulty }, { boss: b.contentName, difficulty: b.difficulty }),
  )
  return ordered.map((item): BossContent => {
    // 보스는 이름만으로 유일하지 않으므로 (matchedBossName, difficulty) 쌍으로 매칭한다.
    // synced.name은 API 원문(공백 차이·별칭)이라, matchBossContent로 우리 데이터 이름으로 정규화해
    // 비교한다(ADR-007 보스명 매칭 규칙 재사용). 찾으면 isRegistered와 무관하게 그 항목의
    // isComplete/ownComplete/cycle을 그대로 쓴다.
    const match = synced.find(
      (boss) =>
        matchBossContent(boss).matchedBossName === item.contentName && boss.difficulty === item.difficulty,
    )
    // ADR-121 결정 5: 정확 일치 행이 없거나 그 행이 미완료면, 같은 보스명의 **다른 난이도** 완료를
    // 완료로 승격한다. normalize.ts가 하는 보스 단위 승격(ADR-031·032)이 `isRegistered` 인 행에만
    // 걸리고, 이 병합은 (보스명, 난이도) 정확 일치로만 찾았기 때문에 난이도를 바꾸는 순간 완료
    // 배지가 사라졌다 — 새 정책이 아니라 그 승격 규칙을 수동 경로에도 적용하는 누락 보완이다.
    // ownComplete는 승격하지 않는다(ADR-033 결정 1) — 보스 수익이 "실제로 어느 난이도를
    // 처치했는가"를 판정하는 근거라 원본이어야 한다.
    const isCompleteByAnyDifficulty = synced.some(
      (boss) => matchBossContent(boss).matchedBossName === item.contentName && boss.isComplete,
    )

    if (match !== undefined) {
      return { ...match, isComplete: match.isComplete || isCompleteByAnyDifficulty }
    }

    // 한 번도 동기화 응답에 나타난 적 없는 보스 — cycle만 참조 테이블에서 채우고 미완료로 둔다.
    return {
      name: item.contentName,
      difficulty: item.difficulty as BossContent['difficulty'],
      cycle: lookupCycle(item.contentName),
      isRegistered: false,
      isComplete: isCompleteByAnyDifficulty,
      ownComplete: false,
    }
  })
}
