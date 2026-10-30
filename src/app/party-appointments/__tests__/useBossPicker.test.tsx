// 보스 추가 단계가 처음 여는 캐릭터. 대표 캐릭터이고, 마지막으로 고른 캐릭터가 아니다(정정 28).
import { renderHook } from '@testing-library/react-native'

import { useBossSchedule } from '../../../features/boss-scheduler/use-boss-schedule'
import type { BossCharacterView } from '../../../features/boss-scheduler/views'
import { useCharacterSelectionStore } from '../../../features/character-selection/store'
import { useBossPicker } from '../useBossPicker'

// 캐릭터는 쿼리 캐시에서 온다. 훅 하나만 갈아 끼우고 보스 스토어(파티 인원 · 수동 추적)는 실물이다.
jest.mock('../../../features/boss-scheduler/use-boss-schedule', () => ({ useBossSchedule: jest.fn() }))

const mockedUseBossSchedule = jest.mocked(useBossSchedule)

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
  mockedUseBossSchedule.mockReturnValue({
    status: 'loaded',
    characters: ocids.map((ocid) => 캐릭터(ocid, ocid)),
    error: null,
    trackedOcids: ocids,
    refresh: jest.fn(),
  })
}

describe('useBossPicker: 처음 고른 캐릭터', () => {
  // 앞 케이스가 둔 값을 물려받지 않는다. 선택 스토어는 파일 안에서 살아남는다.
  beforeEach(() => {
    추적([])
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
