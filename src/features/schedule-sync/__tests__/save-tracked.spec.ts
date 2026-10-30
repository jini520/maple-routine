/**
 * `saveTrackedCharacters`. 저장의 순서가 대상이다. 수동 모드의 시드는 추적 목록을 캐시에 올리기 전이고, 새 캐릭터의
 * 조회는 그 뒤다. 추적 목록 캐시는 본물을 써서 어느 시점에 무엇이 들어 있는지를 본다.
 */
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'

jest.mock('../../../storage/character-selection', () => ({ setTrackedCharacterOcids: jest.fn() }))
const { setTrackedCharacterOcids: setTrackedMock } = jest.requireMock('../../../storage/character-selection') as Record<
  string,
  jest.Mock
>

jest.mock('../schedule-query', () => ({ readTrackedOcids: jest.fn(), syncAddedCharacters: jest.fn() }))
const { readTrackedOcids: readTrackedMock, syncAddedCharacters: syncAddedMock } = jest.requireMock(
  '../schedule-query',
) as Record<string, jest.Mock>

jest.mock('../../cashbook/remembered-levels', () => ({ seedRememberedLevels: jest.fn() }))
const { seedRememberedLevels: seedLevelsMock } = jest.requireMock('../../cashbook/remembered-levels') as Record<
  string,
  jest.Mock
>

jest.mock('../../notice/permission-gate', () => ({ askNotificationPermissionOnce: jest.fn() }))
const { askNotificationPermissionOnce: askPermissionMock } = jest.requireMock('../../notice/permission-gate') as Record<
  string,
  jest.Mock
>

jest.mock('../../tracking-mode/seed', () => ({ seedManualTrackedContent: jest.fn() }))
const { seedManualTrackedContent: seedManualMock } = jest.requireMock('../../tracking-mode/seed') as Record<
  string,
  jest.Mock
>

jest.mock('../../toast/store', () => {
  const showSuccess = jest.fn()
  const showError = jest.fn()
  return { useToastStore: { getState: () => ({ showSuccess, showError }) } }
})
const showSuccessMock = jest.requireMock('../../toast/store').useToastStore.getState().showSuccess as jest.Mock
const showErrorMock = jest.requireMock('../../toast/store').useToastStore.getState().showError as jest.Mock

// 팩토리가 모듈 평가보다 먼저 불릴 수 있어 `var` 로 올리고 읽는 자리에서 채운다.
var mockTrackingMode: { mode: 'auto' | 'manual' } = { mode: 'auto' }
jest.mock('../../tracking-mode/store', () => ({
  useTrackingModeStore: {
    getState: () => {
      mockTrackingMode = mockTrackingMode ?? { mode: 'auto' }
      return { mode: mockTrackingMode.mode }
    },
  },
}))

import { saveTrackedCharacters } from '../save-tracked'

/** 추적 목록 캐시에 지금 든 값. 저장 중 어느 시점에 무엇이 보이는지를 잰다. */
function cachedTracked(): string[] | null | undefined {
  return queryClient.getQueryData<string[] | null>(queryKeys.trackedOcids())
}

/** 저장 전의 추적 목록. 저장소와 캐시가 같은 값을 들고 있던 상태다. */
function givenPrevious(ocids: string[] | null): void {
  readTrackedMock.mockResolvedValue(ocids)
  if (ocids !== null) queryClient.setQueryData(queryKeys.trackedOcids(), ocids)
}

beforeEach(() => {
  queryClient.clear()
  mockTrackingMode.mode = 'auto'
  readTrackedMock.mockReset().mockResolvedValue(null)
  setTrackedMock.mockReset().mockResolvedValue(undefined)
  syncAddedMock.mockReset().mockResolvedValue(undefined)
  seedLevelsMock.mockReset().mockResolvedValue(undefined)
  askPermissionMock.mockReset().mockResolvedValue(undefined)
  seedManualMock.mockReset().mockResolvedValue(undefined)
  showSuccessMock.mockClear()
  showErrorMock.mockClear()
})

describe('추가된 캐릭터만 받는다', () => {
  it('순서만 바뀌면 저장만 하고 받지 않는다', async () => {
    givenPrevious(['a', 'b'])

    await saveTrackedCharacters(['b', 'a'])

    expect(setTrackedMock).toHaveBeenCalledWith(['b', 'a'])
    expect(cachedTracked()).toEqual(['b', 'a'])
    expect(syncAddedMock).not.toHaveBeenCalled()
    expect(showSuccessMock).toHaveBeenCalledWith('캐릭터 정보를 모두 불러왔어요')
  })

  it('제거만 하면 받지 않고 완료 토스트만 띄운다', async () => {
    givenPrevious(['a', 'b'])

    await saveTrackedCharacters(['a'])

    expect(cachedTracked()).toEqual(['a'])
    expect(syncAddedMock).not.toHaveBeenCalled()
    expect(showSuccessMock).toHaveBeenCalledTimes(1)
  })

  it('추가분만 인자로 받고 진행률 콜백을 넘긴다', async () => {
    givenPrevious(['a'])
    const onProgress = jest.fn()

    await saveTrackedCharacters(['a', 'c'], onProgress)

    expect(syncAddedMock).toHaveBeenCalledTimes(1)
    expect(syncAddedMock).toHaveBeenCalledWith(['c'], onProgress)
    expect(seedLevelsMock).toHaveBeenCalledWith(['c'])
    expect(showSuccessMock).toHaveBeenCalledWith('캐릭터 정보를 모두 불러왔어요')
  })

  it('처음 저장(이전 목록 없음)이면 전원이 추가분이다', async () => {
    givenPrevious(null)

    await saveTrackedCharacters(['a', 'b'])

    expect(syncAddedMock).toHaveBeenCalledWith(['a', 'b'], undefined)
  })
})

