/**
 * 연결 해제가 서버 쪽을 거두는 자리.
 *
 * 여기서 막는 사고는 둘이다. **키를 지운 뒤에 지워 달라고 말하려는 것**(그때는 밝힐 값이 없다)과
 * **대기 줄이 남아 다음 사람의 신원으로 나가는 것**이다.
 */
import { forgetServerData } from '../forget'

jest.mock('../../../server/drop-price', () => ({ deleteMyServerData: jest.fn() }))
jest.mock('../../../storage/server-sync-queue', () => ({ clearServerSyncQueue: jest.fn() }))
jest.mock('../../auth/server-identity', () => ({ serverIdentityHeaders: jest.fn() }))

const { deleteMyServerData } = jest.requireMock('../../../server/drop-price')
const { clearServerSyncQueue } = jest.requireMock('../../../storage/server-sync-queue')
const { serverIdentityHeaders } = jest.requireMock('../../auth/server-identity')

const HEADERS = { 'x-api-key-hash': 'a'.repeat(64) }

beforeEach(() => {
  jest.clearAllMocks()
  serverIdentityHeaders.mockResolvedValue(HEADERS)
  deleteMyServerData.mockResolvedValue({ outcome: 'sent' })
  clearServerSyncQueue.mockResolvedValue(undefined)
})

describe('서버 쪽 거두기', () => {
  it('지금 신원으로 지우기를 보내고 대기 표를 비운다', async () => {
    expect(await forgetServerData()).toBe(true)

    expect(deleteMyServerData).toHaveBeenCalledWith(HEADERS)
    expect(clearServerSyncQueue).toHaveBeenCalledTimes(1)
  })

  it('통신이 실패해도 대기 표는 비운다', async () => {
    // 못 보낸 줄이 다음 사람의 신원으로 나가는 것이 서버에 표본이 남는 것보다 나쁘다.
    deleteMyServerData.mockResolvedValue({ outcome: 'no-response' })

    expect(await forgetServerData()).toBe(false)
    expect(clearServerSyncQueue).toHaveBeenCalledTimes(1)
  })

  it('서버가 거절해도 못 지운 것으로 답한다', async () => {
    // 처리방침이 이 경우에 문의처를 함께 적는 근거다.
    deleteMyServerData.mockResolvedValue({ outcome: 'rejected', status: 401 })

    expect(await forgetServerData()).toBe(false)
  })

  it('밝힐 수단이 없으면 보내지 않고 비우기만 한다', async () => {
    serverIdentityHeaders.mockResolvedValue(null)

    expect(await forgetServerData()).toBe(false)
    expect(deleteMyServerData).not.toHaveBeenCalled()
    expect(clearServerSyncQueue).toHaveBeenCalledTimes(1)
  })

  it('신원을 읽다가 터져도 비우기는 한다', async () => {
    serverIdentityHeaders.mockRejectedValue(new Error('저장소가 안 열렸다'))

    expect(await forgetServerData()).toBe(false)
    expect(clearServerSyncQueue).toHaveBeenCalledTimes(1)
  })

  it('비우기가 터져도 던지지 않는다. 연결 해제를 막지 않는다', async () => {
    clearServerSyncQueue.mockRejectedValue(new Error('저장소가 안 열렸다'))

    await expect(forgetServerData()).resolves.toBe(true)
  })
})
