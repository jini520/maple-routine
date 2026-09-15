import { syncSchedules, type CharacterScheduleSync } from '../../schedule-sync/schedule-sync'
import { setManualTrackedContent } from '../../../storage/manual-tracked-content'
import { findContent } from '../../../lib/scheduler/contents'
import type {
  BossContent,
  BossDifficulty,
  DailyContent,
  SchedulerCharacterState,
  WeeklyContent,
} from '../../../types'
import { seedManualTrackedContent } from '../seed'

jest.mock('../../schedule-sync/schedule-sync', () => ({
  syncSchedules: jest.fn(),
}))

jest.mock('../../../storage/manual-tracked-content', () => ({
  setManualTrackedContent: jest.fn(),
}))

const OCID = 'ocid-1'

/** 컨텐츠 표에 없는 컨텐츠는 `contentKey` 가 `null` 이고 API 이름을 따로 넘긴다. */
function buildDaily(
  contentKey: string | null,
  isRegistered: boolean,
  apiName = findContent(contentKey)!.content_name,
): DailyContent {
  return { contentKey, apiName, kind: 'contents', isRegistered, nowCount: 7, maxCount: 14, questState: null }
}

function buildWeekly(
  contentKey: string | null,
  isRegistered: boolean,
  apiName = findContent(contentKey)!.content_name,
): WeeklyContent {
  return { contentKey, apiName, kind: 'contents', isRegistered, nowCount: 1, maxCount: 5, questState: null }
}

/** `bossKey` 는 스케줄 응답을 앱 상태로 바꾸는 자리가 채운 값이다. 보스 표에 없는 보스는 `null` 이다. */
function buildBoss(apiName: string, bossKey: string | null, difficulty: BossDifficulty, isRegistered: boolean): BossContent {
  return { bossKey, apiName, difficulty, cycle: 'weekly', isRegistered, isComplete: false, ownComplete: false }
}

function buildState(overrides: Partial<SchedulerCharacterState> = {}): SchedulerCharacterState {
  return {
    asOf: '2026-07-23T00:00+09:00',
    characterName: '낟낟',
    world: '엘리시움',
    worldKey: 'elysium',
    level: 293,
    jobClass: '렌',
    dailyContents: [],
    weeklyContents: [],
    bossContents: [],
    isDailyStale: false,
    isWeeklyStale: false,
    isWeeklyBossStale: false,
    isMonthlyBossStale: false,
    ...overrides,
  }
}

function buildSyncResult(state: SchedulerCharacterState | null, ocid = OCID): CharacterScheduleSync {
  return {
    ocid,
    characterName: '낟낟',
    state,
    syncedAt: state === null ? null : '2026-07-23T12:00:00.000Z',
    isStale: state === null,
    error: state === null ? { kind: 'network' } : null,
  }
}

beforeEach(() => {
  jest.mocked(syncSchedules).mockReset()
  jest.mocked(setManualTrackedContent).mockReset()
  jest.mocked(setManualTrackedContent).mockResolvedValue(undefined)
})

