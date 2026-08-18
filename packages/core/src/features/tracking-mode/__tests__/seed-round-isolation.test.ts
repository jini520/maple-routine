// ADR-147 정정 42 회귀 가드 — **`seed` 와 `syncSchedules` 를 둘 다 실물로 쓴다.**
//
// 결함은 그 둘의 **결합**에 있었고(시드가 ocid 마다 회차를 동시에 내다가 단일 비행으로 서로
// 합류했고, 시드는 결과를 위치 `[0]` 로 집었다), 기존 테스트 둘은 서로의 사각을 만들고 있었다 —
// `store.test.ts` 는 `seed` 를, `seed.test.ts` 는 `syncSchedules` 를 목으로 바꾼다. 그래서 여기서는
// **넥슨 계층과 저장 계층만** 목으로 두고 그 사이는 전부 실물이다.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakePreferences } from '@core/storage/__tests__/fake-preferences'
import type { MapleAccount, MapleCharacter, SchedulerCharacterState } from '@core/types'

const { fetchCharacterListMock, fetchCharacterBasicMock, fetchSchedulerCharacterStateMock } = vi.hoisted(
  () => ({
    fetchCharacterListMock: vi.fn(),
    fetchCharacterBasicMock: vi.fn(),
    fetchSchedulerCharacterStateMock: vi.fn(),
  }),
)
const { getAuthConfigMock } = vi.hoisted(() => ({ getAuthConfigMock: vi.fn() }))
const { setManualTrackedContentMock } = vi.hoisted(() => ({ setManualTrackedContentMock: vi.fn() }))
const { getTrackedCharacterOcidsMock } = vi.hoisted(() => ({ getTrackedCharacterOcidsMock: vi.fn() }))
const { getTrackingModeMock, setTrackingModeMock } = vi.hoisted(() => ({
  getTrackingModeMock: vi.fn(),
  setTrackingModeMock: vi.fn(),
}))
const { mergeSchedulerStateMock } = vi.hoisted(() => ({ mergeSchedulerStateMock: vi.fn() }))

vi.mock('@core/nexon/character', () => ({
  fetchCharacterList: fetchCharacterListMock,
  fetchCharacterBasic: fetchCharacterBasicMock,
}))
vi.mock('@core/nexon/schedule', () => ({
  fetchSchedulerCharacterState: fetchSchedulerCharacterStateMock,
}))
vi.mock('@core/storage/api-key', () => ({ getAuthConfig: getAuthConfigMock }))
vi.mock('@core/storage/scheduler-cache', () => ({
  getCachedSchedulerState: vi.fn().mockResolvedValue(null),
  setCachedSchedulerState: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@core/storage/character-basic-cache', () => ({
  getCachedCharacterBasic: vi.fn().mockResolvedValue(null),
  setCachedCharacterBasic: vi.fn().mockResolvedValue(undefined),
  getAllCachedCharacterBasicOcids: vi.fn().mockResolvedValue([]),
}))
vi.mock('@core/storage/shared-progress-cache', () => ({
  getWorldSharedProgress: vi.fn().mockResolvedValue({}),
  getAccountSharedProgress: vi.fn().mockResolvedValue({}),
  setWorldSharedProgressEntry: vi.fn().mockResolvedValue(undefined),
  setAccountSharedProgressEntry: vi.fn().mockResolvedValue(undefined),
}))
// 병합은 이 파일이 검증할 대상이 아니다 — fresh 를 그대로 통과시킨다.
vi.mock('@core/lib/scheduler-merge', () => ({ mergeSchedulerState: mergeSchedulerStateMock }))
vi.mock('@core/storage/manual-tracked-content', () => ({
  setManualTrackedContent: setManualTrackedContentMock,
}))
vi.mock('@core/storage/character-selection', () => ({
  getTrackedCharacterOcids: getTrackedCharacterOcidsMock,
}))
vi.mock('@core/storage/tracking-mode', () => ({
  getTrackingMode: getTrackingModeMock,
  setTrackingMode: setTrackingModeMock,
}))

import { resetSyncSingleFlightForTests } from '../../schedule-sync/schedule-sync'
import { resetSyncRunStateForTests } from '../../schedule-sync/sync-run-state'
import { useTrackingModeStore } from '../store'

// ocid 마다 **다른** 일일 컨텐츠가 등록돼 있다 — 오염되면 서로 구분된다. 셋 다 character 범위
// 항목이라(`getShareScope`) 선채움(`fillMissingSections`)이 안 돌고, 캐릭터당 호출이 정확히 1회다.
const REGISTERED_DAILY: Record<string, string> = {
  'ocid-a': '[일일 퀘스트] 레헬른의 평온한 밤',
  'ocid-b': '[일일 퀘스트] 소멸의 여로 조사',
  'ocid-c': '[일일 퀘스트] 츄츄 아일랜드 최고의 요리',
}
const TRACKED = Object.keys(REGISTERED_DAILY)

function character(ocid: string): MapleCharacter {
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
  fetchCharacterListMock.mockResolvedValue([account('acc-1', TRACKED.map(character))])
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

describe('auto → manual 전환 시드 (ADR-147 정정 42)', () => {
  it('각 캐릭터는 남의 것이 아니라 자기 스케줄로 시드된다', async () => {
    await useTrackingModeStore.getState().setMode('manual')

    for (const ocid of TRACKED) {
      expect(setManualTrackedContentMock).toHaveBeenCalledWith(ocid, [
        { contentName: REGISTERED_DAILY[ocid], kind: 'daily' },
      ])
    }
  })

  it('추적 캐릭터 전원을 한 회차로 훑는다 — 캐릭터마다 회차를 내지 않는다', async () => {
    await useTrackingModeStore.getState().setMode('manual')

    expect(fetchCharacterListMock).toHaveBeenCalledTimes(1)
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(TRACKED.length)
    expect(
      fetchSchedulerCharacterStateMock.mock.calls.map((call) => call[1] as string).sort(),
    ).toEqual([...TRACKED].sort())
  })
})
