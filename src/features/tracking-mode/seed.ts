import { setManualTrackedContent, type ManualTrackedItem } from '../../storage/manual-tracked-content'
import { syncSchedules } from '../schedule-sync/schedule-sync'

// ADR-035 결정 3·15: ocid 하나에 대해 최신 동기화 결과를 기준으로 manualTrackedContent를
// 1회 채운다(기존 값이 있어도 덮어쓴다 — "최초 편입 시 1회 시드"이므로 매번 새로 계산).
// syncSchedules 호출이 실패하거나 state가 null이면(전역 인증 실패 등) 에러를 던진다 —
// 빈 배열로 조용히 시드하면 "정말 아무것도 등록 안 한 사용자"와 구분이 안 된다(결정 15 취지).
// 저장하는 것은 멤버십(+보스 난이도)뿐이다 — nowCount/isComplete 같은 값은 표시 시점에
// schedulerCache에서 조회한다(결정 6, 단일 진실 공급원).
export async function seedManualTrackedContent(ocid: string): Promise<void> {
  const [result] = await syncSchedules([ocid])
  if (result?.state == null) {
    throw new Error(`seedManualTrackedContent: ${ocid}의 최신 동기화 결과가 없어 시드할 수 없습니다`)
  }

  const { dailyContents, weeklyContents, bossContents } = result.state

  const contentItems: ManualTrackedItem[] = [...dailyContents, ...weeklyContents]
    .filter((content) => content.isRegistered)
    .map((content) => ({ contentName: content.name, kind: 'content' as const }))

  const bossItems: ManualTrackedItem[] = bossContents
    .filter((boss) => boss.isRegistered)
    .map((boss) => ({ contentName: boss.name, difficulty: boss.difficulty, kind: 'boss' as const }))

  await setManualTrackedContent(ocid, [...contentItems, ...bossItems])
}
