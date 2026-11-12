/**
 * 추적 캐릭터 일부를 빼는 한 벌. 계정 관리의 부계정 삭제와 무효가 된 부계정 키가 부른다.
 *
 * 하나도 남지 않으면 앱을 쓸 수 없어 진입 단계를 다시 판정한다. 그 판정이 캐릭터 설정으로 보낸다.
 */
import { getTrackedCharacterOcids, setTrackedCharacterOcids } from '../../storage/character-selection'
import { useAppEntryStore } from '../app-entry/store'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import { useCharacterSelectionStore } from './store'

export async function untrackCharacters(ocids: ReadonlySet<string>): Promise<void> {
  const tracked = await getTrackedCharacterOcids()
  if (tracked === null) return
  const remaining = tracked.filter((ocid) => !ocids.has(ocid))
  if (remaining.length === tracked.length) return
  await setTrackedCharacterOcids(remaining)
  queryClient.setQueryData(queryKeys.trackedOcids(), remaining)
  await useCharacterSelectionStore.getState().reloadRepresentative()
  if (remaining.length === 0) await useAppEntryStore.getState().resolveFromStorage()
}
