// **표시 대상 보스 목록** — 보스 스케줄러 화면과 `today` 의 「캐릭터별 남은 스케줄」이 **같은 함수를
// 부른다**([[ADR-147]] 결정 8).
//
// 2026-08-17 이전에는 `BossScreen.tsx` 안의 지역 함수 `displayedBossesOf` 였다. 그 자리에 있는 한
// 화면 밖에서 부를 방법이 없어서, today 가 «남은 보스» 를 세려면 자기 판정을 새로 쓸 수밖에 없고
// 그 순간 두 화면이 서로 다른 수를 말하기 시작한다. **복제가 아니라 이동이라 로직은 한 줄도 안
// 바뀌었다** — 클로저로 읽던 `mode`·`manualTrackedByOcid` 가 인자가 된 것이 전부다.
//
// 이 함수 안에 결정 둘이 들어 있다:
// - [[ADR-035]] 결정 3·6·12·20 — **수동 모드**는 게임 등록 여부가 아니라 앱의 추적 멤버십이 표시
//   목록을 정하고, 완료 여부는 값 복제 없이 동기화 결과에서 즉석 조회한다(`mergeManualBossList`).
// - [[ADR-031]] 결정 5 — **자동 모드**는 등록된 난이도가 있으면 그것만, 없으면 완료된 난이도를
//   대신 보여준다(`selectDisplayBosses`). 즉 미등록이어도 완료했으면 목록에 든다.
//
// 의존이 코어 모듈과 인자뿐이라(화면·저장소·네이티브를 안 만진다) 여기 있을 수 있다.
import { matchBossContent, selectDisplayBosses, type MatchedBoss } from '../../lib/boss-matching'
import { mergeManualBossList } from '../../lib/manual-boss-merge'
import type { BossContent, BossCycle } from '../../types'
import type { ManualTrackedItem } from '../../types/scheduler'
import type { TrackingMode } from '../../storage/tracking-mode'
import type { BossCharacterView } from './store'

/** 통합 목록에서 무리가 서는 순서 — **월간이 위**다([[ADR-164]] 결정 1, 이슈 #247). */
export const BOSS_SECTION_ORDER: readonly BossCycle[] = ['monthly', 'weekly']

/**
 * **캐릭터를 인자로 받는다**([[ADR-142]] 결정 4) — 선택된 캐릭터의 카드 목록과 초상화 레일의 링이
 * **같은 함수**를 써야 «링이 세는 것 = 화면에 보이는 것» 이 구조로 보장된다. 레일은 선택되지 않은
 * 캐릭터도 세므로 «지금 선택된 캐릭터» 를 안에서 집을 수 없다.
 */
export function displayedBosses(
  character: BossCharacterView,
  cycle: BossCycle,
  mode: TrackingMode,
  manualTrackedByOcid: Record<string, ManualTrackedItem[]> | null,
): MatchedBoss[] {
  if (mode !== 'manual') {
    return selectDisplayBosses(cycle === 'weekly' ? character.weeklyBosses : character.monthlyBosses)
  }

  const items = (manualTrackedByOcid?.[character.ocid] ?? []).filter((item) => item.kind === 'boss')
  // synced 는 store 의 auto 목록(MatchedBoss)에서 BossContent 로 되돌려 넘긴다 — MatchedBoss 는
  // BossContent 의 모든 필드를 갖고 있어 손실이 없다.
  const synced: BossContent[] = [...character.weeklyBosses, ...character.monthlyBosses].map((boss) => ({
    name: boss.apiName,
    difficulty: boss.difficulty,
    cycle: boss.cycle,
    isRegistered: boss.isRegistered,
    isComplete: boss.isComplete,
    ownComplete: boss.ownComplete,
  }))
  return mergeManualBossList(items, synced)
    .map(matchBossContent)
    .filter((boss) => boss.cycle === cycle)
}

/**
 * 통합 목록의 **한 무리** — 섹션 헤더 하나가 덮는 범위다([[ADR-164]] 결정 3).
 *
 * 라벨(「월간」·「주간」)은 여기 없다 — 그것은 화면의 말이고, 이 모듈이 정하는 것은 **순서**뿐이다.
 */
export interface BossSection {
  readonly cycle: BossCycle
  readonly bosses: MatchedBoss[]
}

/**
 * **월간이 먼저, 그다음 주간**([[ADR-164]] 결정 1).
 *
 * 순서를 화면이 아니라 여기 두는 이유는 표시 목록 판정을 여기 둔 이유와 같다 — 화면이 다시
 * 해석하면 같은 목록이 자리마다 다른 순서로 선다.
 *
 * **빈 무리를 걷지 않는다.** 솔로/파티 필터는 화면이 걸고, «비었다» 는 판정은 그 뒤에야 성립한다
 * ([[ADR-164]] 결정 6 — 무리가 비면 헤더도 함께 사라진다). 여기서 미리 걷어도 화면이 필터 후
 * 다시 걷어야 하므로 판정이 두 곳이 된다.
 *
 * **완료는 자리를 안 바꾼다**([[ADR-164]] 결정 2) — 정렬이 아예 없는 것이 그 결정의 모습이다.
 * 무리 안의 순서는 자동 모드가 참조표 순서, 수동 모드가 추적 순서이고 둘 다 전과 같다.
 */
export function displayedBossSections(
  character: BossCharacterView,
  mode: TrackingMode,
  manualTrackedByOcid: Record<string, ManualTrackedItem[]> | null,
): BossSection[] {
  return BOSS_SECTION_ORDER.map((cycle) => ({
    cycle,
    bosses: displayedBosses(character, cycle, mode, manualTrackedByOcid),
  }))
}
