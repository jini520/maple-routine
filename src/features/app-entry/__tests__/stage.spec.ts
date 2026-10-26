
jest.mock('../../../storage/api-key', () => ({
  getAuthConfig: jest.fn(),
}))
const { getAuthConfig: getAuthConfigMock } = jest.requireMock('../../../storage/api-key') as Record<string, jest.Mock>

jest.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: jest.fn(),
}))
const { getTrackedCharacterOcids: getTrackedCharacterOcidsMock } = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>

jest.mock('../../../storage/tracking-mode', () => ({
  getTrackingMode: jest.fn(),
  setTrackingMode: jest.fn(),
}))
const { getTrackingMode: getTrackingModeMock, setTrackingMode: setTrackingModeMock } = jest.requireMock('../../../storage/tracking-mode') as Record<string, jest.Mock>

jest.mock('../../../storage/mvp-grade-prefs', () => ({
  getMvpOnboardingPending: jest.fn(),
}))
const { getMvpOnboardingPending: getMvpOnboardingPendingMock } = jest.requireMock('../../../storage/mvp-grade-prefs') as Record<string, jest.Mock>

import { deriveEntryStage } from '../stage'

beforeEach(() => {
  // 기본값 = 앱이 열리는 상태
  getAuthConfigMock.mockResolvedValue({ login: null, apiKeys: [{ type: 'key', id: 'account-key', label: '', value: 'key-1' }] })
  getTrackingModeMock.mockResolvedValue('auto')
  getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
  setTrackingModeMock.mockResolvedValue(undefined)
  getMvpOnboardingPendingMock.mockResolvedValue(false)
})

afterEach(() => {
  jest.resetAllMocks()
})

// 진입 단계 파생표. 부팅(resolveFromStorage)과 로그인 직후(resolveAfterSignIn)가
// 이 함수 하나를 공유한다. 두 벌이 되면 규칙의 진실이 둘이 된다.
describe('deriveEntryStage', () => {
  it('apiKey가 없으면 signIn 이다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    await expect(deriveEntryStage()).resolves.toBe('signIn')
    // 뒤 단계 판정은 읽지도 않는다. 로그인 전이면 볼 것이 없다.
    expect(getTrackedCharacterOcidsMock).not.toHaveBeenCalled()
  })

  // 이 게이트가 trackingMode 의 null 과 'auto' 를 구분하던 유일한 자리였다. 단계가 없어지면서
  // 구분에 소비자가 남지 않으므로 읽지도 쓰지도 않는다.
  it('trackingMode를 읽지도 쓰지도 않는다', async () => {
    getTrackingModeMock.mockResolvedValue(null)
    getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])

    await expect(deriveEntryStage()).resolves.toBe('ready')
    expect(getTrackingModeMock).not.toHaveBeenCalled()
    expect(setTrackingModeMock).not.toHaveBeenCalled()
  })

  it('추적 캐릭터가 null이면 characterSetup 이다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(null)

    await expect(deriveEntryStage()).resolves.toBe('characterSetup')
  })

  it('추적 캐릭터가 빈 배열이어도 미완료로 본다. 0명은 사용자 의도가 아니다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue([])

    await expect(deriveEntryStage()).resolves.toBe('characterSetup')
  })

  // 등급 이력이 없는 것만으로는 온보딩 중인 사용자와 업데이트한 기존 사용자를 못 가른다. 표시로 가른다.
  it('캐릭터 설정을 마치고 MVP 화면에서 꺼졌으면 mvpGrade 다', async () => {
    getMvpOnboardingPendingMock.mockResolvedValue(true)

    await expect(deriveEntryStage()).resolves.toBe('mvpGrade')
  })

  it('둘 다 있으면 ready 다', async () => {
    await expect(deriveEntryStage()).resolves.toBe('ready')
    expect(setTrackingModeMock).not.toHaveBeenCalled()
  })
})
