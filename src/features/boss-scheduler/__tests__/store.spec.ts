/**
 * 보스 스케줄러 스토어. 넥슨에서 받은 값은 쿼리 캐시가 들고, 여기는 기기 값(파티 인원 · 수동 추적)과 필터만 든다.
 * 직접 적은 완료는 `manual-completed-query.ts` 의 쿼리라 그쪽 스펙이 본다. 추적 목록은 쿼리 캐시의 `trackedOcids`
 * 열쇠로 준다.
 */
import type { ManualTrackedItem } from '../../../storage/manual-tracked-content'
import type { BossDifficulty } from '../../../types'
import type { BossManageDraft, BossPartyDraft } from '../manage-draft'
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'

jest.mock('../../../storage/boss-party-settings', () => ({
  getBossPartySettings: jest.fn(),
  setBossPartySetting: jest.fn(),
}))
const { getBossPartySettings: getBossPartySettingsMock, setBossPartySetting: setBossPartySettingMock } =
  jest.requireMock('../../../storage/boss-party-settings') as Record<string, jest.Mock>

jest.mock('../../../storage/manual-tracked-content', () => ({
  getManualTrackedContent: jest.fn(),
  setManualTrackedContent: jest.fn(),
}))
const { getManualTrackedContent: getManualTrackedContentMock, setManualTrackedContent: setManualTrackedContentMock } =
  jest.requireMock('../../../storage/manual-tracked-content') as Record<string, jest.Mock>

jest.mock('../../toast/store', () => {
  const showSuccess = jest.fn()
  const showError = jest.fn()
  return { useToastStore: { getState: () => ({ showSuccess, showError }) } }
})
const showSuccessMock = jest.requireMock('../../toast/store').useToastStore.getState().showSuccess as jest.Mock

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

import { useBossSchedulerStore, type BossManageSaveResult } from '../store'

/** 비율을 안 쓰는 파티. 인원만 고치는 테스트가 넘긴다. */
const EVEN_SHARE_COLUMNS = {
  crystalMyShare: null,
  crystalSharesTotal: null,
  splitFeePercent: null,
}

// 보스 표 주간 섹션의 12종(시즌 보스 제외). 12개 한도를 채우는 데 쓴다. 실재하는 이름이어야 주기 · 시즌 판정이 통한다.
const TWELVE_WEEKLY_BOSSES = [
  'zakum',
  'magnus',
  'papulatus',
  'von_bon',
  'pierre',
  'crimson_queen',
  'vellum',
  'lotus',
  'damien',
  'guardian_angel_slime',
  'lucid',
  'will',
]

function trackedBosses(bossNames: string[]): ManualTrackedItem[] {
  return bossNames.map((bossKey) => ({ kind: 'boss' as const, bossKey, difficulty: 'normal' as const }))
}

beforeEach(() => {
  queryClient.clear()
  useBossSchedulerStore.setState({
    partySizes: {},
    partyShares: {},
    manualTrackedByOcid: {},
    partyFilter: 'all',
  })
  mockTrackingMode.mode = 'auto'
  getBossPartySettingsMock.mockReset().mockResolvedValue([])
  setBossPartySettingMock.mockReset().mockResolvedValue(undefined)
  getManualTrackedContentMock.mockReset().mockResolvedValue([])
  setManualTrackedContentMock.mockReset().mockResolvedValue(undefined)
  showSuccessMock.mockClear()
})

