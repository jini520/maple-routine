/**
 * 추적 캐릭터 목록을 저장하는 한 벌. 캐릭터 관리 · 월드 이전 안내가 부른다.
 *
 * 전에는 컨텐츠 · 보스 스토어가 같은 일을 각자 들고 있었고, 월드 이전 안내는 한쪽만 불러 보스 탭이 옛 목록으로 남았다.
 * 저장은 캐시의 추적 목록을 덮고, 그것을 보는 화면이 전부 함께 바뀐다.
 */
import { setTrackedCharacterOcids } from '../../storage/character-selection'
import { seedRememberedLevels } from '../cashbook/remembered-levels'
import { askNotificationPermissionOnce } from '../notice/permission-gate'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import { useToastStore } from '../toast/store'
import { seedManualTrackedContent } from '../tracking-mode/seed'
import { useTrackingModeStore } from '../tracking-mode/store'
import { toScheduleSyncError } from './errors'
import { formatScheduleSyncError } from './format'
import { readTrackedOcids, syncAddedCharacters } from './schedule-query'

export async function saveTrackedCharacters(
  ocids: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  const previous = (await readTrackedOcids()) ?? []
  try {
    await setTrackedCharacterOcids(ocids)
  } catch {
    useToastStore.getState().showError('저장하지 못했습니다')
    return
  }

  // 캐릭터를 고른 직후가 알림 권한을 묻는 단 한 번의 자리다. 두 번째부터는 스스로 물러난다.
  // `await` 하지 않는 이유는 이 흐름이 캐릭터 저장이고 알림은 곁가지라서다. 팝업을 기다리느라
  // 아래 조회가 멈추면 사용자는 저장이 느린 것으로 읽는다.
  void askNotificationPermissionOnce()

  // 저장 시점에는 새로 추가된 캐릭터만 조회한다. 유지되는 캐릭터는 이미 든 값을 그대로 쓰고,
  // 제거만 했거나 아무것도 안 바뀌었으면 조회 자체를 하지 않는다.
  const added = ocids.filter((ocid) => !previous.includes(ocid))
  // 새로 추적한 캐릭터의 심볼 · 헥사 레벨을 기억해 둔다. 가계부 폼의 곁가지라 저장을 기다리게 하지 않는다.
  void seedRememberedLevels(added)

  // 수동 모드에서 새로 추적 목록에 추가된 캐릭터만 개별 시드한다. 목록을 캐시에 올리기 **전**이다.
  // 올리면 화면이 그 순간 멤버십을 읽는데, 시드 전이면 빈 멤버십이 선다.
  if (added.length > 0 && useTrackingModeStore.getState().mode === 'manual') {
    await seedManualTrackedContent(added)
  }

  queryClient.setQueryData(queryKeys.trackedOcids(), ocids)

  if (added.length > 0) {
    try {
      await syncAddedCharacters(added, onProgress)
    } catch (error) {
      // 회차 자체가 던지는 실패(키 없음 등). 캐릭터마다의 실패는 결과에 실려 화면이 말한다.
      useToastStore.getState().showError(formatScheduleSyncError(toScheduleSyncError(error)))
      return
    }
  }

  useToastStore.getState().showSuccess('캐릭터 정보를 모두 불러왔어요')
}
