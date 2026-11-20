// 새로 로그인하면 캐릭터를 반드시 새로 고른다. 캐릭터 설정 화면은 쿼리 캐시의 추적 목록에서 시작하므로, 저장소만 비우면
// 앞 로그인의 목록이 한 번 그려진다.
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import {
  getLastSelectedCharacter,
  getRepresentativeCharacter,
  getTrackedCharacterOcids,
  setCharacterSelection,
  setLastSelectedCharacter,
} from '../../../storage/character-selection'
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import { forgetTrackedSelection } from '../forget'
import { useCharacterSelectionStore } from '../store'

beforeEach(async () => {
  installFakePreferences()
  queryClient.clear()
  await setCharacterSelection(['o1', 'o2'], 'o2')
  await setLastSelectedCharacter('o1')
  queryClient.setQueryData(queryKeys.trackedOcids(), ['o1', 'o2'])
  useCharacterSelectionStore.setState({ selectedOcid: 'o1', representativeOcid: 'o2', isRepresentativeHydrated: true })
})

it('저장소 · 쿼리 캐시 · 메모리의 추적 목록, 대표, 마지막에 고른 캐릭터를 모두 비운다', async () => {
  await forgetTrackedSelection()

  expect(await getTrackedCharacterOcids()).toBeNull()
  expect(await getRepresentativeCharacter()).toBeNull()
  expect(await getLastSelectedCharacter()).toBeNull()
  expect(queryClient.getQueryData(queryKeys.trackedOcids())).toBeNull()
  expect(useCharacterSelectionStore.getState()).toMatchObject({ selectedOcid: null, representativeOcid: null })
})

// 비우는 동안 저장소를 읽던 조회가 늦게 끝나면 앞 목록을 캐시에 다시 넣는다.
it('비우기 전에 시작한 추적 목록 조회가 늦게 끝나도 앞 목록이 캐시에 돌아오지 않는다', async () => {
  let finish: (ocids: string[]) => void = () => undefined
  void queryClient.fetchQuery({
    queryKey: queryKeys.trackedOcids(),
    queryFn: () => new Promise<string[]>((resolve) => (finish = resolve)),
    staleTime: 0,
  }).catch(() => undefined)

  await forgetTrackedSelection()
  finish(['o1', 'o2'])
  await Promise.resolve()

  expect(queryClient.getQueryData(queryKeys.trackedOcids())).toBeNull()
})
