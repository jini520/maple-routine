/**
 * 다시 로그인한 사람에게 삭제 예약을 묻는 일. 묻지 못하면 사용자는 지운 줄 아는 계정이 그대로 있거나, 계속 쓰려던 계정이 지워진다.
 */
import { cancelPendingAccountDeletion, pendingAccountDeletion } from '../account-deletion'

jest.mock('../../../server/account-deletion', () => ({
  fetchAccountDeletion: jest.fn(),
  cancelAccountDeletion: jest.fn(),
}))
jest.mock('../server-identity', () => ({ serverIdentityHeaders: jest.fn() }))

const { fetchAccountDeletion, cancelAccountDeletion } = jest.requireMock('../../../server/account-deletion')
const { serverIdentityHeaders } = jest.requireMock('../server-identity')

const HEADERS = { authorization: 'Bearer S' }

beforeEach(() => {
  jest.clearAllMocks()
  serverIdentityHeaders.mockResolvedValue(HEADERS)
})

describe('pendingAccountDeletion', () => {
  it('예약이 있으면 지울 날을 돌려준다', async () => {
    fetchAccountDeletion.mockResolvedValue({ deletesAt: '2026-12-04T03:00:00.000Z' })

    await expect(pendingAccountDeletion()).resolves.toEqual(new Date('2026-12-04T03:00:00.000Z'))
    expect(fetchAccountDeletion).toHaveBeenCalledWith(HEADERS)
  })

  // 서버가 꺼졌다고 앱을 막지 않는다. 다음에 앱을 켤 때 다시 묻는다.
  it('예약이 없거나 응답이 없으면 묻지 않는다', async () => {
    fetchAccountDeletion.mockResolvedValue(null)
    await expect(pendingAccountDeletion()).resolves.toBeNull()

    fetchAccountDeletion.mockRejectedValue(new Error('연결 실패'))
    await expect(pendingAccountDeletion()).resolves.toBeNull()
  })

  it('밝힐 수단이 없으면 서버에 묻지 않는다', async () => {
    serverIdentityHeaders.mockResolvedValue(null)

    await expect(pendingAccountDeletion()).resolves.toBeNull()
    expect(fetchAccountDeletion).not.toHaveBeenCalled()
  })
})

describe('cancelPendingAccountDeletion', () => {
  it('서버가 취소를 받았을 때만 true 다', async () => {
    cancelAccountDeletion.mockResolvedValue({ outcome: 'sent' })
    await expect(cancelPendingAccountDeletion()).resolves.toBe(true)

    cancelAccountDeletion.mockResolvedValue({ outcome: 'no-response' })
    await expect(cancelPendingAccountDeletion()).resolves.toBe(false)
  })
})

