import { useSyncExternalStore } from 'react'

// 진입점이 스플래시를 붙들기 전에는 덮고 있는 것이 없다. 그래서 기본값이 "다 걷혔다" 다. 진입점을 거치지 않는
// 컴포넌트 테스트에서 모달이 그대로 그려지는 것도 이 기본값 덕이다.
let done = true
const listeners = new Set<() => void>()

function setDone(next: boolean): void {
  done = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 진입점이 스플래시를 붙들 때 부르는 함수. 이때부터 `BootSplash` 가 걷힐 때까지 모달을 그리지 않는다. */
export function markBootSplashCovering(): void {
  setDone(false)
}

/** `BootSplash` 가 다 걷혔을 때 부르는 함수. */
export function markBootSplashDone(): void {
  setDone(true)
}

/**
 * 부팅 스플래시가 다 걷혔는지 내는 훅. RN `Modal` 은 따로 창을 띄워 스플래시 위에 그려지므로, 모달은 이 값이 참일 때만 그린다.
 *
 * @example const splashDone = useBootSplashDone()
 */
export function useBootSplashDone(): boolean {
  return useSyncExternalStore(subscribe, () => done)
}
