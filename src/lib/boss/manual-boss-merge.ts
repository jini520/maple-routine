import { compareBossOrder } from './boss-matching'
import { bossCycleOf, bossNameOf } from './bosses'
import type { BossContent } from '../../types'
import type { ManualTrackedBossItem } from '../../types/scheduler'

// 수동 모드 보스 표시 목록은 멤버십(tracked)만으로 결정하고, 완료 여부는
// 동기화 결과(synced)에서 즉석 조회한다. 값을 멤버십에 복제하지 않는다(단일 진실 공급원).
// 보스는 카운트형 진행값이 없어 별도 템플릿 기본값 파일이 필요 없다(한 번도 동기화된 적 없는
// 보스는 "미완료"가 자연스러운 기본값).
//
// - tracked: kind === 'boss'인 manualTrackedContent 항목만 넘긴다(호출부에서 필터링).
// - synced: 이 캐릭터의 bossContents(cycle 무관 전체).
// 반환 순서는 tracked(추가/삭제 순서)가 아니라 보스 표 순서(보스 관리 페이지와 동일)를
// 따른다. 항목을 추가·제거해도 순서가 흔들리지 않게 고정한다. BossScreen이 이
// 결과를 cycle로 필터만 하므로 주간/월간 탭 각각이 관리 페이지와 같은 순서로 나온다.
export function mergeManualBossList(tracked: ManualTrackedBossItem[], synced: BossContent[]): BossContent[] {
  // 보스 표 차례(보스 관리 화면의 목록과 같다)로 정렬한다. 비교자는 `boss-matching` 의 공용
  // `compareBossOrder` 다. 그래서 표 밖 보스끼리도 난이도 · 글자로 완전히 갈린다. 관리 화면이 표에서만
  // 고르므로 실제로는 표에서 보스가 빠진 뒤 남은 저장분에만 걸린다.
  const ordered = [...tracked].sort((a, b) =>
    compareBossOrder({ boss: a.bossKey, difficulty: a.difficulty }, { boss: b.bossKey, difficulty: b.difficulty }),
  )
  return ordered.map((item): BossContent => {
    // 보스는 key 만으로 유일하지 않으므로 (key, 난이도) 쌍으로 찾는다. 찾으면 isRegistered와 무관하게 그
    // 항목의 isComplete/ownComplete/cycle을 그대로 쓴다.
    const match = synced.find((boss) => boss.bossKey === item.bossKey && boss.difficulty === item.difficulty)
    // 정확 일치 행이 없거나 그 행이 미완료면, 같은 보스의 **다른 난이도** 완료를
    // 완료로 승격한다. normalize.ts가 하는 보스 단위 승격(032)이 `isRegistered` 인 행에만
    // 걸리고, 이 병합은 (보스, 난이도) 정확 일치로만 찾았기 때문에 난이도를 바꾸는 순간 완료
    // 배지가 사라졌다. 새 정책이 아니라 그 승격 규칙을 수동 경로에도 적용하는 누락 보완이다.
    // ownComplete는 승격하지 않는다. 보스 수익이 "실제로 어느 난이도를
    // 처치했는가"를 판정하는 근거라 원본이어야 한다.
    const isCompleteByAnyDifficulty = synced.some((boss) => boss.bossKey === item.bossKey && boss.isComplete)

    if (match !== undefined) {
      return { ...match, isComplete: match.isComplete || isCompleteByAnyDifficulty }
    }

    // 한 번도 동기화 응답에 나타난 적 없는 보스. 이름과 주기를 보스 표에서 채우고 미완료로 둔다. 주기를 못
    // 찾으면(표에서 빠진 보스) 주간으로 둔다. 크래시보다 목록에 남기는 편이 낫다.
    return {
      bossKey: item.bossKey,
      apiName: bossNameOf(item.bossKey, item.bossKey),
      difficulty: item.difficulty,
      cycle: bossCycleOf(item.bossKey) ?? 'weekly',
      isRegistered: false,
      isComplete: isCompleteByAnyDifficulty,
      ownComplete: false,
    }
  })
}
