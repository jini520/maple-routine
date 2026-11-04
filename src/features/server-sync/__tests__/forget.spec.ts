/**
 * 로그아웃 · 계정 삭제가 서버 쪽을 거두는 자리.
 *
 * 여기서 막는 사고는 둘이다. **예약하지 못했는데 예약한 것으로 답하는 것**(그러면 앱이 키를 지워 다시 지울 길이 없다)과
 * **못 보낸 줄이 남아 다음 사람의 신원으로 나가는 것**이다.
 */
import { clearUnsentServerData, requestAccountDeletion } from '../forget'

jest.mock('../../../server/account-deletion', () => ({ deleteMeOnServer: jest.fn() }))
jest.mock('../../../storage/server-sync-queue', () => ({ clearServerSyncQueue: jest.fn() }))
jest.mock('../../../storage/usage-events', () => ({ clearUsageEvents: jest.fn() }))
jest.mock('../../auth/server-identity', () => ({ serverIdentityHeaders: jest.fn() }))

const { deleteMeOnServer } = jest.requireMock('../../../server/account-deletion')
const { clearServerSyncQueue } = jest.requireMock('../../../storage/server-sync-queue')
const { clearUsageEvents } = jest.requireMock('../../../storage/usage-events')
const { serverIdentityHeaders } = jest.requireMock('../../auth/server-identity')

const HEADERS = { 'x-api-key-hash': 'a'.repeat(64) }

beforeEach(() => {
  jest.clearAllMocks()
  serverIdentityHeaders.mockResolvedValue(HEADERS)
  deleteMeOnServer.mockResolvedValue({ outcome: 'sent' })
  clearServerSyncQueue.mockResolvedValue(undefined)
  clearUsageEvents.mockResolvedValue(undefined)
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

describe('clearUnsentServerData', () => {
  it('대기 표와 사용 로그 표를 함께 비운다', async () => {
    await clearUnsentServerData()

    expect(clearServerSyncQueue).toHaveBeenCalledTimes(1)
    expect(clearUsageEvents).toHaveBeenCalledTimes(1)
  })

  it('하나가 터져도 나머지를 비우고 던지지 않는다. 로그아웃을 막지 않는다', async () => {
    clearServerSyncQueue.mockRejectedValue(new Error('저장소가 안 열렸다'))

    await expect(clearUnsentServerData()).resolves.toBeUndefined()
    expect(clearUsageEvents).toHaveBeenCalledTimes(1)
  })
})
