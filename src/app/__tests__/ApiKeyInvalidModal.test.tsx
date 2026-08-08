// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { confirmApiKeyNoticeMock, storeRef } = vi.hoisted(() => ({
  confirmApiKeyNoticeMock: vi.fn(),
  storeRef: { current: { apiKeyNotice: null } },
}))

vi.mock('../../features/onboarding/store', () => ({
  useOnboardingStore: () => ({
    apiKeyNotice: storeRef.current.apiKeyNotice,
    confirmApiKeyNotice: confirmApiKeyNoticeMock,
  }),
}))

const { ApiKeyInvalidModal } = await import('../ApiKeyInvalidModal')

describe('ApiKeyInvalidModal (ADR-115 결정 10)', () => {
  beforeEach(() => {
    confirmApiKeyNoticeMock.mockClear()
    confirmApiKeyNoticeMock.mockResolvedValue(undefined)
    storeRef.current.apiKeyNotice = null
  })

  afterEach(() => {
    cleanup()
  })

  it('알림이 꺼져 있으면 아무것도 그리지 않는다', () => {
    render(<ApiKeyInvalidModal />)

    expect(screen.queryByTestId('api-key-invalid-overlay')).toBeNull()
  })

  it('알림이 켜지면 원인과 다음에 일어날 일을 함께 말한다', () => {
    storeRef.current.apiKeyNotice = 'invalid'

    render(<ApiKeyInvalidModal />)

    expect(screen.getByText('API 키가 더 이상 유효하지 않습니다')).toBeTruthy()
    expect(screen.getByText('키 입력 화면으로 이동합니다.')).toBeTruthy()
  })

  // 사용자가 이유를 인지하고 넘어가도록 확인을 강제한다 — 확인 전에는 이동도 삭제도 없다.
  it('확인을 눌러야 이동이 일어난다', () => {
    storeRef.current.apiKeyNotice = 'invalid'
    render(<ApiKeyInvalidModal />)
    expect(confirmApiKeyNoticeMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(confirmApiKeyNoticeMock).toHaveBeenCalledTimes(1)
  })

  // 닫을 수 없어야 한다: 무효 키 상태에서는 어느 화면도 제 기능을 못 하므로 돌아갈 곳이 없다.
  it('오버레이를 눌러도 닫히지 않고 취소 버튼도 없다', () => {
    storeRef.current.apiKeyNotice = 'invalid'
    render(<ApiKeyInvalidModal />)

    fireEvent.click(screen.getByTestId('api-key-invalid-overlay'))

    expect(screen.getByText('API 키가 더 이상 유효하지 않습니다')).toBeTruthy()
    expect(confirmApiKeyNoticeMock).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