describe('loadLocal', () => {
  it('수동 모드면 캐릭터마다 멤버십을 읽어 manualTrackedByOcid 에 채운다', async () => {
    mockTrackingMode.mode = 'manual'
    getManualTrackedContentMock.mockImplementation(async (ocid: string) =>
      ocid === 'ocid-1' ? [{ kind: 'boss', bossKey: 'zakum', difficulty: 'chaos' }] : [],
    )

    await useBossSchedulerStore.getState().loadLocal(['ocid-1', 'ocid-2'])

    expect(useBossSchedulerStore.getState().manualTrackedByOcid).toEqual({
      'ocid-1': [{ kind: 'boss', bossKey: 'zakum', difficulty: 'chaos' }],
      'ocid-2': [],
    })
  })

  it('자동 모드면 멤버십을 읽지 않고 manualTrackedByOcid 를 비운다', async () => {
    useBossSchedulerStore.setState({
      manualTrackedByOcid: { 'ocid-1': [{ kind: 'boss', bossKey: 'zakum', difficulty: 'chaos' }] },
    })

    await useBossSchedulerStore.getState().loadLocal(['ocid-1'])

    expect(getManualTrackedContentMock).not.toHaveBeenCalled()
    expect(useBossSchedulerStore.getState().manualTrackedByOcid).toEqual({})
  })

  // 파티 설정은 스케줄과 독립인 기기 값이라 실패해도 화면을 세우지 않는다.
  it('파티 설정 읽기가 실패해도 던지지 않는다', async () => {
    getBossPartySettingsMock.mockRejectedValue(new Error('sqlite fail'))

    await expect(useBossSchedulerStore.getState().loadLocal(['ocid-1'])).resolves.toBeUndefined()
  })

  it('추적 캐릭터가 없으면 저장소를 읽지 않고 파티 설정을 비운다', async () => {
    useBossSchedulerStore.setState({ partySizes: { 'ocid-1:zakum:chaos': 4 } })

    await useBossSchedulerStore.getState().loadLocal([])

    expect(getBossPartySettingsMock).not.toHaveBeenCalled()
    expect(useBossSchedulerStore.getState().partySizes).toEqual({})
  })
})

describe('reloadLocal', () => {
  it('쿼리 캐시의 추적 목록으로 loadLocal 을 부른다', async () => {
    queryClient.setQueryData(queryKeys.trackedOcids(), ['ocid-1', 'ocid-2'])

    await useBossSchedulerStore.getState().reloadLocal()

    expect(getBossPartySettingsMock).toHaveBeenCalledWith(['ocid-1', 'ocid-2'])
  })

  it('추적 목록을 아직 안 읽었으면 빈 목록으로 읽는다', async () => {
    await useBossSchedulerStore.getState().reloadLocal()

    expect(getBossPartySettingsMock).not.toHaveBeenCalled()
  })
})

describe('loadPartySizes', () => {
  it('추적 캐릭터가 없으면 읽지 않고 인원과 비율을 비운다', async () => {
    useBossSchedulerStore.setState({
      partySizes: { 'ocid-1:zakum:chaos': 4 },
      partyShares: { 'ocid-1:zakum:chaos': EVEN_SHARE_COLUMNS },
    })

    await useBossSchedulerStore.getState().loadPartySizes([])

    expect(getBossPartySettingsMock).not.toHaveBeenCalled()
    expect(useBossSchedulerStore.getState().partySizes).toEqual({})
    expect(useBossSchedulerStore.getState().partyShares).toEqual({})
  })

  // 맵에 키가 없으면 미설정(솔로)이다. 없는 키를 1 로 채우지 않는다. 그 해석은 화면의 몫이다.
  it('`ocid:boss:difficulty` 키로 인원과 비율을 들고, 설정이 없는 보스는 키 자체가 없다', async () => {
    getBossPartySettingsMock.mockResolvedValue([
      {
        ocid: 'ocid-1',
        bossKey: 'zakum',
        difficulty: 'chaos',
        partySize: 4,
        crystalMyShare: 2,
        crystalSharesTotal: 5,
        splitFeePercent: 3,
        splitFeeAuto: true,
        updatedAt: '2026-10-30T00:00:00.000Z',
      },
    ])

    await useBossSchedulerStore.getState().loadPartySizes(['ocid-1'])

    expect(getBossPartySettingsMock).toHaveBeenCalledWith(['ocid-1'])
    expect(useBossSchedulerStore.getState().partySizes).toEqual({ 'ocid-1:zakum:chaos': 4 })
    expect(useBossSchedulerStore.getState().partyShares).toEqual({
      'ocid-1:zakum:chaos': { crystalMyShare: 2, crystalSharesTotal: 5, splitFeePercent: 3, splitFeeAuto: true },
    })
    expect(useBossSchedulerStore.getState().partySizes['ocid-1:lotus:hard']).toBeUndefined()
  })
})

