// 앱 안 리뷰 요청의 조건. 저장 4번 · 첫 실행 3일 · 마지막 요청 90일이 모두 맞을 때 저장 2초 뒤에 묻는다.
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { getAppReviewRecord, setAppReviewRecord } from '../../../storage/app-review'
import { __resetNativePortsForTest, setStoreReviewPort } from '../../../native/ports'
import { __resetAppReviewForTest, countCoreSave, holdReviewRequest, recordFirstLaunch } from '../request'

const DAY_MS = 24 * 60 * 60 * 1000
const START = new Date('2026-11-01T00:00:00Z')

let request: jest.Mock

beforeEach(() => {
  jest.useFakeTimers({ now: START })
  installFakePreferences()
  request = jest.fn().mockResolvedValue(undefined)
  setStoreReviewPort({ request })
  __resetAppReviewForTest()
})

afterEach(() => {
  jest.useRealTimers()
  __resetNativePortsForTest()
})

/** 저장 n번. 셈이 저장소에 닿을 때까지 기다린다. */
async function saves(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    countCoreSave()
    await jest.advanceTimersByTimeAsync(0)
  }
}

describe('저장 횟수', () => {
  it('3번이면 묻지 않고 4번째 저장 2초 뒤에 묻는다', async () => {
    await recordFirstLaunch(new Date(START.getTime() - 4 * DAY_MS))

    await saves(3)
    await jest.advanceTimersByTimeAsync(10_000)
    expect(request).not.toHaveBeenCalled()

    await saves(1)
    await jest.advanceTimersByTimeAsync(1_999)
    expect(request).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(request).toHaveBeenCalledTimes(1)
  })

  // 2초 안에 또 저장해도 팝업은 한 번이다. 두 번 부르면 iOS 의 1년 세 번 한도를 헛되이 쓴다.
  it('기다리는 동안 저장이 더 와도 한 번만 묻는다', async () => {
    await recordFirstLaunch(new Date(START.getTime() - 4 * DAY_MS))

    await saves(6)
    await jest.advanceTimersByTimeAsync(10_000)

    expect(request).toHaveBeenCalledTimes(1)
  })
})

describe('첫 실행 3일', () => {
  it('3일 안이면 저장이 4번을 넘어도 묻지 않는다', async () => {
    await recordFirstLaunch(new Date(START.getTime() - 3 * DAY_MS + 60_000))

    await saves(5)
    await jest.advanceTimersByTimeAsync(10_000)

    expect(request).not.toHaveBeenCalled()
  })

  // 기존 사용자도 이 바이너리를 처음 켠 날부터 센다. 두 번째 실행이 그날을 덮으면 3일이 끝나지 않는다.
  it('첫 실행일은 처음 한 번만 적는다', async () => {
    await recordFirstLaunch(START)
    await recordFirstLaunch(new Date(START.getTime() + DAY_MS))

    expect((await getAppReviewRecord())?.firstLaunchAt).toBe(START.toISOString())
  })
})

describe('마지막 요청 90일', () => {
  it('90일 안이면 묻지 않고, 지나면 다시 묻는다', async () => {
    await setAppReviewRecord({
      firstLaunchAt: new Date(START.getTime() - 200 * DAY_MS).toISOString(),
      saveCount: 10,
      lastRequestedAt: new Date(START.getTime() - 89 * DAY_MS).toISOString(),
    })

    await saves(1)
    await jest.advanceTimersByTimeAsync(10_000)
    expect(request).not.toHaveBeenCalled()

    jest.setSystemTime(new Date(START.getTime() + 2 * DAY_MS))
    await saves(1)
    await jest.advanceTimersByTimeAsync(10_000)
    expect(request).toHaveBeenCalledTimes(1)
  })

  // 팝업이 떴는지는 앱이 모른다. 요청한 날을 적지 않으면 다음 저장마다 다시 묻는다.
  it('요청한 날을 마지막 요청일로 적는다', async () => {
    await recordFirstLaunch(new Date(START.getTime() - 4 * DAY_MS))

    await saves(4)
    await jest.advanceTimersByTimeAsync(2_000)

    expect((await getAppReviewRecord())?.lastRequestedAt).toBe(new Date(START.getTime() + 2_000).toISOString())
  })
})

describe('고가 드롭 연출', () => {
  it('연출이 재생 중이면 닫힌 뒤 2초를 기다려 묻는다', async () => {
    await recordFirstLaunch(new Date(START.getTime() - 4 * DAY_MS))
    const release = holdReviewRequest()

    await saves(4)
    await jest.advanceTimersByTimeAsync(10_000)
    expect(request).not.toHaveBeenCalled()

    release()
    await jest.advanceTimersByTimeAsync(1_999)
    expect(request).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(request).toHaveBeenCalledTimes(1)
  })
})

// 리뷰 요청은 곁가지다. 실패가 저장한 쪽으로 새어 나가면 저장 성공이 실패처럼 보인다.
it('OS 요청이 거절해도 던지지 않는다', async () => {
  await recordFirstLaunch(new Date(START.getTime() - 4 * DAY_MS))
  request.mockRejectedValue(new Error('할당량'))

  await saves(4)
  await jest.advanceTimersByTimeAsync(2_000)

  expect(request).toHaveBeenCalledTimes(1)
})
