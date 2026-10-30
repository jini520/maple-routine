/**
 * 컨텐츠 스케줄러 스토어. 넥슨에서 받은 값은 쿼리 캐시가 들고, 여기는 기기 값(수동 추적)과 탭만 든다.
 * 추적 목록은 쿼리 캐시의 `trackedOcids` 열쇠로 준다.
 */
import type { CachedCharacterBasicEntry } from '../../../storage/character-basic-cache'
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

describe('addManualContent', () => {
  it('저장소에 멤버십(kind 포함)과 템플릿 max_count 를 저장하고 상태를 갱신한다', async () => {
    const result = await useContentSchedulerStore.getState().addManualContent('ocid-1', 'monster_park', 'daily')

    // monster_park 는 컨텐츠 표 daily 에 max_count 14 로 있다.
    expect(result).toBe('added')
    expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
      { contentKey: 'monster_park', kind: 'daily', maxCount: 14 },
    ])
    expect(useContentSchedulerStore.getState().manualTrackedByOcid).toEqual({
      'ocid-1': [{ contentKey: 'monster_park', kind: 'daily', maxCount: 14 }],
    })
  })

  it('이미 추적 중인 콘텐츠면 쓰지 않고 duplicate 를 돌려준다', async () => {
    getManualTrackedContentMock.mockResolvedValue([{ contentKey: 'monster_park', kind: 'daily', maxCount: 14 }])

    const result = await useContentSchedulerStore.getState().addManualContent('ocid-1', 'monster_park', 'daily')

    expect(result).toBe('duplicate')
    expect(setManualTrackedContentMock).not.toHaveBeenCalled()
  })

  // 가드의 본체는 스토어다. 화면에서만 막으면 다른 호출 경로가 샌다. 길드 가입 여부는 쿼리 캐시의 기본 정보에서 읽는다.
  it('기본 정보의 guildName 이 null(미가입)이면 길드 콘텐츠를 거부한다', async () => {
    queryClient.setQueryData(queryKeys.characterBasic('ocid-1'), basicEntry({ guildName: null }))

    const result = await useContentSchedulerStore
      .getState()
      .addManualContent('ocid-1', 'guild_underground_waterway', 'weekly')

    expect(result).toBe('guildRequired')
    expect(setManualTrackedContentMock).not.toHaveBeenCalled()
  })

  it('기본 정보가 캐시에 없으면(길드를 모름) 길드 콘텐츠를 통과시킨다', async () => {
    const result = await useContentSchedulerStore
      .getState()
      .addManualContent('ocid-1', 'guild_underground_waterway', 'weekly')

    expect(result).toBe('added')
    expect(setManualTrackedContentMock).toHaveBeenCalled()
  })

  it('기본 정보에 guildName 이 undefined 여도(길드를 모름) 길드 콘텐츠를 통과시킨다', async () => {
    queryClient.setQueryData(queryKeys.characterBasic('ocid-1'), basicEntry({ guildName: undefined }))

    const result = await useContentSchedulerStore
      .getState()
      .addManualContent('ocid-1', 'guild_underground_waterway', 'weekly')

    expect(result).toBe('added')
  })

  it('길드 미가입이어도 길드 외 콘텐츠는 통과시킨다', async () => {
    queryClient.setQueryData(queryKeys.characterBasic('ocid-1'), basicEntry({ guildName: null }))

    const result = await useContentSchedulerStore.getState().addManualContent('ocid-1', 'mu_lung_dojo', 'weekly')

    expect(result).toBe('added')
  })
})

describe('removeManualContent', () => {
  it('해당 (kind, key) 항목만 제거하고 다른 kind(boss) · 다른 key 는 보존한다', async () => {
    getManualTrackedContentMock.mockResolvedValue([
      { contentKey: 'monster_park', kind: 'daily', maxCount: 14 },
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
      { kind: 'boss', bossKey: 'zakum', difficulty: 'chaos' },
    ])

    await useContentSchedulerStore.getState().removeManualContent('ocid-1', 'monster_park', 'daily')

    const remaining = [
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
      { kind: 'boss', bossKey: 'zakum', difficulty: 'chaos' },
    ]
    expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', remaining)
    expect(useContentSchedulerStore.getState().manualTrackedByOcid).toEqual({ 'ocid-1': remaining })
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