describe('setPartySetting', () => {
  it('저장소에 upsert 하고 인원 · 비율 상태와 토스트를 갱신한다', async () => {
    await useBossSchedulerStore
      .getState()
      .setPartySetting('ocid-1', 'zakum', 'chaos', { partySize: 4, shares: EVEN_SHARE_COLUMNS })

    expect(setBossPartySettingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ocid: 'ocid-1',
        bossKey: 'zakum',
        difficulty: 'chaos',
        partySize: 4,
        crystalMyShare: null,
        updatedAt: expect.any(String),
      }),
    )
    expect(useBossSchedulerStore.getState().partySizes).toEqual({ 'ocid-1:zakum:chaos': 4 })
    expect(useBossSchedulerStore.getState().partyShares).toEqual({ 'ocid-1:zakum:chaos': EVEN_SHARE_COLUMNS })
    expect(showSuccessMock).toHaveBeenCalledWith('파티원 수를 저장했어요')
  })

  it('그 보스의 maxPartySize 를 넘으면 던지고 저장소를 부르지 않는다', async () => {
    // 스우 익스트림은 결정석 표에서 maxPartySize 2 로 예외 지정돼 있다.
    await expect(
      useBossSchedulerStore
        .getState()
        .setPartySetting('ocid-1', 'lotus', 'extreme', { partySize: 3, shares: EVEN_SHARE_COLUMNS }),
    ).rejects.toThrow()

    expect(setBossPartySettingMock).not.toHaveBeenCalled()
    expect(useBossSchedulerStore.getState().partySizes).toEqual({})
  })

  it('1 미만이거나 정수가 아니면 던진다', async () => {
    await expect(
      useBossSchedulerStore
        .getState()
        .setPartySetting('ocid-1', 'zakum', 'chaos', { partySize: 0, shares: EVEN_SHARE_COLUMNS }),
    ).rejects.toThrow()
    await expect(
      useBossSchedulerStore
        .getState()
        .setPartySetting('ocid-1', 'zakum', 'chaos', { partySize: 1.5, shares: EVEN_SHARE_COLUMNS }),
    ).rejects.toThrow()

    expect(setBossPartySettingMock).not.toHaveBeenCalled()
  })
})

