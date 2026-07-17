import { useEffect } from 'react'

// 모달이 열려있는 동안 뒷 페이지(body)가 스크롤되지 않도록 막는다.
// 모달이 겹쳐 열릴 수 있으므로(예: 캐릭터 관리 피커 위에 저장 진행률 모달) 참조 카운팅으로
// 관리한다 — 첫 잠금에서만 원래 overflow를 저장하고, 마지막 잠금이 풀릴 때만 복원한다.
// (잠금마다 각자 저장/복원하면, 겹친 모달의 언마운트 순서에 따라 나중에 언마운트되는 쪽이
//  'hidden'을 원래 값으로 저장해뒀다가 다시 씌워 body가 잠긴 채로 남는 버그가 있었다.)
let lockCount = 0
let originalOverflow = ''

export function useBodyScrollLock(enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    if (lockCount === 0) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    lockCount += 1

    return () => {
      lockCount -= 1
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [enabled])
}