describe('seedManualTrackedContent', () => {
  it('최신 동기화 결과에서 등록된(isRegistered) 항목만 일간/주간 구분과 함께 저장한다', async () => {
    jest.mocked(syncSchedules).mockResolvedValue([
      buildSyncResult(
        buildState({
          dailyContents: [
            buildDaily('monster_park', true),
            buildDaily('daily_quest_road_of_vanishing', false),
          ],
          weeklyContents: [
            buildWeekly('erda_spectrum', true),
            buildWeekly('mu_lung_dojo', false),
          ],
          bossContents: [buildBoss('루시드', 'lucid', 'easy', true), buildBoss('스우', 'lotus', 'hard', false)],
        }),
      ),
    ])

    await seedManualTrackedContent([OCID])

    expect(syncSchedules).toHaveBeenCalledWith([OCID])
    expect(setManualTrackedContent).toHaveBeenCalledWith(OCID, [
      { contentKey: 'monster_park', kind: 'daily' },
      { contentKey: 'erda_spectrum', kind: 'weekly' },
      { kind: 'boss', bossKey: 'lucid', difficulty: 'easy' },
    ])
  })

  // 컨텐츠 표에 없는 컨텐츠는 기록할 key 가 없다. 수동 추적 목록에 담으면 편집할 수 없는 고아가 된다.
  it('템플릿에 없는 컨텐츠(key 가 없다)는 등록돼 있어도 시드에서 제외한다', async () => {
    jest.mocked(syncSchedules).mockResolvedValue([
      buildSyncResult(
        buildState({
          dailyContents: [buildDaily(null, true, '템플릿에 없는 이벤트 콘텐츠'), buildDaily('monster_park', true)],
          weeklyContents: [buildWeekly(null, true, '알 수 없는 주간 콘텐츠')],
        }),
      ),
    ])

    await seedManualTrackedContent([OCID])

    expect(setManualTrackedContent).toHaveBeenCalledWith(OCID, [
      { contentKey: 'monster_park', kind: 'daily' },
    ])
  })

  it('보스는 API 원문명이 아니라 보스 key 로 저장한다', async () => {
    jest.mocked(syncSchedules).mockResolvedValue([
      buildSyncResult(
        buildState({
          // API가 공백 없이 내려주는 케이스. key 는 응답을 앱 상태로 바꾸는 자리가 이미 찾았다.
          bossContents: [buildBoss('선택받은세렌', 'chosen_seren', 'hard', true)],
        }),
      ),
    ])

    await seedManualTrackedContent([OCID])

    expect(setManualTrackedContent).toHaveBeenCalledWith(OCID, [
      { kind: 'boss', bossKey: 'chosen_seren', difficulty: 'hard' },
    ])
  })

  // 보스 표에 없는 보스는 기록할 key 가 없다. 수동 추적 목록에 담으면 편집할 수 없는 고아가 된다.
  it('보스 표에 없는 보스(key 가 없다)는 등록돼 있어도 시드에서 제외한다', async () => {
    jest.mocked(syncSchedules).mockResolvedValue([
      buildSyncResult(
        buildState({
          bossContents: [buildBoss('새로 나온 보스', null, 'hard', true), buildBoss('루시드', 'lucid', 'hard', true)],
        }),
      ),
    ])

    await seedManualTrackedContent([OCID])

    expect(setManualTrackedContent).toHaveBeenCalledWith(OCID, [{ kind: 'boss', bossKey: 'lucid', difficulty: 'hard' }])
  })

  it('동기화가 실패해 state가 null이면 에러를 던지고 저장하지 않는다', async () => {
    jest.mocked(syncSchedules).mockResolvedValue([buildSyncResult(null)])

    await expect(seedManualTrackedContent([OCID])).rejects.toThrow()
    expect(setManualTrackedContent).not.toHaveBeenCalled()
  })

  it('동기화 결과가 아예 없으면 에러를 던지고 저장하지 않는다', async () => {
    jest.mocked(syncSchedules).mockResolvedValue([])

    await expect(seedManualTrackedContent([OCID])).rejects.toThrow()
    expect(setManualTrackedContent).not.toHaveBeenCalled()
  })
})

// 캐릭터마다 회차를 내다가 서로 합류해 전원이 남의 스케줄로 시드됐다.
describe('seedManualTrackedContent: 여러 ocid', () => {
  it('ocid가 여럿이어도 동기화는 한 회차다', async () => {
    jest.mocked(syncSchedules).mockResolvedValue([
      buildSyncResult(buildState(), 'ocid-1'),
      buildSyncResult(buildState(), 'ocid-2'),
    ])

    await seedManualTrackedContent(['ocid-1', 'ocid-2'])

    expect(syncSchedules).toHaveBeenCalledTimes(1)
    expect(syncSchedules).toHaveBeenCalledWith(['ocid-1', 'ocid-2'])
  })

  it('결과 순서가 요청 순서와 달라도 각 ocid는 자기 결과로 시드된다', async () => {
    jest.mocked(syncSchedules).mockResolvedValue([
      buildSyncResult(buildState({ dailyContents: [buildDaily('monster_park', true)] }), 'ocid-2'),
      buildSyncResult(
        buildState({ dailyContents: [buildDaily('daily_quest_road_of_vanishing', true)] }),
        'ocid-1',
      ),
    ])

    await seedManualTrackedContent(['ocid-1', 'ocid-2'])

    expect(setManualTrackedContent).toHaveBeenCalledWith('ocid-1', [
      { contentKey: 'daily_quest_road_of_vanishing', kind: 'daily' },
    ])
    expect(setManualTrackedContent).toHaveBeenCalledWith('ocid-2', [
      { contentKey: 'monster_park', kind: 'daily' },
    ])
  })

  it('요청한 ocid가 결과에 없으면 남의 결과로 시드하지 않고 에러를 던진다', async () => {
    jest.mocked(syncSchedules).mockResolvedValue([
      buildSyncResult(buildState({ dailyContents: [buildDaily('monster_park', true)] }), 'ocid-1'),
    ])

    await expect(seedManualTrackedContent(['ocid-1', 'ocid-2'])).rejects.toThrow()
    expect(setManualTrackedContent).not.toHaveBeenCalledWith('ocid-2', expect.anything())
  })

  it('빈 배열이면 동기화도 저장도 하지 않는다', async () => {
    await seedManualTrackedContent([])

    expect(syncSchedules).not.toHaveBeenCalled()
    expect(setManualTrackedContent).not.toHaveBeenCalled()
  })
})
