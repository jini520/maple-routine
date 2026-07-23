import weeklyBossesData from '../data/weekly-bosses.json'
import { matchBossContent } from './boss-matching'
import type { BossContent, BossCycle } from '../types'
import type { ManualTrackedItem } from '../storage/manual-tracked-content'

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
// 반환 순서는 tracked 배열 순서를 그대로 따른다(사용자가 추가한 순서 유지).
export function mergeManualBossList(
  tracked: ManualTrackedItem[],
  synced: BossContent[],
): BossContent[] {
  return tracked.map((item): BossContent => {
    // 보스는 이름만으로 유일하지 않으므로 (matchedBossName, difficulty) 쌍으로 매칭한다.
    // synced.name은 API 원문(공백 차이·별칭)이라, matchBossContent로 우리 데이터 이름으로 정규화해
    // 비교한다(ADR-007 보스명 매칭 규칙 재사용). 찾으면 isRegistered와 무관하게 그 항목의
    // isComplete/ownComplete/cycle을 그대로 쓴다.
    const match = synced.find(
      (boss) =>
        matchBossContent(boss).matchedBossName === item.contentName && boss.difficulty === item.difficulty,
    )
    if (match !== undefined) {
      return { ...match }
    }

    // 한 번도 동기화 응답에 나타난 적 없는 보스 — cycle만 참조 테이블에서 채우고 미완료로 둔다.
    return {
      name: item.contentName,
      difficulty: item.difficulty as BossContent['difficulty'],
      cycle: lookupCycle(item.contentName),
      isRegistered: false,
      isComplete: false,
      ownComplete: false,
    }
  })
}
