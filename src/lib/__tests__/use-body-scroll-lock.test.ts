// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useBodyScrollLock } from '../use-body-scroll-lock'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('useBodyScrollLock', () => {
  it('마운트되면 body 스크롤을 막는다', () => {
    renderHook(() => useBodyScrollLock())

    expect(document.body.style.overflow).toBe('hidden')
  })

  it('언마운트되면 원래 overflow 값으로 복원한다', () => {
    document.body.style.overflow = 'auto'

    const { unmount } = renderHook(() => useBodyScrollLock())
    expect(document.body.style.overflow).toBe('hidden')

    unmount()

    expect(document.body.style.overflow).toBe('auto')
  })

  it('enabled가 false면 body 스크롤을 막지 않는다', () => {
    renderHook(() => useBodyScrollLock(false))

    expect(document.body.style.overflow).toBe('')
  })

  it('두 모달이 겹쳐 열렸다 순서대로 닫혀도 body 스크롤이 복원된다', () => {
    // 캐릭터 관리 피커 위에 저장 진행률 모달이 겹쳐 열리는 경우의 회귀 테스트.
    document.body.style.overflow = ''

    const picker = renderHook(() => useBodyScrollLock())
    const progress = renderHook(() => useBodyScrollLock())
    expect(document.body.style.overflow).toBe('hidden')

    // 피커가 먼저 언마운트되고 진행률 모달이 나중에 언마운트돼도 잠금이 완전히 풀려야 한다.
    picker.unmount()
    progress.unmount()

    expect(document.body.style.overflow).toBe('')
  })

  it('enabled가 false에서 true로 바뀌면 그때부터 스크롤을 막는다', () => {
    const { rerender } = renderHook(({ enabled }) => useBodyScrollLock(enabled), {
      initialProps: { enabled: false },
    })
    expect(document.body.style.overflow).toBe('')

    rerender({ enabled: true })

    expect(document.body.style.overflow).toBe('hidden')
  })
})
