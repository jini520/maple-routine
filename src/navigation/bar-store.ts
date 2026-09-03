/**
 * 하단바가 드는 값 하나(`lastSub`)를 보관하는 모듈 수준 스토어.
 *
 * 그룹을 나가면 그 스택 단이 언마운트되므로 **다시 들어갈 자리는 우리 것**이다. 스택은 지나온
 * 길을 알지 떠날 때 어디였는지를 안 갖는다.
 *
 * zustand 가 아니라 `useSyncExternalStore` 인 것은 드는 값이 하나이고 읽는 곳도 바 하나이며, 이
 * 패키지가 zustand 를 직접 의존하지 않기 때문이다.
 */

import { useSyncExternalStore } from 'react'

import type { LastSub } from './bar-model'
import { initialBarState } from './bar-model'

function empty(): LastSub {
  // 초기값을 여기서 다시 적지 않는다. 그 값은 `bar-model.ts` 에서만 온다.
  return initialBarState().lastSub
}

let lastSub: LastSub = empty()
const listeners = new Set<() => void>()

export function getLastSub(): LastSub {
  return lastSub
}

/** 같은 참조면 알리지 않는 쓰기. `rememberSub` 가 바뀐 것이 없으면 그대로 를 지키는 짝이다. */
export function setLastSub(next: LastSub): void {
  if (next === lastSub) return
  lastSub = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useLastSub(): LastSub {
  return useSyncExternalStore(subscribe, getLastSub, getLastSub)
}

/** 테스트 전용. 모듈 수준 상태라 테스트끼리 오염된다. `beforeEach` 에서 부른다. */
export function resetBarStoreForTests(): void {
  lastSub = empty()
  listeners.clear()
}
