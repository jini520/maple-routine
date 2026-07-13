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

  it('enabled가 false에서 true로 바뀌면 그때부터 스크롤을 막는다', () => {
    const { rerender } = renderHook(({ enabled }) => useBodyScrollLock(enabled), {
      initialProps: { enabled: false },
    })
    expect(document.body.style.overflow).toBe('')

    rerender({ enabled: true })

    expect(document.body.style.overflow).toBe('hidden')
  })
})
