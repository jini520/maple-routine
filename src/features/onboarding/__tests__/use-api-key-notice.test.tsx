// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduleSyncError } from '../../schedule-sync/schedule-sync'
import type { ApiKeyNoticeKind } from '../state'

const { noticeApiKeyIssueMock } = vi.hoisted(() => ({ noticeApiKeyIssueMock: vi.fn() }))

vi.mock('../store', () => ({
  useOnboardingStore: { getState: () => ({ noticeApiKeyIssue: noticeApiKeyIssueMock }) },
}))

const { useApiKeyNotice } = await import('../use-api-key-notice')

// ADR-116 결정 1: 원인 둘이 같은 사슬을 탄다 — 넘기는 kind만 갈린다.
const ROUTED: [ScheduleSyncError['kind'], ApiKeyNoticeKind][] = [
  ['invalidApiKey', 'invalid'],
  ['rateLimited', 'rateLimited'],
]

describe('useApiKeyNotice', () => {
  beforeEach(() => {
    noticeApiKeyIssueMock.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it.each(ROUTED)('%s는 %s 알림으로 넘긴다', (kind, noticeKind) => {
    renderHook(() => useApiKeyNotice({ kind } as ScheduleSyncError))

    expect(noticeApiKeyIssueMock).toHaveBeenCalledExactlyOnceWith(noticeKind)
  })

  // 회귀 가드: 이 phase가 더하는 것은 429뿐이라 나머지는 종전대로 토스트 경로에 남는다.
  it.each<ScheduleSyncError['kind']>(['characterUnavailable', 'network'])(
    '%s는 넘기지 않는다',
    (kind) => {
      renderHook(() => useApiKeyNotice({ kind } as ScheduleSyncError))

      expect(noticeApiKeyIssueMock).not.toHaveBeenCalled()
    },
  )

  it('error가 null이면 넘기지 않는다', () => {
    renderHook(() => useApiKeyNotice(null))

    expect(noticeApiKeyIssueMock).not.toHaveBeenCalled()
  })

  // 이 케이스가 없으면 키를 다시 넣어도 곧바로 튕긴다([[ADR-115]] 결정 6의 재이동 루프 금지).
  // 동기화 스토어의 error는 화면이 언마운트돼도 살아남으므로, 재입력 후 화면이 다시 마운트될 때
  // **같은 객체**가 다시 훅에 들어온다 — 그때 다시 알리면 방금 저장한 유효한 키가 지워진다.
  // 429도 같은 함정이다(그쪽도 확인하면 키를 지운다 — [[ADR-116]] 결정 1).
  it.each(ROUTED)('이미 넘긴 %s 객체는 재마운트해도 다시 넘기지 않는다', (kind, noticeKind) => {
    const staleError = { kind } as ScheduleSyncError

    const first = renderHook(() => useApiKeyNotice(staleError))
    expect(noticeApiKeyIssueMock).toHaveBeenCalledExactlyOnceWith(noticeKind)
    first.unmount()

    renderHook(() => useApiKeyNotice(staleError))

    expect(noticeApiKeyIssueMock).toHaveBeenCalledExactlyOnceWith(noticeKind)
  })

  // 위 가드가 "평생 한 번"이 되면 안 된다 — 재입력한 키가 또 무효화되거나 또 429를 맞는 것은
  // 실제로 일어나는 일이고, 그때는 새 실패이므로 다시 보내야 한다. 스토어가 실패마다 새 객체를
  // set하는 것이 이 구분의 근거다(use-sync-error-toast 상단 주석과 같은 전제).
  it.each(ROUTED)('새로 만들어진 %s 객체는 다시 넘긴다', (kind) => {
    const first = renderHook(() => useApiKeyNotice({ kind } as ScheduleSyncError))
    first.unmount()

    renderHook(() => useApiKeyNotice({ kind } as ScheduleSyncError))

    expect(noticeApiKeyIssueMock).toHaveBeenCalledTimes(2)
  })
})
