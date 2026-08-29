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
import {
  compareBossOrder,
  isWeeklyClearLimitReached,
  matchBossContent,
  selectDisplayBosses,
  type MatchedBoss,
} from '../../lib/boss-matching'
import { mergeManualBossList } from '../../lib/manual-boss-merge'
import type { BossContent, BossCycle } from '../../types'
import type { ManualTrackedItem } from '../../types/scheduler'
import type { TrackingMode } from '../../storage/tracking-mode'
import type { BossCharacterView } from './store'

/** 통합 목록에서 무리가 서는 순서 — **월간이 위**다([[ADR-164]] 결정 1, 이슈 #247). */
export const BOSS_SECTION_ORDER: readonly BossCycle[] = ['monthly', 'weekly']

/**
 * 표시 목록의 한 항목 — `MatchedBoss` 에 **이 캐릭터의 주간 한도 상태**를 얹은 것([[ADR-187]] 결정 2).
 *
 * 「마감」을 화면이 다시 판정하지 않게 하려고 여기 싣는다 — 스케줄러 카드는 「완료」 자리에 배지를
 * 바꿔 달고, today 「남은 스케줄」은 이 값으로 «남은 것» 에서 뺀다([[ADR-147]] 결정 8 의 등식).
 */
export interface DisplayedBoss extends MatchedBoss {
  /** 주간 12마리를 채운 뒤 남은 **미처치 주간 보스** — 이번 주엔 더 잡을 수 없다. */
  readonly isWeeklyLimitClosed: boolean
}

/**
 * **캐릭터를 인자로 받는다**([[ADR-142]] 결정 4) — 선택된 캐릭터의 카드 목록과 초상화 레일의 링이
 * **같은 함수**를 써야 «링이 세는 것 = 화면에 보이는 것» 이 구조로 보장된다. 레일은 선택되지 않은
 * 캐릭터도 세므로 «지금 선택된 캐릭터» 를 안에서 집을 수 없다.
 *
 * **순서는 `weekly-bosses.json` 정규 순서다**([[ADR-186]]) — 아래 `orderByReference` 가 **모드를 안
 * 가르고** 끝에서 한 번 세운다. 자동 모드는 종전에 정렬이 아예 없어 Nexon `boss_contents` **응답
 * 순서**로 서고 있었다.
 */
export function displayedBosses(
  character: BossCharacterView,
  cycle: BossCycle,
  mode: TrackingMode,
  manualTrackedByOcid: Record<string, ManualTrackedItem[]> | null,
): DisplayedBoss[] {
  // 한도는 **캐릭터의 주간 전체**로 판정한다 — 추적 목록이 아니라 동기화 결과다([[ADR-031]] 결정 1
  // 이 «등록 여부와 무관하게» 세는 이유와 같다). 이 결정이 겨누는 상황이 «목록 밖 보스로 12를
  // 채웠다» 라, 목록만 보면 영영 12가 안 된다.
  const limitReached = isWeeklyClearLimitReached(character.weeklyBosses)

  if (mode !== 'manual') {
    return stampLimitClosed(
      orderByReference(
        selectDisplayBosses(cycle === 'weekly' ? character.weeklyBosses : character.monthlyBosses),
      ),
      limitReached,
    )
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
  return stampLimitClosed(
    orderByReference(
      mergeManualBossList(items, synced)
        .map(matchBossContent)
        .filter((boss) => boss.cycle === cycle),
    ),
    limitReached,
  )
}

/**
 * 「마감」을 원소에 **실어 보낸다** ([[ADR-187]] 결정 2).
 *
 * 마감은 «주간 한도가 찼는데 아직 미처치» 다 — 시즌 보스와 월간 보스는 한도 밖이라 언제나 `false`
 * 이고([[ADR-054]] 결정 3·[[ADR-059]] 결정 3), 이미 잡은 보스도 `false` 다(마감은 완료를 대체하지
 * 않는다).
 *
 * `MatchedBoss` 자체에 넣지 않는 이유: 그 타입은 «보스 하나» 를 말하고 마감은 **캐릭터의 주간
 * 전체**를 봐야 나오는 값이라 `matchBossContent` 가 채울 수 없다.
 */
function stampLimitClosed(bosses: MatchedBoss[], limitReached: boolean): DisplayedBoss[] {
  return bosses.map((boss) => ({
    ...boss,
    isWeeklyLimitClosed:
      limitReached && boss.cycle === 'weekly' && !boss.isSeasonBoss && !boss.isComplete,
  }))
}

/**
 * 무리 안의 차례 — **`weekly-bosses.json` 정규 순서 → 난이도 → 보스명**([[ADR-186]] 결정 1·3).
 *
 * **모드를 안 가른다.** 수동 경로는 `mergeManualBossList` 가 이미 같은 비교자로 세워 두므로 여기서
 * 다시 세우는 것은 멱등이고, 대신 이 모듈의 «어느 순서로 내는가» 계약이 **한 줄**이 된다 — 모드
 * 분기 안에 넣으면 그 계약이 다시 두 벌이고, 한쪽만 고치는 날이 온다.
 *
 * 비교자는 참조표의 소유자(`lib/boss-matching`)가 든다 — 여기서 자기 정렬을 쓰면 같은 규칙이 앱에
 * 네 벌이 된다([[ADR-186]] 결정 2).
 *
 * **완료는 여전히 자리를 안 바꾼다**([[ADR-164]] 결정 2) — 이 함수가 보는 것은 이름과 난이도뿐이다.
 */
function orderByReference(bosses: MatchedBoss[]): MatchedBoss[] {
  return [...bosses].sort((a, b) =>
    compareBossOrder(
      { boss: a.matchedBossName ?? a.apiName, difficulty: a.difficulty },
      { boss: b.matchedBossName ?? b.apiName, difficulty: b.difficulty },
    ),
  )
}

/**
 * 통합 목록의 **한 무리** — 섹션 헤더 하나가 덮는 범위다([[ADR-164]] 결정 3).
 *
 * 라벨(「월간」·「주간」)은 여기 없다 — 그것은 화면의 말이고, 이 모듈이 정하는 것은 **순서**뿐이다.
 */
export interface BossSection {
  readonly cycle: BossCycle
  readonly bosses: DisplayedBoss[]
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
 * **완료는 자리를 안 바꾼다**([[ADR-164]] 결정 2) — 완료 여부로 가르는 정렬이 없는 것이 그 결정의
 * 모습이다. 무리 **안**의 순서는 두 모드 모두 `weekly-bosses.json` 정규 순서이고, 그것을 세우는
 * 자리는 `displayedBosses` 다([[ADR-186]]).
 *
 * (2026-08-30 정정: 이 자리에 «자동 모드가 참조표 순서, 수동 모드가 추적 순서» 라고 적혀 있었는데
 * **정확히 반대**였다 — 정렬하는 쪽이 수동뿐이었다. [[ADR-186]] 이 자동 모드도 같은 순서로 세우면서
 * 그 문장이 가리키던 갈림 자체가 없어졌다.)
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
