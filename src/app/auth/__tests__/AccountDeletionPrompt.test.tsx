// 삭제를 예약한 계정으로 다시 들어온 사람에게 묻는 모달. 스토어는 `setState` 로 몰고, 서버에 묻는 함수만 갈아 끼운다.
import { fireEvent, waitFor } from '@testing-library/react-native'

import { useAuthStore } from '../../../features/auth/store'
import { initialAuthState } from '../../../features/auth/state'
import { renderOverlay } from '../../../components/__tests__/render-atom'
import { AccountDeletionPrompt } from '../AccountDeletionPrompt'

jest.mock('../../../features/auth/account-deletion', () => ({
  ...jest.requireActual('../../../features/auth/account-deletion'),
  pendingAccountDeletion: jest.fn(),
  cancelPendingAccountDeletion: jest.fn(),
}))
const { pendingAccountDeletion, cancelPendingAccountDeletion } = jest.requireMock(
  '../../../features/auth/account-deletion',
) as Record<string, jest.Mock>

const DELETES_AT = new Date(2026, 11, 4, 12)
let signOut: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  signOut = jest.fn(async () => {})
  useAuthStore.setState({ ...initialAuthState, signOut })
  pendingAccountDeletion.mockResolvedValue(DELETES_AT)
  cancelPendingAccountDeletion.mockResolvedValue(true)
})

describe('AccountDeletionPrompt', () => {
  it('로그인하기 전에는 묻지 않는다', async () => {
    await renderOverlay(<AccountDeletionPrompt />)

    expect(pendingAccountDeletion).not.toHaveBeenCalled()
  })

  // 앱을 켤 때 저장된 수단으로 들어오는 것도, 새로 로그인하는 것도 같은 `signedIn` 으로 온다.
  it('들어오면 예약을 묻고, 있으면 지울 날을 연도까지 보여 준다', async () => {
    const view = await renderOverlay(<AccountDeletionPrompt />)
    useAuthStore.setState({ status: 'signedIn' })

    await waitFor(() => expect(view.getByText('삭제 예정인 계정이에요')).toBeTruthy())
    expect(view.getByText('2026년 12월 4일에 삭제돼요. 계속 쓰려면 삭제를 취소해 주세요.')).toBeTruthy()
  })

  it('예약이 없으면 아무것도 그리지 않는다', async () => {
    pendingAccountDeletion.mockResolvedValue(null)
    const view = await renderOverlay(<AccountDeletionPrompt />)
    useAuthStore.setState({ status: 'signedIn' })

    await waitFor(() => expect(pendingAccountDeletion).toHaveBeenCalled())
    expect(view.queryByTestId('account-deletion-prompt-overlay')).toBeNull()
  })

  it('삭제 취소를 누르면 예약을 비우고 닫는다', async () => {
    const view = await renderOverlay(<AccountDeletionPrompt />)
    useAuthStore.setState({ status: 'signedIn' })
    await waitFor(() => view.getByText('삭제 취소'))

    fireEvent.press(view.getByText('삭제 취소'))

    await waitFor(() => expect(view.queryByTestId('account-deletion-prompt-overlay')).toBeNull())
    expect(cancelPendingAccountDeletion).toHaveBeenCalledTimes(1)
    expect(signOut).not.toHaveBeenCalled()
  })

  // 취소가 안 됐는데 닫으면 사용자는 계속 쓸 수 있다고 알지만 30일 뒤 지워진다.
  it('취소가 서버에 닿지 않으면 닫지 않는다', async () => {
    cancelPendingAccountDeletion.mockResolvedValue(false)
    const view = await renderOverlay(<AccountDeletionPrompt />)
    useAuthStore.setState({ status: 'signedIn' })
    await waitFor(() => view.getByText('삭제 취소'))

    fireEvent.press(view.getByText('삭제 취소'))

    await waitFor(() => expect(cancelPendingAccountDeletion).toHaveBeenCalled())
    expect(view.getByTestId('account-deletion-prompt-overlay')).toBeTruthy()
  })

  it('로그아웃을 누르면 예약을 둔 채 로그아웃한다', async () => {
    const view = await renderOverlay(<AccountDeletionPrompt />)
    useAuthStore.setState({ status: 'signedIn' })
    await waitFor(() => view.getByText('로그아웃'))

    fireEvent.press(view.getByText('로그아웃'))

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
    expect(cancelPendingAccountDeletion).not.toHaveBeenCalled()
  })
})
