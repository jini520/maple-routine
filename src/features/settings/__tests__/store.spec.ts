import { useSettingsStore } from '../store'

// 이 스토어에 남은 일은 연결 해제 하나다 — 계정 변경 플로우([[ADR-086]] 결정 6)는 [[ADR-143]]
// 결정 7 이 폐지했고, 화면이 사라진 뒤에도 남아 있던 액션 넷과 상태 기계를 함께 지웠다.
jest.mock('../../onboarding/store', () => {
  const reset = jest.fn()
  return { useOnboardingStore: { getState: () => ({ reset }) } }
})
const { useOnboardingStore } = jest.requireMock('../../onboarding/store') as {
  useOnboardingStore: { getState: () => { reset: jest.Mock } }
}
const onboardingResetMock = useOnboardingStore.getState().reset

beforeEach(() => {
  onboardingResetMock.mockClear()
})

describe('useSettingsStore.disconnect', () => {
  it('useOnboardingStore.getState().reset을 정확히 1번 호출한다', async () => {
    await useSettingsStore.getState().disconnect()

    expect(onboardingResetMock).toHaveBeenCalledTimes(1)
  })
})
