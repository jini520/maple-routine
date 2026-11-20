// 우리 서버의 점검 잠금. 언제 잠그고 풀지와 언제 다시 물을지를 여기서 정한다.
//
// 여기가 지키는 것은 둘이다. **모르면 지금 상태를 두는 것**과 **잠긴 동안에는 자주 묻는 것**이다. 앞의 것이 깨지면
// 오프라인에서 앱이 잠기거나 점검 중에 열리고, 뒤의 것이 깨지면 점검이 끝난 뒤에도 앱이 5분 동안 잠겨 있다.
import { focusManager } from '@tanstack/react-query'

jest.mock('../../../server/maintenance', () => ({
  __esModule: true,
  fetchServerMaintenance: jest.fn(),
}))

const mockGameData = { phase: 'ready' }
jest.mock('../../game-data/sync', () => ({
  __esModule: true,
  getGameDataStatus: () => ({ phase: mockGameData.phase }),
  refreshGameData: jest.fn(async () => {}),
  retryGameData: jest.fn(async () => {}),
}))

import { fetchServerMaintenance, type ServerMaintenance } from '../../../server/maintenance'
import { refreshGameData, retryGameData } from '../../game-data/sync'
import {
  LOCKED_CHECK_INTERVAL_MS,
  OPEN_CHECK_INTERVAL_MS,
  checkServerMaintenance,
  resetServerMaintenanceForTest,
  shownMaintenanceUntil,
  useServerMaintenanceStore,
  watchServerMaintenance,
} from '../store'

const 조회 = fetchServerMaintenance as jest.MockedFunction<typeof fetchServerMaintenance>
const 지금 = () => useServerMaintenanceStore.getState()

const 점검중 = (until: number | null = null): ServerMaintenance => ({ state: 'on', until })
const 점검아님: ServerMaintenance = { state: 'off' }
const 모름: ServerMaintenance = { state: 'unknown' }

beforeEach(() => {
  jest.clearAllMocks()
  resetServerMaintenanceForTest()
  mockGameData.phase = 'ready'
  focusManager.setFocused(undefined)
})

describe('잠그고 푼다', () => {
  it('점검 중이라는 답을 받으면 잠그고 종료 예정 시각을 기억한다', async () => {
    조회.mockResolvedValue(점검중(1_800_000_000_000))

    await checkServerMaintenance()

    expect(지금().locked).toBe(true)
    expect(지금().until).toBe(1_800_000_000_000)
  })

  // 오프라인에서도 앱을 쓸 수 있어야 한다.
  it('켠 뒤 한 번도 답을 못 받았으면 잠그지 않는다', async () => {
    조회.mockResolvedValue(모름)

    await checkServerMaintenance()

    expect(지금().locked).toBe(false)
  })

  // 네트워크가 잠깐 끊겼다고 점검 중에 앱이 열리면 안 된다.
  it('잠긴 뒤에 답을 못 받으면 잠가 둔다', async () => {
    조회.mockResolvedValueOnce(점검중()).mockResolvedValueOnce(모름)

    await checkServerMaintenance()
    await checkServerMaintenance()

    expect(지금().locked).toBe(true)
  })

  it('점검이 아니라는 답을 받으면 풀고 게임 데이터를 다시 묻는다', async () => {
    조회.mockResolvedValueOnce(점검중()).mockResolvedValueOnce(점검아님)

    await checkServerMaintenance()
    await checkServerMaintenance()

    expect(지금().locked).toBe(false)
    expect(refreshGameData).toHaveBeenCalledTimes(1)
    expect(retryGameData).not.toHaveBeenCalled()
  })

  // 점검 중에 처음 켠 기기는 게임 데이터 받기가 실패해 있다. 다시 묻기는 사본이 있을 때만 돌아서 그 기기를 못 푼다.
  it('풀릴 때 게임 데이터 받기가 실패해 있으면 다시 받는다', async () => {
    조회.mockResolvedValueOnce(점검중()).mockResolvedValueOnce(점검아님)
    mockGameData.phase = 'failed'

    await checkServerMaintenance()
    await checkServerMaintenance()

    expect(retryGameData).toHaveBeenCalledTimes(1)
    expect(refreshGameData).not.toHaveBeenCalled()
  })

  // 잠긴 적이 없으면 풀린 것이 아니다. 여기서 다시 물으면 5분마다 게임 데이터를 묻게 된다.
  it('잠긴 적이 없으면 점검이 아니라는 답에 게임 데이터를 묻지 않는다', async () => {
    조회.mockResolvedValue(점검아님)

    await checkServerMaintenance()

    expect(refreshGameData).not.toHaveBeenCalled()
  })

  it('겹쳐 부르면 한 번만 묻는다', async () => {
    조회.mockResolvedValue(점검아님)

    await Promise.all([checkServerMaintenance(), checkServerMaintenance()])

    expect(조회).toHaveBeenCalledTimes(1)
  })
})

