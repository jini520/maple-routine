import { useSettingsStore } from '../store'

// 이 스토어에 남은 일은 연결 해제 하나다. 계정 변경 플로우는 폐지됐고, 화면이 사라진 뒤에도
// 남아 있던 액션 넷과 상태 기계를 함께 지웠다.
jest.mock('../../auth/store', () => {
  const signOut = jest.fn()
  return { useAuthStore: { getState: () => ({ signOut }) } }
})
const { useAuthStore } = jest.requireMock('../../auth/store') as {
  useAuthStore: { getState: () => { signOut: jest.Mock } }
}
const signOutMock = useAuthStore.getState().signOut

beforeEach(() => {
  signOutMock.mockClear()
})

describe('useSettingsStore.disconnect', () => {
  it('useAuthStore.getState().signOut을 정확히 1번 호출한다', async () => {
    await useSettingsStore.getState().disconnect()

    expect(signOutMock).toHaveBeenCalledTimes(1)
  })
})
