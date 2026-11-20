/**
 * 새로 로그인할 때 앞 로그인의 추적 목록 · 대표 · 마지막에 고른 캐릭터를 비우는 함수. 로그인을 저장하기 전에 부른다.
 *
 * 캐릭터 설정 화면은 쿼리 캐시의 추적 목록에서 시작한다. 그래서 저장소만 비우면 앞 목록이 한 번 그려진다. 저장소를 먼저
 * 비운다. 캐시를 먼저 비우면 그 사이에 저장소를 다시 읽은 조회가 앞 목록을 캐시에 되살린다.
 */
import { clearTrackedCharacterOcids } from '../../storage/character-selection'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import { useCharacterSelectionStore } from './store'

export async function forgetTrackedSelection(): Promise<void> {
  await clearTrackedCharacterOcids()
  await useCharacterSelectionStore.getState().forget()
  await queryClient.cancelQueries({ queryKey: queryKeys.trackedOcids() })
  queryClient.setQueryData(queryKeys.trackedOcids(), null)
}
