
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

import { deriveResumeTarget } from '../resume'

beforeEach(() => {
  // 기본값 = 온보딩을 끝까지 마친 상태
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1' })
  getTrackingModeMock.mockResolvedValue('auto')
  getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
  setTrackingModeMock.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.resetAllMocks()
})

// 재개 파생표. 부팅(restoreFromStorage)과 키 재입력(submitApiKey)이
// 이 함수 하나를 공유한다. 두 벌이 되면 재개 규칙의 진실이 둘이 된다.
describe('deriveResumeTarget', () => {
  it('apiKey가 없으면 awaitingApiKey다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    await expect(deriveResumeTarget()).resolves.toEqual({ status: 'awaitingApiKey' })
    // 뒤 단계 판정은 읽지도 않는다. 키가 없으면 재개할 것이 없다.
    expect(getTrackedCharacterOcidsMock).not.toHaveBeenCalled()
  })

  // 이 게이트가 trackingMode 의 null 과 'auto' 를 구분하던 유일한 자리였다. 단계가 없어지면서
  // 구분에 소비자가 남지 않으므로 읽지도 쓰지도 않는다.
  it('trackingMode를 읽지도 쓰지도 않는다', async () => {
    getTrackingModeMock.mockResolvedValue(null)
    getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])

    await expect(deriveResumeTarget()).resolves.toEqual({ status: 'completed' })
    expect(getTrackingModeMock).not.toHaveBeenCalled()
    expect(setTrackingModeMock).not.toHaveBeenCalled()
  })

  it('추적 캐릭터가 null이면 selectingContentCharacters다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(null)

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'selectingContentCharacters',
    })
  })

  it('추적 캐릭터가 빈 배열이어도 미완료로 본다. 0명은 사용자 의도가 아니다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue([])

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'selectingContentCharacters',
    })
  })

  it('네 단계를 모두 마쳤으면 completed다', async () => {
    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'completed',
    })
    expect(setTrackingModeMock).not.toHaveBeenCalled()
  })

  // 옛 설치본 완주자(trackingMode 키 없음 + 추적 목록 있음)를 위한 1회성 기록이 있었다. 그것이
  // 막던 것은 그들이 새로 생긴 단계로 되돌려지는 일뿐이라, 단계가 없어지며 함께 빠졌다.
  it('옛 설치본 완주자도 쓰기 없이 completed다', async () => {
    getTrackingModeMock.mockResolvedValue(null)
    getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'completed',
    })
    expect(setTrackingModeMock).not.toHaveBeenCalled()
  })
})

// RN 은 메이플 ID 를 고르지 않는다. 표에서 **한 행만** 빠지고 나머지는 그대로다.
// 위 describe 가 그대로 'single' 표이므로, 여기서는 "무엇이 빠졌고 무엇이
// 안 빠졌는가"를 본다.
describe('deriveResumeTarget: 계정 범위 all', () => {
  beforeEach(() => {
    // 계정을 고른 적이 없는 것이 RN 의 정상 상태다.
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1' })
  })

  afterEach(() => {
  })

  it('selectedAccountId가 없어도 selectingAccount로 가지 않는다', async () => {
    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'completed',
    })
  })

  it('apiKey가 없으면 그대로 awaitingApiKey다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    await expect(deriveResumeTarget()).resolves.toEqual({ status: 'awaitingApiKey' })
    expect(getTrackingModeMock).not.toHaveBeenCalled()
  })

  it('trackingMode 는 여기서도 안 읽는다', async () => {
    getTrackingModeMock.mockResolvedValue(null)
    getTrackedCharacterOcidsMock.mockResolvedValue(null)

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'selectingContentCharacters',
    })
    expect(getTrackingModeMock).not.toHaveBeenCalled()
  })

  it('추적 캐릭터가 비어 있으면 그대로 selectingContentCharacters다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue([])

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'selectingContentCharacters',
    })
  })

  it('옛 설치본 완주자도 쓰기 없이 completed다', async () => {
    getTrackingModeMock.mockResolvedValue(null)
    getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'completed',
    })
    expect(setTrackingModeMock).not.toHaveBeenCalled()
  })

  // 옛 설치본에는 이 값이 남아 있다(지우지 않는다). 읽지 않는 값이라 판정을 바꾸지 않고,
  // 있으면 있는 그대로 실어 보낸다.
  it('저장된 selectedAccountId가 있으면 그 값을 그대로 싣는다. 판정은 바뀌지 않는다', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1' })

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'completed',
    })
  })
})
