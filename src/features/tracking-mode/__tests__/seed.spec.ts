import { syncSchedules, type CharacterScheduleSync } from '../../schedule-sync/schedule-sync'
import { setManualTrackedContent } from '../../../storage/manual-tracked-content'
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

function buildDaily(name: string, isRegistered: boolean): DailyContent {
  return { name, kind: 'contents', isRegistered, nowCount: 7, maxCount: 14, questState: null }
}

function buildWeekly(name: string, isRegistered: boolean): WeeklyContent {
  return { name, kind: 'contents', isRegistered, nowCount: 1, maxCount: 5, questState: null }
}

function buildBoss(name: string, difficulty: BossDifficulty, isRegistered: boolean): BossContent {
  return { name, difficulty, cycle: 'weekly', isRegistered, isComplete: false, ownComplete: false }
}

function buildState(overrides: Partial<SchedulerCharacterState> = {}): SchedulerCharacterState {
  return {
    asOf: '2026-07-23T00:00+09:00',
    characterName: '낟낟',
    world: '엘리시움',
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
            buildDaily('몬스터파크', true),
            buildDaily('[일일 퀘스트] 소멸의 여로 조사', false),
          ],
          weeklyContents: [
            buildWeekly('에르다 스펙트럼', true),
            buildWeekly('무릉도장', false),
          ],
          bossContents: [buildBoss('루시드', '이지', true), buildBoss('스우', '하드', false)],
        }),
      ),
    ])

    await seedManualTrackedContent([OCID])

    expect(syncSchedules).toHaveBeenCalledWith([OCID])
    expect(setManualTrackedContent).toHaveBeenCalledWith(OCID, [
      { contentName: '몬스터파크', kind: 'daily' },
      { contentName: '에르다 스펙트럼', kind: 'weekly' },
      { contentName: '루시드', difficulty: '이지', kind: 'boss' },
    ])
  })

  it('템플릿에 없는 컨텐츠는 등록돼 있어도 시드에서 제외한다', async () => {
    jest.mocked(syncSchedules).mockResolvedValue([
      buildSyncResult(
        buildState({
          dailyContents: [buildDaily('템플릿에 없는 이벤트 콘텐츠', true), buildDaily('몬스터파크', true)],
          weeklyContents: [buildWeekly('알 수 없는 주간 콘텐츠', true)],
        }),
      ),
    ])

    await seedManualTrackedContent([OCID])

    expect(setManualTrackedContent).toHaveBeenCalledWith(OCID, [
      { contentName: '몬스터파크', kind: 'daily' },
    ])
  })

  it('보스는 API 원문명이 아니라 matchBossContent 정규화 명으로 저장한다', async () => {
    jest.mocked(syncSchedules).mockResolvedValue([
      buildSyncResult(
        buildState({
          // API가 공백 없이 내려주는 케이스 — 우리 데이터 이름은 "선택받은 세렌"
          bossContents: [buildBoss('선택받은세렌', '하드', true)],
        }),
      ),
    ])

    await seedManualTrackedContent([OCID])

    expect(setManualTrackedContent).toHaveBeenCalledWith(OCID, [
      { contentName: '선택받은 세렌', difficulty: '하드', kind: 'boss' },
    ])
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
describe('seedManualTrackedContent — 여러 ocid', () => {
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
      buildSyncResult(buildState({ dailyContents: [buildDaily('몬스터파크', true)] }), 'ocid-2'),
      buildSyncResult(
        buildState({ dailyContents: [buildDaily('[일일 퀘스트] 소멸의 여로 조사', true)] }),
        'ocid-1',
      ),
    ])

    await seedManualTrackedContent(['ocid-1', 'ocid-2'])

    expect(setManualTrackedContent).toHaveBeenCalledWith('ocid-1', [
      { contentName: '[일일 퀘스트] 소멸의 여로 조사', kind: 'daily' },
    ])
    expect(setManualTrackedContent).toHaveBeenCalledWith('ocid-2', [
      { contentName: '몬스터파크', kind: 'daily' },
    ])
  })

  it('요청한 ocid가 결과에 없으면 남의 결과로 시드하지 않고 에러를 던진다', async () => {
    jest.mocked(syncSchedules).mockResolvedValue([
      buildSyncResult(buildState({ dailyContents: [buildDaily('몬스터파크', true)] }), 'ocid-1'),
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