// 목록을 캐시에 올리면 화면이 그 순간 멤버십을 읽는다. 시드 전이면 빈 멤버십이 선다.
describe('수동 모드의 시드', () => {
  it('새 캐릭터만 시드하고, 시드는 추적 목록을 캐시에 올리기 전이며 조회는 그 뒤다', async () => {
    mockTrackingMode.mode = 'manual'
    givenPrevious(['a'])
    const trackedWhenSeeding: unknown[] = []
    const trackedWhenSyncing: unknown[] = []
    seedManualMock.mockImplementation(async () => {
      trackedWhenSeeding.push(cachedTracked())
    })
    syncAddedMock.mockImplementation(async () => {
      trackedWhenSyncing.push(cachedTracked())
    })

    await saveTrackedCharacters(['a', 'c'])

    expect(seedManualMock).toHaveBeenCalledTimes(1)
    expect(seedManualMock).toHaveBeenCalledWith(['c'])
    expect(trackedWhenSeeding).toEqual([['a']])
    expect(trackedWhenSyncing).toEqual([['a', 'c']])
    expect(seedManualMock.mock.invocationCallOrder[0]).toBeLessThan(syncAddedMock.mock.invocationCallOrder[0])
  })

  it('수동 모드라도 추가분이 없으면 시드하지 않는다', async () => {
    mockTrackingMode.mode = 'manual'
    givenPrevious(['a', 'b'])

    await saveTrackedCharacters(['a'])

    expect(seedManualMock).not.toHaveBeenCalled()
  })

  it('자동 모드면 추가분이 있어도 시드하지 않는다', async () => {
    givenPrevious(['a'])

    await saveTrackedCharacters(['a', 'c'])

    expect(seedManualMock).not.toHaveBeenCalled()
    expect(syncAddedMock).toHaveBeenCalledWith(['c'], undefined)
  })
})

describe('실패', () => {
  it('저장소 저장이 실패하면 실패 토스트를 띄우고 멈춘다. 캐시도 그대로다', async () => {
    givenPrevious(['a'])
    setTrackedMock.mockRejectedValue(new Error('disk full'))

    await expect(saveTrackedCharacters(['a', 'c'])).resolves.toBeUndefined()

    expect(showErrorMock).toHaveBeenCalledWith('저장하지 못했습니다')
    expect(showSuccessMock).not.toHaveBeenCalled()
    expect(cachedTracked()).toEqual(['a'])
    expect(askPermissionMock).not.toHaveBeenCalled()
    expect(seedManualMock).not.toHaveBeenCalled()
    expect(syncAddedMock).not.toHaveBeenCalled()
  })

  // 회차 자체가 던지는 실패(키 없음 등)다. 저장은 이미 끝났으므로 목록은 새 것이고, 완료 토스트만 없다.
  it('새 캐릭터 조회가 던지면 그 실패의 문구를 띄우고 완료 토스트는 띄우지 않는다', async () => {
    givenPrevious(['a'])
    syncAddedMock.mockRejectedValue(new Error('키 없음'))

    await expect(saveTrackedCharacters(['a', 'c'])).resolves.toBeUndefined()

    expect(showErrorMock).toHaveBeenCalledWith('네트워크 오류가 발생했습니다')
    expect(showSuccessMock).not.toHaveBeenCalled()
    expect(cachedTracked()).toEqual(['a', 'c'])
  })
})

// 이 흐름은 캐릭터 저장이고 알림 권한 · 레벨 기억은 곁가지다. 팝업을 기다리느라 조회가 멈추면 사용자는 저장이 느린 것으로 읽는다.
describe('곁가지는 기다리지 않는다', () => {
  it('알림 권한과 레벨 기억이 끝나지 않아도 조회와 완료 토스트는 진행된다', async () => {
    givenPrevious(['a'])
    askPermissionMock.mockReturnValue(new Promise(() => {}))
    seedLevelsMock.mockReturnValue(new Promise(() => {}))

    await saveTrackedCharacters(['a', 'c'])

    expect(askPermissionMock).toHaveBeenCalledTimes(1)
    expect(seedLevelsMock).toHaveBeenCalledWith(['c'])
    expect(syncAddedMock).toHaveBeenCalledWith(['c'], undefined)
    expect(showSuccessMock).toHaveBeenCalledTimes(1)
  })
})