describe('종료 예정 시각', () => {
  // 지난 시각이 보이면 점검이 끝났는데 앱이 안 풀린 것으로 읽힌다.
  it('마지막으로 답을 받은 때보다 뒤일 때만 보인다', () => {
    expect(shownMaintenanceUntil({ locked: true, until: 2_000, checkedAt: 1_000 })).toBe(2_000)
    expect(shownMaintenanceUntil({ locked: true, until: 1_000, checkedAt: 1_000 })).toBeNull()
    expect(shownMaintenanceUntil({ locked: true, until: null, checkedAt: 1_000 })).toBeNull()
  })

  it('잠긴 채 다시 답을 받으면 답을 받은 때를 고친다', async () => {
    jest.useFakeTimers({ now: 1_000 })
    try {
      조회.mockResolvedValue(점검중(5_000))
      await checkServerMaintenance()
      expect(shownMaintenanceUntil(지금())).toBe(5_000)

      jest.setSystemTime(6_000)
      await checkServerMaintenance()

      expect(shownMaintenanceUntil(지금())).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('다시 묻는 때', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  /** 타이머를 흘리고, 그 사이 끝난 확인이 다음 타이머를 걸 때까지 기다린다. */
  async function advance(ms: number): Promise<void> {
    await jest.advanceTimersByTimeAsync(ms)
  }

  it('켜자마자 묻고, 풀려 있는 동안은 5분마다 묻는다', async () => {
    조회.mockResolvedValue(점검아님)
    const stop = watchServerMaintenance()
    await advance(0)
    expect(조회).toHaveBeenCalledTimes(1)

    await advance(OPEN_CHECK_INTERVAL_MS - 1)
    expect(조회).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(조회).toHaveBeenCalledTimes(2)
    stop()
  })

  it('잠긴 동안은 30초마다 묻는다', async () => {
    조회.mockResolvedValue(점검중())
    const stop = watchServerMaintenance()
    await advance(0)

    await advance(LOCKED_CHECK_INTERVAL_MS)
    expect(조회).toHaveBeenCalledTimes(2)
    await advance(LOCKED_CHECK_INTERVAL_MS)
    expect(조회).toHaveBeenCalledTimes(3)
    stop()
  })

  // 돌아올 때의 확인으로 잠겼는데 5분짜리 타이머가 그대로면, 점검이 끝나도 최대 5분 동안 안 풀린다.
  it('주기 밖의 확인으로 잠기면 그때부터 30초 뒤에 묻는다', async () => {
    조회.mockResolvedValue(점검아님)
    const stop = watchServerMaintenance()
    await advance(0)

    조회.mockResolvedValue(점검중())
    await checkServerMaintenance()
    expect(조회).toHaveBeenCalledTimes(2)

    await advance(LOCKED_CHECK_INTERVAL_MS)
    expect(조회).toHaveBeenCalledTimes(3)
    stop()
  })

  it('앱이 화면에 없으면 주기 확인을 건너뛰고, 주기는 이어 간다', async () => {
    조회.mockResolvedValue(점검아님)
    const stop = watchServerMaintenance()
    await advance(0)

    focusManager.setFocused(false)
    await advance(OPEN_CHECK_INTERVAL_MS)
    expect(조회).toHaveBeenCalledTimes(1)

    focusManager.setFocused(true)
    await advance(OPEN_CHECK_INTERVAL_MS)
    expect(조회).toHaveBeenCalledTimes(2)
    stop()
  })

  it('멈추면 더 묻지 않는다', async () => {
    조회.mockResolvedValue(점검아님)
    const stop = watchServerMaintenance()
    await advance(0)
    stop()

    await advance(OPEN_CHECK_INTERVAL_MS * 2)
    expect(조회).toHaveBeenCalledTimes(1)
  })
})
