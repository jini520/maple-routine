// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduleSyncError } from '../../schedule-sync/schedule-sync'

const { invalidateApiKeyMock } = vi.hoisted(() => ({ invalidateApiKeyMock: vi.fn() }))

vi.mock('../store', () => ({
  useOnboardingStore: { getState: () => ({ invalidateApiKey: invalidateApiKeyMock }) },
}))

const { useApiKeyInvalidation } = await import('../use-api-key-invalidation')

describe('useApiKeyInvalidation', () => {
  beforeEach(() => {
    invalidateApiKeyMock.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('invalidApiKey면 무효화 경로로 넘긴다', () => {
    renderHook(() => useApiKeyInvalidation({ kind: 'invalidApiKey' }))

    expect(invalidateApiKeyMock).toHaveBeenCalledTimes(1)
  })

  it.each<ScheduleSyncError['kind']>(['rateLimited', 'characterUnavailable', 'network'])(
    '%s는 넘기지 않는다',
    (kind) => {
      renderHook(() => useApiKeyInvalidation({ kind } as ScheduleSyncError))

      expect(invalidateApiKeyMock).not.toHaveBeenCalled()
    },
  )

  it('error가 null이면 넘기지 않는다', () => {
    renderHook(() => useApiKeyInvalidation(null))

    expect(invalidateApiKeyMock).not.toHaveBeenCalled()
  })

  // 이 케이스가 없으면 키를 다시 넣어도 곧바로 튕긴다([[ADR-115]] 결정 6의 재이동 루프 금지).
  // 동기화 스토어의 error는 화면이 언마운트돼도 살아남으므로, 재입력 후 화면이 다시 마운트될 때
  // **같은 객체**가 다시 훅에 들어온다 — 그때 다시 무효화하면 방금 저장한 유효한 키가 지워진다.
  it('이미 넘긴 error 객체는 재마운트해도 다시 넘기지 않는다', () => {
    const staleError: ScheduleSyncError = { kind: 'invalidApiKey' }

    const first = renderHook(() => useApiKeyInvalidation(staleError))
    expect(invalidateApiKeyMock).toHaveBeenCalledTimes(1)
    first.unmount()

    renderHook(() => useApiKeyInvalidation(staleError))

    expect(invalidateApiKeyMock).toHaveBeenCalledTimes(1)
  })

  // 위 가드가 "401이면 평생 한 번"이 되면 안 된다 — 재입력한 키가 또 무효화되는 것은 실제로
  // 일어나는 일이고, 그때는 새 실패이므로 다시 보내야 한다. 스토어가 실패마다 새 객체를 set하는
  // 것이 이 구분의 근거다(use-sync-error-toast 상단 주석과 같은 전제).
  it('새로 만들어진 401 객체는 다시 넘긴다', () => {
    const first = renderHook(() => useApiKeyInvalidation({ kind: 'invalidApiKey' }))
    first.unmount()

    renderHook(() => useApiKeyInvalidation({ kind: 'invalidApiKey' }))

    expect(invalidateApiKeyMock).toHaveBeenCalledTimes(2)
  })
})
