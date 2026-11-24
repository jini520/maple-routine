/**
 * 컨텐츠 스케줄러 스토어. 넥슨에서 받은 값은 쿼리 캐시가 들고, 여기는 기기 값(수동 추적)과 탭만 든다.
 * 추적 목록은 쿼리 캐시의 `trackedOcids` 열쇠로 준다.
 */
import type { CachedCharacterBasicEntry } from '../../../storage/character-basic-cache'
import type { ContentManageDraft } from '../manage-draft'
import type { CharacterBasicProfile } from '../../../types'
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'

jest.mock('../../../storage/manual-tracked-content', () => ({
  getManualTrackedContent: jest.fn(),
  setManualTrackedContent: jest.fn(),
}))
const { getManualTrackedContent: getManualTrackedContentMock, setManualTrackedContent: setManualTrackedContentMock } =
  jest.requireMock('../../../storage/manual-tracked-content') as Record<string, jest.Mock>

// 팩토리가 모듈 평가보다 먼저 불릴 수 있어(스토어를 import 하는 순간) `var` 로 올리고 읽는 자리에서 채운다.
var mockTrackingMode: { mode: 'auto' | 'manual' } = { mode: 'auto' }
jest.mock('../../tracking-mode/store', () => ({
  useTrackingModeStore: {
    getState: () => {
      mockTrackingMode = mockTrackingMode ?? { mode: 'auto' }
      return { mode: mockTrackingMode.mode }
    },
  },
}))

import { useContentSchedulerStore } from '../store'

function basicEntry(overrides: Partial<CharacterBasicProfile> = {}): CachedCharacterBasicEntry {
  return {
    profile: { name: '캐릭터', level: 200, imageUrl: '', accessFlag: true, ...overrides },
    cachedAt: '2026-10-30T00:00:00.000Z',
  }
}

beforeEach(() => {
  queryClient.clear()
  useContentSchedulerStore.setState({ manualTrackedByOcid: {}, activeTab: 'daily' })
  mockTrackingMode.mode = 'auto'
  getManualTrackedContentMock.mockReset().mockResolvedValue([])
  setManualTrackedContentMock.mockReset().mockResolvedValue(undefined)
})

describe('loadLocal', () => {
  it('수동 모드면 추적 캐릭터마다 멤버십을 읽어 manualTrackedByOcid 에 채운다', async () => {
    mockTrackingMode.mode = 'manual'
    getManualTrackedContentMock.mockImplementation(async (ocid: string) =>
      ocid === 'ocid-1' ? [{ contentKey: 'monster_park', kind: 'daily' }] : [],
    )

    await useContentSchedulerStore.getState().loadLocal(['ocid-1', 'ocid-2'])

    expect(getManualTrackedContentMock).toHaveBeenCalledWith('ocid-1')
    expect(getManualTrackedContentMock).toHaveBeenCalledWith('ocid-2')
    expect(useContentSchedulerStore.getState().manualTrackedByOcid).toEqual({
      'ocid-1': [{ contentKey: 'monster_park', kind: 'daily' }],
      'ocid-2': [],
    })
  })

  // 자동 모드는 등록 여부로 목록을 정한다. 수동에서 자동으로 바꾼 뒤 옛 멤버십이 남으면 화면이 그것을 다시 읽는다.
  it('자동 모드면 저장소를 읽지 않고 manualTrackedByOcid 를 비운다', async () => {
    useContentSchedulerStore.setState({
      manualTrackedByOcid: { 'ocid-1': [{ contentKey: 'monster_park', kind: 'daily' }] },
    })

    await useContentSchedulerStore.getState().loadLocal(['ocid-1'])

    expect(getManualTrackedContentMock).not.toHaveBeenCalled()
    expect(useContentSchedulerStore.getState().manualTrackedByOcid).toEqual({})
  })

  it('추적 목록에서 빠진 캐릭터의 멤버십은 남기지 않는다', async () => {
    mockTrackingMode.mode = 'manual'
    useContentSchedulerStore.setState({
      manualTrackedByOcid: { 'ocid-2': [{ contentKey: 'monster_park', kind: 'daily' }] },
    })

    await useContentSchedulerStore.getState().loadLocal(['ocid-1'])

    expect(Object.keys(useContentSchedulerStore.getState().manualTrackedByOcid)).toEqual(['ocid-1'])
  })
})

describe('reloadLocal', () => {
  it('쿼리 캐시의 추적 목록으로 loadLocal 을 부른다', async () => {
    mockTrackingMode.mode = 'manual'
    queryClient.setQueryData(queryKeys.trackedOcids(), ['ocid-1', 'ocid-2'])

    await useContentSchedulerStore.getState().reloadLocal()

    expect(getManualTrackedContentMock.mock.calls.map(([ocid]) => ocid)).toEqual(['ocid-1', 'ocid-2'])
  })

  it('추적 목록을 아직 안 읽었으면 아무 캐릭터도 읽지 않는다', async () => {
    mockTrackingMode.mode = 'manual'

    await useContentSchedulerStore.getState().reloadLocal()

    expect(getManualTrackedContentMock).not.toHaveBeenCalled()
    expect(useContentSchedulerStore.getState().manualTrackedByOcid).toEqual({})
  })
})

