// 보스 추가 단계가 처음 여는 캐릭터. 대표 캐릭터이고, 마지막으로 고른 캐릭터가 아니다(정정 28).
import { renderHook } from '@testing-library/react-native'

import { useBossSchedulerStore, type BossCharacterView } from '../../../features/boss-scheduler/store'
import { useCharacterSelectionStore } from '../../../features/character-selection/store'
import { useBossPicker } from '../useBossPicker'

function 캐릭터(ocid: string, name: string): BossCharacterView {
  return {
    ocid,
    characterName: name,
    weeklyBosses: [],
    monthlyBosses: [],
    weeklyBossClearCount: null,
    weeklyBossClearLimitCount: null,
    isStale: false,
    syncedAt: null,
    error: null,
  }
}

function 추적(ocids: string[]): void {
  useBossSchedulerStore.setState({
    characters: ocids.map((ocid) => 캐릭터(ocid, ocid)),
    trackedOcids: ocids,
  })
}

describe('useBossPicker: 처음 고른 캐릭터', () => {
  // 앞 케이스가 둔 값을 물려받지 않는다. 스토어는 파일 안에서 살아남는다.
  beforeEach(() => {
    useBossSchedulerStore.setState({ characters: [], trackedOcids: null })
    useCharacterSelectionStore.setState({ representativeOcid: null, selectedOcid: null })
  })

  it('대표 캐릭터로 연다', async () => {
    추적(['ocid-1', 'ocid-2', 'ocid-3'])
    // 마지막으로 고른 캐릭터를 따로 둔다. 둘이 갈릴 때 어느 쪽을 보는지가 이 테스트의 전부다.
    useCharacterSelectionStore.setState({ representativeOcid: 'ocid-3', selectedOcid: 'ocid-2' })

    const { result } = await renderHook(() => useBossPicker())

    expect(result.current.ocid).toBe('ocid-3')
  })

  it('대표가 미지정이면 추적 순서의 첫 캐릭터로 연다', async () => {
    추적(['ocid-1', 'ocid-2'])
    useCharacterSelectionStore.setState({ representativeOcid: null, selectedOcid: 'ocid-2' })

    const { result } = await renderHook(() => useBossPicker())

    expect(result.current.ocid).toBe('ocid-1')
  })

  // 대표를 추적에서 뺐을 수 있다. 그때도 빈 드롭다운이 아니라 첫 캐릭터가 선다.
  it('대표가 추적 목록에 없으면 추적 순서의 첫 캐릭터로 연다', async () => {
    추적(['ocid-1', 'ocid-2'])
    useCharacterSelectionStore.setState({ representativeOcid: 'ocid-9', selectedOcid: null })

    const { result } = await renderHook(() => useBossPicker())

    expect(result.current.ocid).toBe('ocid-1')
  })
})
