import { useEffect } from 'react'

// 모달이 열려있는 동안 뒷 페이지(body)가 스크롤되지 않도록 막는다.
export function useBodyScrollLock(enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [enabled])
}