describe('saveBossManageDraft', () => {
  const save = (draft: Partial<BossManageDraft>): Promise<BossManageSaveResult> =>
    useBossSchedulerStore.getState().saveBossManageDraft('ocid-1', { tracking: {}, party: {}, ...draft })

  const party = (bossKey: string, difficulty: BossDifficulty, partySize: number): BossPartyDraft => ({
    bossKey,
    difficulty,
    partySize,
    shares: EVEN_SHARE_COLUMNS,
  })

  describe('추적 목록', () => {
    // 지우기와 추가를 따로 저장하면 그 사이에 보스가 목록에 없는 상태가 저장소에 실재했다.
    it('저장소의 지금 배열에 초안을 얹어 한 번 쓴다. 바꾼 보스는 제자리에서 난이도만, 끈 보스는 빠지고, 켠 보스는 끝에 붙는다', async () => {
      getManualTrackedContentMock.mockResolvedValue([
        { kind: 'boss', bossKey: 'lotus', difficulty: 'hard' },
        { contentKey: 'mu_lung_dojo', kind: 'weekly' },
        { kind: 'boss', bossKey: 'zakum', difficulty: 'chaos' },
        { kind: 'boss', bossKey: 'lucid', difficulty: 'normal' },
      ])

      const result = await save({ tracking: { lotus: 'extreme', zakum: null, will: 'hard' } })

      const next = [
        { kind: 'boss', bossKey: 'lotus', difficulty: 'extreme' },
        { contentKey: 'mu_lung_dojo', kind: 'weekly' },
        { kind: 'boss', bossKey: 'lucid', difficulty: 'normal' },
        { kind: 'boss', bossKey: 'will', difficulty: 'hard' },
      ]
      expect(result).toEqual({ status: 'saved' })
      expect(setManualTrackedContentMock).toHaveBeenCalledTimes(1)
      expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', next)
      expect(useBossSchedulerStore.getState().manualTrackedByOcid).toEqual({ 'ocid-1': next })
    })

    it('같은 보스가 두 난이도로 저장돼 있으면 하나로 합친다', async () => {
      getManualTrackedContentMock.mockResolvedValue([
        { kind: 'boss', bossKey: 'lucid', difficulty: 'easy' },
        { kind: 'boss', bossKey: 'lucid', difficulty: 'hard' },
      ])

      await save({ tracking: { lucid: 'normal' } })

      expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
        { kind: 'boss', bossKey: 'lucid', difficulty: 'normal' },
      ])
    })

    // 화면을 연 동안 받기가 다른 기기의 항목을 저장소에 썼다. 스토어 사본이 아니라 저장소를 읽어야 그것을 덮지 않는다.
    it('스토어 사본이 아니라 저장소의 지금 배열에 얹어, 화면을 연 동안 받은 항목을 덮지 않는다', async () => {
      useBossSchedulerStore.setState({ manualTrackedByOcid: { 'ocid-1': [] } })
      getManualTrackedContentMock.mockResolvedValue([{ kind: 'boss', bossKey: 'zakum', difficulty: 'chaos' }])

      await save({ tracking: { lotus: 'hard' } })

      expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
        { kind: 'boss', bossKey: 'zakum', difficulty: 'chaos' },
        { kind: 'boss', bossKey: 'lotus', difficulty: 'hard' },
      ])
    })

    // 자동 모드의 초안에는 파티 설정만 든다. 추적은 게임 등록을 따른다.
    it('추적 초안이 없으면 추적 목록을 읽지도 쓰지도 않는다', async () => {
      await save({ party: { 'ocid-1:zakum:chaos': party('zakum', 'chaos', 3) } })

      expect(getManualTrackedContentMock).not.toHaveBeenCalled()
      expect(setManualTrackedContentMock).not.toHaveBeenCalled()
      expect(setBossPartySettingMock).toHaveBeenCalledTimes(1)
    })
  })

  // 한도 가드의 본체는 스토어다. 화면에서만 막으면 화면을 연 동안 받은 항목으로 늘어난 목록이 그대로 저장된다.
  describe('주간 12개 한도', () => {
    it('초안을 얹어 12개를 넘으면 아무것도 쓰지 않고 limitReached 를 돌려준다', async () => {
      getManualTrackedContentMock.mockResolvedValue(trackedBosses(TWELVE_WEEKLY_BOSSES))

      const result = await save({
        tracking: { gloom: 'normal' },
        party: { 'ocid-1:zakum:normal': party('zakum', 'normal', 2) },
      })

      expect(result).toEqual({ status: 'limitReached' })
      expect(setManualTrackedContentMock).not.toHaveBeenCalled()
      expect(setBossPartySettingMock).not.toHaveBeenCalled()
    })

    it('12개째를 켜는 것은 저장한다', async () => {
      getManualTrackedContentMock.mockResolvedValue(trackedBosses(TWELVE_WEEKLY_BOSSES.slice(0, 11)))

      const result = await save({ tracking: { gloom: 'normal' } })

      expect(result).toEqual({ status: 'saved' })
      expect(setManualTrackedContentMock).toHaveBeenCalled()
    })

    it('한 보스를 끄고 다른 보스를 켜 12개 안이면 저장한다', async () => {
      getManualTrackedContentMock.mockResolvedValue(trackedBosses(TWELVE_WEEKLY_BOSSES))

      const result = await save({ tracking: { [TWELVE_WEEKLY_BOSSES[0]]: null, gloom: 'normal' } })

      expect(result).toEqual({ status: 'saved' })
    })

    // 받기로 이미 넘은 목록이면 줄이거나 난이도만 바꾸는 것까지 막으면 고칠 길이 없다.
    it('이미 12개를 넘었어도 늘리지 않는 저장은 막지 않는다', async () => {
      getManualTrackedContentMock.mockResolvedValue([...trackedBosses(TWELVE_WEEKLY_BOSSES), ...trackedBosses(['gloom'])])

      const result = await save({ tracking: { [TWELVE_WEEKLY_BOSSES[0]]: 'hard' } })

      expect(result).toEqual({ status: 'saved' })
    })

    it.each([
      ['시즌 보스(메이린)', 'meirin', 'normal'],
      ['월간 보스(검은 마법사)', 'black_mage', 'hard'],
    ] as const)('%s 는 한도가 찼어도 켠다. 12 는 주간 한도다', async (_label, bossKey, difficulty) => {
      getManualTrackedContentMock.mockResolvedValue(trackedBosses(TWELVE_WEEKLY_BOSSES))

      const result = await save({ tracking: { [bossKey]: difficulty } })

      expect(result).toEqual({ status: 'saved' })
    })
  })

  describe('파티 설정', () => {
    // 파티 설정은 보스와 난이도에 붙어 있다. 순서가 반대면 추적 목록 쓰기가 실패했을 때 추적하지 않는 난이도에 설정만 생긴다.
    it('추적 목록을 먼저 쓰고 파티 설정을 나중에 쓴다', async () => {
      await save({
        tracking: { lotus: 'hard' },
        party: { 'ocid-1:lotus:hard': party('lotus', 'hard', 2) },
      })

      expect(setManualTrackedContentMock.mock.invocationCallOrder[0]).toBeLessThan(
        setBossPartySettingMock.mock.invocationCallOrder[0],
      )
      expect(useBossSchedulerStore.getState().partySizes).toEqual({ 'ocid-1:lotus:hard': 2 })
    })

    it('추적 목록을 쓰지 못하면 파티 설정을 쓰지 않고 trackingFailed 를 돌려준다', async () => {
      setManualTrackedContentMock.mockRejectedValueOnce(new Error('write failed'))

      const result = await save({
        tracking: { lotus: 'hard' },
        party: { 'ocid-1:lotus:hard': party('lotus', 'hard', 2) },
      })

      expect(result).toEqual({ status: 'trackingFailed' })
      expect(setBossPartySettingMock).not.toHaveBeenCalled()
      expect(useBossSchedulerStore.getState().manualTrackedByOcid).toEqual({})
    })

    // 쓴 몫은 화면이 초안에서 뺀다. 다시 누르면 남은 것만 쓴다.
    it('파티 설정을 쓰지 못하면 그 앞까지 쓴 키를 돌려주고, 쓴 것만 스토어에 든다', async () => {
      setBossPartySettingMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('sqlite fail'))

      const result = await save({
        tracking: { lotus: 'hard' },
        party: {
          'ocid-1:zakum:chaos': party('zakum', 'chaos', 3),
          'ocid-1:lotus:hard': party('lotus', 'hard', 2),
        },
      })

      expect(result).toEqual({ status: 'partyFailed', savedPartyKeys: ['ocid-1:zakum:chaos'] })
      expect(useBossSchedulerStore.getState().manualTrackedByOcid['ocid-1']).toEqual([
        { kind: 'boss', bossKey: 'lotus', difficulty: 'hard' },
      ])
      expect(useBossSchedulerStore.getState().partySizes).toEqual({ 'ocid-1:zakum:chaos': 3 })
    })

    // 상한은 보스 표에 있다. 스우 익스트림은 2인이다.
    it('인원이 그 난이도의 상한을 넘으면 쓰지 않고 partyFailed 를 돌려준다', async () => {
      const result = await save({ party: { 'ocid-1:lotus:extreme': party('lotus', 'extreme', 3) } })

      expect(result).toEqual({ status: 'partyFailed', savedPartyKeys: [] })
      expect(setBossPartySettingMock).not.toHaveBeenCalled()
    })

    // 고친 보스마다 토스트가 쌓인다. 저장 뒤에는 `저장` 이 꺼지는 것으로 끝낸다.
    it('`파티원 수를 저장했어요` 를 띄우지 않는다', async () => {
      await save({ party: { 'ocid-1:zakum:chaos': party('zakum', 'chaos', 3) } })

      expect(showSuccessMock).not.toHaveBeenCalled()
    })
  })
})

