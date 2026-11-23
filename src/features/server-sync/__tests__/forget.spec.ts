/**
 * 로그아웃 · 계정 삭제가 서버 쪽을 거두는 자리.
 *
 * 여기서 막는 사고는 셋이다. **예약하지 못했는데 예약한 것으로 답하는 것**(그러면 앱이 키를 지워 다시 지울 길이 없다), **못 보낸
 * 사용 로그가 남아 다음 사람의 신원으로 나가는 것**, **올리지 못한 기록을 로그아웃이 버리는 것**이다.
 */
import { clearUnsentUsageEvents, requestAccountDeletion, syncBeforeSignOut } from '../forget'

jest.mock('../../../server/account-deletion', () => ({ deleteMeOnServer: jest.fn() }))
jest.mock('../../../storage/usage-events', () => ({ clearUsageEvents: jest.fn() }))
jest.mock('../../auth/server-identity', () => ({ serverIdentityHeaders: jest.fn() }))
jest.mock('../kick', () => ({ kickServerSync: jest.fn() }))

const { deleteMeOnServer } = jest.requireMock('../../../server/account-deletion')
const { clearUsageEvents } = jest.requireMock('../../../storage/usage-events')
const { serverIdentityHeaders } = jest.requireMock('../../auth/server-identity')
const { kickServerSync } = jest.requireMock('../kick')

const HEADERS = { 'x-api-key-hash': 'a'.repeat(64) }

beforeEach(() => {
  jest.clearAllMocks()
  serverIdentityHeaders.mockResolvedValue(HEADERS)
  deleteMeOnServer.mockResolvedValue({ outcome: 'sent' })
  clearUsageEvents.mockResolvedValue(undefined)
  kickServerSync.mockResolvedValue(undefined)
})

describe('requestAccountDeletion', () => {
  it('지금 신원으로 계정 삭제를 보내고, 서버가 받았을 때만 true 다', async () => {
    await expect(requestAccountDeletion()).resolves.toBe(true)
    expect(deleteMeOnServer).toHaveBeenCalledWith(HEADERS)

    deleteMeOnServer.mockResolvedValue({ outcome: 'no-response' })
    await expect(requestAccountDeletion()).resolves.toBe(false)

    deleteMeOnServer.mockResolvedValue({ outcome: 'rejected', status: 500 })
    await expect(requestAccountDeletion()).resolves.toBe(false)
  })

  it('밝힐 수단이 없거나 읽다가 터지면 보내지 않고 false 다', async () => {
    serverIdentityHeaders.mockResolvedValue(null)
    await expect(requestAccountDeletion()).resolves.toBe(false)

    serverIdentityHeaders.mockRejectedValue(new Error('저장소가 안 열렸다'))
    await expect(requestAccountDeletion()).resolves.toBe(false)
    expect(deleteMeOnServer).not.toHaveBeenCalled()
  })
})

// 남은 줄은 같은 사람이 다시 로그인하면 올라가고, 다른 사람이 로그인하면 버릴지 묻는다.
describe('syncBeforeSignOut', () => {
  it('동기화를 한 번 돌려 끝나기를 기다린다', async () => {
    let finish: () => void = () => {}
    kickServerSync.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
    let done = false

    const syncing = syncBeforeSignOut().then(() => {
      done = true
    })
    await Promise.resolve()
    expect(done).toBe(false)

    finish()
    await syncing
    expect(kickServerSync).toHaveBeenCalledTimes(1)
  })

  // 처음 동기화의 받기 중이면 100쪽까지 받아 로그아웃이 오래 멈춘다. 남은 줄은 대기 표에 남는다.
  it('10초가 지나면 동기화를 더 기다리지 않는다', async () => {
    jest.useFakeTimers()
    try {
      kickServerSync.mockReturnValue(new Promise<void>(() => {}))
      let done = false

      const syncing = syncBeforeSignOut().then(() => {
        done = true
      })
      await jest.advanceTimersByTimeAsync(9_999)
      expect(done).toBe(false)
      await jest.advanceTimersByTimeAsync(1)
      await syncing
      expect(done).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })

  it('동기화가 터져도 던지지 않는다. 로그아웃을 막지 않는다', async () => {
    kickServerSync.mockRejectedValue(new Error('저장소가 안 열렸다'))

    await expect(syncBeforeSignOut()).resolves.toBeUndefined()
  })
})

describe('clearUnsentUsageEvents', () => {
  it('사용 로그 표를 비운다', async () => {
    await clearUnsentUsageEvents()

    expect(clearUsageEvents).toHaveBeenCalledTimes(1)
  })

  it('터져도 던지지 않는다. 로그아웃을 막지 않는다', async () => {
    clearUsageEvents.mockRejectedValue(new Error('저장소가 안 열렸다'))

    await expect(clearUnsentUsageEvents()).resolves.toBeUndefined()
  })
})
