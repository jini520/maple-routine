
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

// ADR-086 결정 1 재개 파생표 — 부팅(restoreFromStorage)과 키 재입력(submitApiKey)이
// 이 함수 하나를 공유한다(ADR-115 결정 4). 두 벌이 되면 재개 규칙의 진실이 둘이 된다.
describe('deriveResumeTarget', () => {
  it('apiKey가 없으면 awaitingApiKey다', async () => {
    getAuthConfigMock.mockResolvedValue(null)

    await expect(deriveResumeTarget()).resolves.toEqual({ status: 'awaitingApiKey' })
    // 뒤 단계 판정은 읽지도 않는다 — 키가 없으면 재개할 것이 없다.
    expect(getTrackingModeMock).not.toHaveBeenCalled()
    expect(getTrackedCharacterOcidsMock).not.toHaveBeenCalled()
  })

  it('trackingMode를 고르지 않았으면 selectingTrackingMode다 — 자동으로 확정하지 않는다', async () => {
    getTrackingModeMock.mockResolvedValue(null)
    getTrackedCharacterOcidsMock.mockResolvedValue(null)

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'selectingTrackingMode',
    })
    expect(setTrackingModeMock).not.toHaveBeenCalled()
  })

  it('추적 캐릭터가 null이면 selectingContentCharacters다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(null)

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'selectingContentCharacters',
    })
  })

  it('추적 캐릭터가 빈 배열이어도 미완료로 본다 — 0명은 사용자 의도가 아니다', async () => {
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

  // ADR-086 결정 2 마이그레이션(1회): ADR-035 이전 설치본에서 완주한 사용자는 trackingMode 키가
  // 없다 — 그대로 두면 정상 사용자가 온보딩으로 되돌려진다.
  it('trackingMode 키가 없는데 추적 목록이 있으면 auto를 1회 기록하고 completed다', async () => {
    getTrackingModeMock.mockResolvedValue(null)
    getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'completed',
    })
    expect(setTrackingModeMock).toHaveBeenCalledTimes(1)
    expect(setTrackingModeMock).toHaveBeenCalledWith('auto')
  })
})

// ADR-143 결정 8: RN 은 메이플 ID 를 고르지 않는다 — 표에서 **한 행만** 빠지고 나머지는 그대로다.
// 위 describe 가 그대로 'single' 표(웹뷰 앱 회귀 가드)이므로, 여기서는 "무엇이 빠졌고 무엇이
// 안 빠졌는가"를 본다.
describe('deriveResumeTarget — 계정 범위 all', () => {
  beforeEach(() => {
    // 계정을 고른 적이 없는 것이 RN 의 정상 상태다(ADR-143 결정 7).
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

  it('trackingMode를 고르지 않았으면 그대로 selectingTrackingMode다', async () => {
    getTrackingModeMock.mockResolvedValue(null)
    getTrackedCharacterOcidsMock.mockResolvedValue(null)

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'selectingTrackingMode',
    })
    expect(setTrackingModeMock).not.toHaveBeenCalled()
  })

  it('추적 캐릭터가 비어 있으면 그대로 selectingContentCharacters다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue([])

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'selectingContentCharacters',
    })
  })

  // ADR-086 결정 2 마이그레이션은 계정 축과 무관하다 — 범위가 바뀌어도 그대로 돈다.
  it('trackingMode 키가 없는데 추적 목록이 있으면 auto를 1회 기록하고 completed다', async () => {
    getTrackingModeMock.mockResolvedValue(null)
    getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'completed',
    })
    expect(setTrackingModeMock).toHaveBeenCalledTimes(1)
  })

  // 웹뷰 앱을 쓰다 RN 으로 넘어온 설치본에는 이 값이 남아 있다(ADR-143 결정 7 — 지우지 않는다).
  // 읽지 않는 값이라 판정을 바꾸지 않고, 있으면 있는 그대로 실어 보낸다.
  it('저장된 selectedAccountId가 있으면 그 값을 그대로 싣는다 — 판정은 바뀌지 않는다', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1' })

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'completed',
    })
  })
})