// 난이도 교체는 remove 뒤 add 의 2단계가 아니라 단일 액션이다. 2단계는 커밋이 2회라 첫 커밋 직후 그 보스가 목록에
// 없는 상태가 저장소에 실재했고, 두 번째가 실패하면 보스가 통째로 사라졌다.
describe('setManualBossDifficulty', () => {
  it('쓰기 1회로 난이도를 교체한다. 보스가 빠진 중간 상태를 저장하지 않는다', async () => {
    getManualTrackedContentMock.mockResolvedValue([
      { kind: 'boss', bossKey: 'lotus', difficulty: 'hard' },
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
    ])

    await useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', 'lotus', 'extreme')

    expect(setManualTrackedContentMock).toHaveBeenCalledTimes(1)
    expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
      { kind: 'boss', bossKey: 'lotus', difficulty: 'extreme' },
      { contentKey: 'mu_lung_dojo', kind: 'weekly' },
    ])
  })

  it('제자리에서 교체해 배열 순서를 유지한다 (끝으로 밀지 않는다)', async () => {
    getManualTrackedContentMock.mockResolvedValue([
      { kind: 'boss', bossKey: 'lotus', difficulty: 'hard' },
      { kind: 'boss', bossKey: 'lucid', difficulty: 'normal' },
    ])

    await useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', 'lotus', 'extreme')

    const saved = setManualTrackedContentMock.mock.calls[0][1] as ManualTrackedItem[]
    expect(saved.map((item) => (item.kind === 'boss' ? item.bossKey : item.contentKey))).toEqual(['lotus', 'lucid'])
  })

  it('저장이 실패하면 스토어 상태를 바꾸지 않는다 (롤백이 필요 없다)', async () => {
    getManualTrackedContentMock.mockResolvedValue([{ kind: 'boss', bossKey: 'lotus', difficulty: 'hard' }])
    setManualTrackedContentMock.mockRejectedValueOnce(new Error('write failed'))

    await expect(
      useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', 'lotus', 'extreme'),
    ).rejects.toThrow()

    expect(useBossSchedulerStore.getState().manualTrackedByOcid['ocid-1']).toBeUndefined()
  })

  it('같은 보스가 두 난이도로 저장돼 있으면 하나로 수렴시킨다', async () => {
    getManualTrackedContentMock.mockResolvedValue([
      { kind: 'boss', bossKey: 'lotus', difficulty: 'hard' },
      { kind: 'boss', bossKey: 'lotus', difficulty: 'normal' },
    ])

    await useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', 'lotus', 'extreme')

    expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
      { kind: 'boss', bossKey: 'lotus', difficulty: 'extreme' },
    ])
  })

  it('추적 중이 아닌 보스면 아무것도 쓰지 않는다', async () => {
    getManualTrackedContentMock.mockResolvedValue([{ kind: 'boss', bossKey: 'lucid', difficulty: 'normal' }])

    await useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', 'lotus', 'extreme')

    expect(setManualTrackedContentMock).not.toHaveBeenCalled()
  })

  it('같은 key 의 컨텐츠(kind 가 boss 가 아닌 항목)는 건드리지 않는다', async () => {
    getManualTrackedContentMock.mockResolvedValue([
      { contentKey: 'lotus', kind: 'weekly' },
      { kind: 'boss', bossKey: 'lotus', difficulty: 'hard' },
    ])

    await useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', 'lotus', 'extreme')

    expect(setManualTrackedContentMock).toHaveBeenCalledWith('ocid-1', [
      { contentKey: 'lotus', kind: 'weekly' },
      { kind: 'boss', bossKey: 'lotus', difficulty: 'extreme' },
    ])
  })

  // 개수가 안 변하므로 주간 12개 한도에 원리적으로 걸리지 않는다.
  it('주간 12개가 찬 상태에서도 난이도를 바꿀 수 있다', async () => {
    getManualTrackedContentMock.mockResolvedValue(trackedBosses(TWELVE_WEEKLY_BOSSES))

    await useBossSchedulerStore.getState().setManualBossDifficulty('ocid-1', TWELVE_WEEKLY_BOSSES[0], 'hard')

    expect(setManualTrackedContentMock).toHaveBeenCalledTimes(1)
    const saved = setManualTrackedContentMock.mock.calls[0][1] as ManualTrackedItem[]
    expect(saved).toHaveLength(12)
    expect(saved[0]).toEqual({ kind: 'boss', bossKey: TWELVE_WEEKLY_BOSSES[0], difficulty: 'hard' })
  })
})

// 필터는 이미 받아 둔 데이터를 갈라 보여줄 뿐이다. 바꿔도 회차를 받거나 저장소를 읽지 않는다.
describe('setPartyFilter', () => {
  it('필터를 바꿔도 회차를 받거나 저장소를 읽지 않는다', () => {
    useBossSchedulerStore.getState().setPartyFilter('party')

    expect(useBossSchedulerStore.getState().partyFilter).toBe('party')
    expect(queryClient.getQueryCache().findAll()).toHaveLength(0)
    expect(getBossPartySettingsMock).not.toHaveBeenCalled()
  })
})
