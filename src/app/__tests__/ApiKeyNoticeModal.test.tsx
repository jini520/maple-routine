// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyNoticeKind } from '../../features/onboarding/state'

const { confirmApiKeyNoticeMock, storeRef } = vi.hoisted(() => ({
  confirmApiKeyNoticeMock: vi.fn(),
  storeRef: { current: { apiKeyNotice: null as ApiKeyNoticeKind | null } },
}))

vi.mock('../../features/onboarding/store', () => ({
  useOnboardingStore: () => ({
    apiKeyNotice: storeRef.current.apiKeyNotice,
    confirmApiKeyNotice: confirmApiKeyNoticeMock,
  }),
}))

const { ApiKeyNoticeModal } = await import('../ApiKeyNoticeModal')

// ADR-116 결정 1 의 문구 표를 그대로 옮긴 것이다 — 이 배열이 계약이고, 다른 step 의 테스트가
// 같은 문자열을 단언한다. 두 원인이 같은 문구로 합쳐지면 여기서 먼저 깨진다.
const CASES: ReadonlyArray<{ kind: ApiKeyNoticeKind; title: string; body: string }> = [
  {
    kind: 'invalid',
    title: 'API 키가 더 이상 유효하지 않습니다',
    body: '키 입력 화면으로 이동합니다.',
  },
  {
    kind: 'rateLimited',
    title: '호출 한도를 초과했습니다',
    body: '서비스 단계 키로 다시 입력해주세요.',
  },
]

describe('ApiKeyNoticeModal (ADR-116 결정 1)', () => {
  beforeEach(() => {
    confirmApiKeyNoticeMock.mockClear()
    confirmApiKeyNoticeMock.mockResolvedValue(undefined)
    storeRef.current.apiKeyNotice = null
  })

  afterEach(() => {
    cleanup()
  })

  it('알림이 꺼져 있으면 아무것도 그리지 않는다', () => {
    render(<ApiKeyNoticeModal />)

    expect(screen.queryByTestId('api-key-notice-overlay')).toBeNull()
  })

  describe.each(CASES)('$kind', ({ kind, title, body }) => {
    // 원인마다 다른 말을 해야 한다 — 무효 키는 "다음에 무슨 일이 일어나는가"를, 429 는 처방을
    // 말한다(ADR-116 결정 1 · ADR-114 결정 4 — 모달은 줄바꿈이 되므로 처방까지 담는 자리다).
    it('원인에 맞는 제목과 본문을 그린다', () => {
      storeRef.current.apiKeyNotice = kind

      render(<ApiKeyNoticeModal />)

      expect(screen.getByText(title)).toBeTruthy()
      expect(screen.getByText(body)).toBeTruthy()
    })

    // 사용자가 이유를 인지하고 넘어가도록 확인을 강제한다 — 확인 전에는 이동도 삭제도 없다.
    it('확인을 눌러야 이동이 일어난다', () => {
      storeRef.current.apiKeyNotice = kind
      render(<ApiKeyNoticeModal />)
      expect(confirmApiKeyNoticeMock).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: '확인' }))

      expect(confirmApiKeyNoticeMock).toHaveBeenCalledTimes(1)
    })

    // 닫을 수 없어야 한다: 저장된 키로는 앞으로 갈 수 없으므로 닫아서 돌아갈 곳이 없다.
    // 429 도 마찬가지다(ADR-116 결정 1 — 사용자 확정).
    it('오버레이를 눌러도 닫히지 않고 버튼은 확인 하나뿐이다', () => {
      storeRef.current.apiKeyNotice = kind
      render(<ApiKeyNoticeModal />)

      fireEvent.click(screen.getByTestId('api-key-notice-overlay'))

      expect(screen.getByText(title)).toBeTruthy()
      expect(confirmApiKeyNoticeMock).not.toHaveBeenCalled()
      expect(screen.getAllByRole('button')).toHaveLength(1)
    })
  })
})
