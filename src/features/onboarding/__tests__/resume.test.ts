import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getAuthConfigMock } = vi.hoisted(() => ({
  getAuthConfigMock: vi.fn(),
}))

const { getTrackedCharacterOcidsMock } = vi.hoisted(() => ({
  getTrackedCharacterOcidsMock: vi.fn(),
}))

const { getTrackingModeMock, setTrackingModeMock } = vi.hoisted(() => ({
  getTrackingModeMock: vi.fn(),
  setTrackingModeMock: vi.fn(),
}))

vi.mock('../../../storage/api-key', () => ({
  getAuthConfig: getAuthConfigMock,
}))

vi.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: getTrackedCharacterOcidsMock,
}))

vi.mock('../../../storage/tracking-mode', () => ({
  getTrackingMode: getTrackingModeMock,
  setTrackingMode: setTrackingModeMock,
}))

import { deriveResumeTarget } from '../resume'

beforeEach(() => {
  // 기본값 = 온보딩을 끝까지 마친 상태
  getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: 'acc-1' })
  getTrackingModeMock.mockResolvedValue('auto')
  getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
  setTrackingModeMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetAllMocks()
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

  it('selectedAccountId가 없으면 selectingAccount이고, 재조회에 쓸 키를 실어 보낸다', async () => {
    getAuthConfigMock.mockResolvedValue({ apiKey: 'key-1', selectedAccountId: null })

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'selectingAccount',
      apiKey: 'key-1',
    })
    expect(getTrackingModeMock).not.toHaveBeenCalled()
  })

  it('trackingMode를 고르지 않았으면 selectingTrackingMode다 — 자동으로 확정하지 않는다', async () => {
    getTrackingModeMock.mockResolvedValue(null)
    getTrackedCharacterOcidsMock.mockResolvedValue(null)

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'selectingTrackingMode',
      selectedAccountId: 'acc-1',
    })
    expect(setTrackingModeMock).not.toHaveBeenCalled()
  })

  it('추적 캐릭터가 null이면 selectingContentCharacters다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue(null)

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'selectingContentCharacters',
      selectedAccountId: 'acc-1',
    })
  })

  it('추적 캐릭터가 빈 배열이어도 미완료로 본다 — 0명은 사용자 의도가 아니다', async () => {
    getTrackedCharacterOcidsMock.mockResolvedValue([])

    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'selectingContentCharacters',
      selectedAccountId: 'acc-1',
    })
  })

  it('네 단계를 모두 마쳤으면 completed다', async () => {
    await expect(deriveResumeTarget()).resolves.toEqual({
      status: 'completed',
      selectedAccountId: 'acc-1',
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
      selectedAccountId: 'acc-1',
    })
    expect(setTrackingModeMock).toHaveBeenCalledTimes(1)
    expect(setTrackingModeMock).toHaveBeenCalledWith('auto')
  })
})
