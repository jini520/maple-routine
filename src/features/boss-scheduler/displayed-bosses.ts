/**
 * 표시 대상 보스 목록. 보스 스케줄러 화면과 `today` 의 캐릭터별 남은 스케줄이 같은 함수를 부른다.
 *
 * 화면 안의 지역 함수로 두면 화면 밖에서 부를 방법이 없어 today 가 남은 보스를 세려면 자기
 * 판정을 새로 써야 하고, 그 순간 두 화면이 서로 다른 수를 말하기 시작한다.
 *
 * 이 함수 안에 판정 둘이 들어 있다.
 * - 수동 모드는 게임 등록 여부가 아니라 앱의 추적 멤버십이 표시 목록을 정하고, 완료 여부는 값
 *   복제 없이 동기화 결과에서 즉석 조회한다(`mergeManualBossList`).
 * - 자동 모드는 등록된 난이도가 있으면 그것만, 없으면 완료된 난이도를 대신 보여준다
 *   (`selectDisplayBosses`). 미등록이어도 완료했으면 목록에 든다.
 *
 * 의존이 코어 모듈과 인자뿐이라(화면·저장소·네이티브를 안 만진다) 여기 있을 수 있다.
 */
import {
  compareBossOrder,
  isWeeklyClearLimitReached,
  matchBossContent,
  selectDisplayBosses,
  type MatchedBoss,
} from '../../lib/boss/boss-matching'
import { mergeManualBossList } from '../../lib/boss/manual-boss-merge'
import type { BossContent, BossCycle } from '../../types'
import type { ManualTrackedItem } from '../../types/scheduler'
import type { TrackingMode } from '../../storage/tracking-mode'
import type { BossCharacterView } from './store'

/** 통합 목록에서 무리가 서는 순서. 월간이 위다. */
export const BOSS_SECTION_ORDER: readonly BossCycle[] = ['monthly', 'weekly']

/**
 * 표시 목록의 한 항목. `MatchedBoss` 에 **이 캐릭터의 주간 한도 상태**를 얹은 것.
 *
 * 마감을 화면이 다시 판정하지 않게 하려고 여기 싣는다. 스케줄러 카드는 완료 자리에 배지를
 * 바꿔 달고, today 남은 스케줄은 이 값으로 남은 것 에서 뺀다.
 */
export interface DisplayedBoss extends MatchedBoss {
  /** 주간 12마리를 채운 뒤 남은 **미처치 주간 보스**. 이번 주엔 더 잡을 수 없다. */
  readonly isWeeklyLimitClosed: boolean
}

/**
 * 캐릭터를 인자로 받는 목록. 선택된 캐릭터의 카드 목록과 초상화 레일의 링이 같은 함수를 써야 링이
 * 세는 것 = 화면에 보이는 것 이 구조로 보장된다. 레일은 선택되지 않은 캐릭터도 세므로 지금
 * 선택된 캐릭터를 안에서 집을 수 없다.
 *
 * 순서는 `weekly-bosses.json` 정규 순서다. 아래 `orderByReference` 가 모드를 안 가르고 끝에서
 * 한 번 세운다.
 */
export function displayedBosses(
  character: BossCharacterView,
  cycle: BossCycle,
  mode: TrackingMode,
  manualTrackedByOcid: Record<string, ManualTrackedItem[]> | null,
): DisplayedBoss[] {
  // 한도는 캐릭터의 주간 전체로 판정한다. 추적 목록이 아니라 동기화 결과다. 겨누는 상황이
  // 목록 밖 보스로 12를 채웠다 라, 목록만 보면 영영 12가 안 된다.
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
  // synced 는 store 의 auto 목록(MatchedBoss)에서 BossContent 로 되돌려 넘긴다. MatchedBoss 는
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
 * 마감을 원소에 실어 보내는 표시.
 *
 * 마감은 주간 한도가 찼는데 아직 미처치 다. 시즌 보스와 월간 보스는 한도 밖이라 언제나 `false`
 * 이고, 이미 잡은 보스도 `false` 다. 마감은 완료를 대체하지 않는다.
 *
 * `MatchedBoss` 자체에 안 넣는 것은 그 타입이 보스 하나를 말하고 마감은 캐릭터의 주간 전체를
 * 봐야 나오는 값이라 `matchBossContent` 가 채울 수 없기 때문이다.
 */
function stampLimitClosed(bosses: MatchedBoss[], limitReached: boolean): DisplayedBoss[] {
  return bosses.map((boss) => ({
    ...boss,
    isWeeklyLimitClosed:
      limitReached && boss.cycle === 'weekly' && !boss.isSeasonBoss && !boss.isComplete,
  }))
}

/**
 * 무리 안의 차례. `weekly-bosses.json` 정규 순서 → 난이도 → 보스명.
 *
 * 모드를 안 가른다. 수동 경로는 `mergeManualBossList` 가 이미 같은 비교자로 세워 두므로 여기서
 * 다시 세우는 것은 멱등이고, 대신 어느 순서로 내는가 계약이 한 줄이 된다.
 *
 * 비교자는 참조표의 소유자(`lib/boss/boss-matching`)가 든다. 여기서 자기 정렬을 쓰면 같은
 * 규칙이 앱에 네 벌이 된다.
 *
 * 완료는 자리를 안 바꾼다. 이 함수가 보는 것은 이름과 난이도뿐이다.
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
 * 통합 목록의 **한 무리**. 섹션 헤더 하나가 덮는 범위다.
 *
 * 라벨(월간·주간)은 여기 없다. 그것은 화면의 말이고, 이 모듈이 정하는 것은 **순서**뿐이다.
 */
export interface BossSection {
  readonly cycle: BossCycle
  readonly bosses: DisplayedBoss[]
}

/**
 * 월간이 먼저, 그다음 주간.
 *
 * 순서를 화면이 아니라 여기 두는 이유는 표시 목록 판정을 여기 둔 이유와 같다. 화면이 다시
 * 해석하면 같은 목록이 자리마다 다른 순서로 선다.
 *
 * 빈 무리를 걷지 않는다. 솔로/파티 필터는 화면이 걸고 비었다 는 판정은 그 뒤에야 성립한다.
 * 여기서 미리 걷어도 화면이 필터 후 다시 걷어야 하므로 판정이 두 곳이 된다.
 *
 * 완료는 자리를 안 바꾼다. 무리 안의 순서는 두 모드 모두 `weekly-bosses.json` 정규 순서이고,
 * 그것을 세우는 자리는 `displayedBosses` 다.
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
