import { setManualTrackedContent, type ManualTrackedItem } from '../../storage/manual-tracked-content'
import { TEMPLATE_DAILY_KEYS, TEMPLATE_WEEKLY_KEYS } from '../../lib/scheduler/scheduler-content-template'
import { isSeasonBoss } from '../../lib/boss/bosses'
import { isChallengersWorld } from '../../lib/world/worlds'
import type { SchedulerCharacterState } from '../../types'
import { syncSchedules } from '../schedule-sync/schedule-sync'

// 컨텐츠는 일간·주간 소스 배열로 kind 를 확정해 컨텐츠 key 로 저장하고, 템플릿에 없는 컨텐츠(key 가 없거나 그
// 섹션 key 가 아니다)는 제외한다(멤버십 ⊆ 템플릿. 관리 페이지 체크리스트에서 편집 불가능한 고아 방지). 보스는
// `mergeManualBossList` 의 매칭 기준과 같게 보스 key 로 저장하고, 보스 표에 없는 보스(key 가 없다)는 뺀다.
// 저장하는 것은 멤버십(+보스 난이도)뿐이다. nowCount·isComplete 같은 값은 표시 시점에
// schedulerCache 에서 조회한다.
function toTrackedItems(state: SchedulerCharacterState): ManualTrackedItem[] {
  const { dailyContents, weeklyContents, bossContents } = state

  const contentItems: ManualTrackedItem[] = [
    ...dailyContents.flatMap((content) =>
      content.isRegistered && content.contentKey !== null && TEMPLATE_DAILY_KEYS.has(content.contentKey)
        ? [{ contentKey: content.contentKey, kind: 'daily' as const }]
        : [],
    ),
    ...weeklyContents.flatMap((content) =>
      content.isRegistered && content.contentKey !== null && TEMPLATE_WEEKLY_KEYS.has(content.contentKey)
        ? [{ contentKey: content.contentKey, kind: 'weekly' as const }]
        : [],
    ),
  ]

  // 시즌 보스는 챌린저스 월드 캐릭터에만 담는다. 리프로 넘어온 등록을 일반 월드 캐릭터에 담으면 보스 관리
  // 화면이 시즌 보스 줄을 숨겨 사용자가 뺄 길이 없다.
  const bossItems: ManualTrackedItem[] = bossContents.flatMap((boss) =>
    boss.isRegistered &&
    boss.bossKey !== null &&
    (!isSeasonBoss(boss.bossKey) || isChallengersWorld(state.worldKey))
      ? [{ kind: 'boss' as const, bossKey: boss.bossKey, difficulty: boss.difficulty }]
      : [],
  )

  return [...contentItems, ...bossItems]
}

// 주어진 ocid 들에 대해 최신 동기화 결과를 기준으로 manualTrackedContent 를 1회 채운다. 기존
// 값이 있어도 덮어쓴다. syncSchedules 호출이 실패하거나 state 가 null 이면 에러를 던진다. 빈
// 배열로 조용히 시드하면 정말 아무것도 등록 안 한 사용자 와 구분이 안 된다.
//
// ocid 전원을 한 회차로 훑는다. 캐릭터마다 syncSchedules 를 동시에 내면 단일 비행에 서로
// 합류해 전원이 첫 캐릭터의 스케줄로 시드된다. 결과를 위치가 아니라 ocid 로 찾는 것도
// 그래서다. 못 찾으면 남의 것을 쓰지 않고 실패한다.
export async function seedManualTrackedContent(ocids: string[]): Promise<void> {
  if (ocids.length === 0) {
    return
  }

  const results = await syncSchedules(ocids)
  const stateByOcid = new Map(results.map((result) => [result.ocid, result.state]))

  await Promise.all(
    ocids.map(async (ocid) => {
      const state = stateByOcid.get(ocid)
      if (state == null) {
        throw new Error(
          `seedManualTrackedContent: ${ocid}의 최신 동기화 결과가 없어 시드할 수 없습니다`,
        )
      }
      await setManualTrackedContent(ocid, toTrackedItems(state))
    }),
  )
}
