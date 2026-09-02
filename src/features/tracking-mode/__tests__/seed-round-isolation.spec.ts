// 회귀 가드. **`seed` 와 `syncSchedules` 를 둘 다 실물로 쓴다.**
//
// 결함은 그 둘의 **결합**에 있었고(시드가 ocid 마다 회차를 동시에 내다가 단일 비행으로 서로
// 합류했고, 시드는 결과를 위치 `[0]` 로 집었다), 기존 테스트 둘은 서로의 사각을 만들고 있었다.
// `store.test.ts` 는 `seed` 를, `seed.test.ts` 는 `syncSchedules` 를 목으로 바꾼다. 그래서 여기서는
// **넥슨 계층과 저장 계층만** 목으로 두고 그 사이는 전부 실물이다.
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import type { MapleAccount, MapleCharacter, SchedulerCharacterState } from '../../../types'

jest.mock('../../../nexon/character', () => ({
  fetchCharacterList: jest.fn(),
  fetchCharacterBasic: jest.fn(),
}))
const { fetchCharacterList: fetchCharacterListMock, fetchCharacterBasic: fetchCharacterBasicMock } = jest.requireMock('../../../nexon/character') as Record<string, jest.Mock>
jest.mock('../../../nexon/schedule', () => ({
  fetchSchedulerCharacterState: jest.fn(),
}))
const { fetchSchedulerCharacterState: fetchSchedulerCharacterStateMock } = jest.requireMock('../../../nexon/schedule') as Record<string, jest.Mock>
jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
const { getAuthConfig: getAuthConfigMock } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>
jest.mock('../../../storage/scheduler-cache', () => ({
  getCachedSchedulerState: jest.fn().mockResolvedValue(null),
  setCachedSchedulerState: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../../../storage/character-basic-cache', () => ({
  getCachedCharacterBasic: jest.fn().mockResolvedValue(null),
  setCachedCharacterBasic: jest.fn().mockResolvedValue(undefined),
  getAllCachedCharacterBasicOcids: jest.fn().mockResolvedValue([]),
}))
jest.mock('../../../storage/shared-progress-cache', () => ({
  getWorldSharedProgress: jest.fn().mockResolvedValue({}),
  getAccountSharedProgress: jest.fn().mockResolvedValue({}),
  setWorldSharedProgressEntry: jest.fn().mockResolvedValue(undefined),
  setAccountSharedProgressEntry: jest.fn().mockResolvedValue(undefined),
}))
// 병합은 이 파일이 검증할 대상이 아니다. fresh 를 그대로 통과시킨다.
jest.mock('../../../lib/scheduler/scheduler-merge', () => ({ mergeSchedulerState: jest.fn() }))
const { mergeSchedulerState: mergeSchedulerStateMock } = jest.requireMock('../../../lib/scheduler/scheduler-merge') as Record<string, jest.Mock>
jest.mock('../../../storage/manual-tracked-content', () => ({
  setManualTrackedContent: jest.fn(),
}))
const { setManualTrackedContent: setManualTrackedContentMock } = jest.requireMock('../../../storage/manual-tracked-content') as Record<string, jest.Mock>
jest.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: jest.fn(),
}))
const { getTrackedCharacterOcids: getTrackedCharacterOcidsMock } = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>
jest.mock('../../../storage/tracking-mode', () => ({
  getTrackingMode: jest.fn(),
  setTrackingMode: jest.fn(),
}))
const { getTrackingMode: getTrackingModeMock, setTrackingMode: setTrackingModeMock } = jest.requireMock('../../../storage/tracking-mode') as Record<string, jest.Mock>

import { resetSyncSingleFlightForTests } from '../../schedule-sync/schedule-sync'
import { resetSyncRunStateForTests } from '../../schedule-sync/sync-run-state'
import { useTrackingModeStore } from '../store'

// ocid 마다 **다른** 일일 컨텐츠가 등록돼 있다. 오염되면 서로 구분된다. 셋 다 mockCharacter 범위
// 항목이라(`getShareScope`) 선채움(`fillMissingSections`)이 안 돌고, 캐릭터당 호출이 정확히 1회다.
const REGISTERED_DAILY: Record<string, string> = {
  'ocid-a': '[일일 퀘스트] 레헬른의 평온한 밤',
  'ocid-b': '[일일 퀘스트] 소멸의 여로 조사',
  'ocid-c': '[일일 퀘스트] 츄츄 아일랜드 최고의 요리',
}
const TRACKED = Object.keys(REGISTERED_DAILY)

function mockCharacter(ocid: string): MapleCharacter {
  return { ocid, name: `캐릭터-${ocid}`, world: '베라', jobClass: '렌', level: 200 }
}

function account(accountId: string, characters: MapleCharacter[]): MapleAccount {
  return { accountId, characters }
}

function stateFor(ocid: string): SchedulerCharacterState {
  return {
    asOf: '2026-08-18T00:00+09:00',
    characterName: `캐릭터-${ocid}`,
    world: '베라',
    level: 200,
    jobClass: '렌',
    dailyContents: [
      {
        name: REGISTERED_DAILY[ocid],
        kind: 'contents',
        isRegistered: true,
        nowCount: 0,
        maxCount: 1,
        questState: null,
      },
    ],
    weeklyContents: [],
    bossContents: [],
    isDailyStale: false,
    isWeeklyStale: false,
    isWeeklyBossStale: false,
    isMonthlyBossStale: false,
  }
}

beforeEach(() => {
  installFakePreferences()
  resetSyncRunStateForTests()
  resetSyncSingleFlightForTests()
  setManualTrackedContentMock.mockReset()
  setManualTrackedContentMock.mockResolvedValue(undefined)
  fetchCharacterListMock.mockReset()
  fetchCharacterListMock.mockResolvedValue([account('acc-1', TRACKED.map(mockCharacter))])
  fetchSchedulerCharacterStateMock.mockReset()
  fetchSchedulerCharacterStateMock.mockImplementation(async (_apiKey: string, ocid: string) =>
    stateFor(ocid),
  )
  fetchCharacterBasicMock.mockResolvedValue({
    name: '캐릭터',
    level: 200,
    imageUrl: 'https://example.invalid/look',
    accessFlag: true,
  })
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: 'acc-1' })
  mergeSchedulerStateMock.mockImplementation(({ fresh }: { fresh: SchedulerCharacterState }) => ({
    characterState: fresh,
    worldLedgerUpdates: {},
    accountLedgerUpdates: {},
  }))
  getTrackingModeMock.mockResolvedValue('auto')
  setTrackingModeMock.mockResolvedValue(undefined)
  getTrackedCharacterOcidsMock.mockResolvedValue(TRACKED)
  useTrackingModeStore.setState({ mode: 'auto' })
})

describe('auto → manual 전환 시드', () => {
  it('각 캐릭터는 남의 것이 아니라 자기 스케줄로 시드된다', async () => {
    await useTrackingModeStore.getState().setMode('manual')

    for (const ocid of TRACKED) {
      expect(setManualTrackedContentMock).toHaveBeenCalledWith(ocid, [
        { contentName: REGISTERED_DAILY[ocid], kind: 'daily' },
      ])
    }
  })

  it('추적 캐릭터 전원을 한 회차로 훑는다. 캐릭터마다 회차를 내지 않는다', async () => {
    await useTrackingModeStore.getState().setMode('manual')

    expect(fetchCharacterListMock).toHaveBeenCalledTimes(1)
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(TRACKED.length)
    expect(
      fetchSchedulerCharacterStateMock.mock.calls.map((call) => call[1] as string).sort(),
    ).toEqual([...TRACKED].sort())
  })
})