describe('saveManualContentDraft', () => {
  const save = (draft: Partial<ContentManageDraft>): Promise<void> =>
    useContentSchedulerStore.getState().saveManualContentDraft('ocid-1', { daily: {}, weekly: {}, ...draft })

  // 최대 횟수는 읽는 곳이 없어 저장하지 않는다. 카드는 넥슨이 준 값이나 컨텐츠 표의 값을 쓴다.
  it('저장소의 지금 배열에 초안을 얹어 한 번 쓴다. 끈 항목만 빠지고 켠 항목은 kind 와 함께 끝에 붙는다', async () => {
    getManualTrackedContentMock.mockResolvedValue([
      { contentKey: 'monster_park', kind: 'daily' },
      { kind: 'boss', bossKey: 'zakum', difficulty: 'chaos' },
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
    ])

    await save({ daily: { monster_park: false, daily_quest_road_of_vanishing: true }, weekly: { epic_dungeon_angler_company: true } })

    const next = [
      { kind: 'boss', bossKey: 'zakum', difficulty: 'chaos' },
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
      { contentKey: 'daily_quest_road_of_vanishing', kind: 'daily' },
      { contentKey: 'epic_dungeon_angler_company', kind: 'weekly' },
    ]
    expect(setManualTrackedContentMock).toHaveBeenCalledTimes(1)
    expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', next)
    expect(useContentSchedulerStore.getState().manualTrackedByOcid).toEqual({ 'ocid-1': next })
  })

  // 같은 key 라도 일간과 주간은 다른 항목이다. 이미 있는 항목을 켜도 겹치지 않는다.
  it('이미 추적 중인 항목을 켜도 겹쳐 넣지 않고, 다른 kind 의 같은 key 는 건드리지 않는다', async () => {
    getManualTrackedContentMock.mockResolvedValue([{ contentKey: 'monster_park', kind: 'daily' }])

    await save({ daily: { monster_park: true }, weekly: { monster_park: false } })

    expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [{ contentKey: 'monster_park', kind: 'daily' }])
  })

  // 화면을 연 동안 받기가 다른 기기의 항목을 저장소에 썼다. 스토어 사본이 아니라 저장소를 읽어야 그것을 덮지 않는다.
  it('스토어 사본이 아니라 저장소의 지금 배열에 얹어, 화면을 연 동안 받은 항목을 덮지 않는다', async () => {
    useContentSchedulerStore.setState({ manualTrackedByOcid: { 'ocid-1': [] } })
    getManualTrackedContentMock.mockResolvedValue([{ contentKey: 'mu_lung_dojo', kind: 'weekly' }])

    await save({ daily: { monster_park: true } })

    expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
      { contentKey: 'monster_park', kind: 'daily' },
    ])
  })

  it('저장이 실패하면 던지고 스토어 상태를 바꾸지 않는다', async () => {
    setManualTrackedContentMock.mockRejectedValueOnce(new Error('write failed'))

    await expect(save({ daily: { monster_park: true } })).rejects.toThrow()

    expect(useContentSchedulerStore.getState().manualTrackedByOcid).toEqual({})
  })

  // 가드의 본체는 스토어다. 화면에서만 막으면 다른 호출 경로가 샌다. 길드 가입 여부는 쿼리 캐시의 기본 정보에서 읽는다.
  describe('길드 잠금', () => {
    it('기본 정보의 guildName 이 null(미가입)이면 길드 콘텐츠를 새로 켜지 않고 나머지만 쓴다', async () => {
      queryClient.setQueryData(queryKeys.characterBasic('ocid-1'), basicEntry({ guildName: null }))

      await save({ weekly: { guild_underground_waterway: true, mu_lung_dojo: true } })

      expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [{ contentKey: 'mu_lung_dojo', kind: 'weekly' }])
    })

    // 길드를 나가도 끌 수 있어야 한다.
    it('미가입이어도 이미 추적 중인 길드 콘텐츠는 끌 수 있다', async () => {
      queryClient.setQueryData(queryKeys.characterBasic('ocid-1'), basicEntry({ guildName: null }))
      getManualTrackedContentMock.mockResolvedValue([{ contentKey: 'guild_underground_waterway', kind: 'weekly' }])

      await save({ weekly: { guild_underground_waterway: false } })

      expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [])
    })

    it('기본 정보가 캐시에 없으면(길드를 모름) 길드 콘텐츠를 켠다', async () => {
      await save({ weekly: { guild_underground_waterway: true } })

      expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
        { contentKey: 'guild_underground_waterway', kind: 'weekly' },
      ])
    })

    it('기본 정보에 guildName 이 undefined 여도(길드를 모름) 길드 콘텐츠를 켠다', async () => {
      queryClient.setQueryData(queryKeys.characterBasic('ocid-1'), basicEntry({ guildName: undefined }))

      await save({ weekly: { guild_underground_waterway: true } })

      expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
        { contentKey: 'guild_underground_waterway', kind: 'weekly' },
      ])
    })
  })
})

// 탭은 이미 받아 둔 데이터를 갈라 보여줄 뿐이다. 바꿔도 회차를 받거나 저장소를 읽지 않는다.
describe('setActiveTab', () => {
  it('탭을 바꿔도 회차를 받거나 저장소를 읽지 않는다', () => {
    useContentSchedulerStore.getState().setActiveTab('weekly')

    expect(useContentSchedulerStore.getState().activeTab).toBe('weekly')
    expect(queryClient.getQueryCache().findAll()).toHaveLength(0)
    expect(getManualTrackedContentMock).not.toHaveBeenCalled()
  })
})
