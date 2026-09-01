/**
 * 하단바가 드는 값 **하나** — [[ADR-132]] 결정 10 을 [[ADR-167]] 결정 4 가 줄인 자리.
 *
 * ## 무엇이 남았나
 *
 * 예전에는 `history`·`showGroups`·`lastSub` 셋이었다. 층을 진짜 스택이 들면서([[ADR-167]] 결정 1)
 * 앞의 둘은 존재 이유를 잃었다 — 되돌아갈 단이 실재하므로 기록할 것이 없고, «하위 행인데 되돌아갈
 * 자리가 없는» 상태가 만들어질 길도 없다.
 *
 * `lastSub` 만 남는다. 그룹을 나가면 그 스택 단이 언마운트되므로 **다시 들어갈 자리는 여전히 우리
 * 것**이다. 스택은 «지나온 길» 을 알지 «떠날 때 어디였는지» 를 안 갖는다.
 *
 * ## 왜 zustand 가 아니라 모듈 수준인가
 *
 * 드는 값이 하나이고 읽는 곳도 바 하나다. 이 패키지는 zustand 를 **직접** 의존하지 않으므로
 * (core 가 쓸 뿐이다) 그 하나를 위해 의존성을 늘리는 대신 `useSyncExternalStore` 를 쓴다.
 *
 * ## 뒤로가기 핸들러가 여기 있었다
 *
 * 시스템 뒤로가기가 바의 «층» 을 알아야 해서 바가 자기 뒤로가기를 여기 맡겼다([[ADR-132]] 결정 10).
 * [[ADR-167]] 결정 7 이 그것을 지웠다 — 층이 스택이면 `navigation.canGoBack()` 이 하위 층까지
 * 포함해 참이라 react-navigation 이 알아서 pop 한다. 우리가 알려 줄 것이 없다.
 */

import { useSyncExternalStore } from 'react'

import type { LastSub } from './bar-model'
import { initialBarState } from './bar-model'

function empty(): LastSub {
  // 초기값을 여기서 다시 적지 않는다 — 그 값은 `bar-model.ts` 에서만 온다.
  return initialBarState().lastSub
}

let lastSub: LastSub = empty()
const listeners = new Set<() => void>()

export function getLastSub(): LastSub {
  return lastSub
}

/** 같은 참조면 알리지 않는다 — `rememberSub` 가 «바뀐 것이 없으면 그대로» 를 지키는 짝이다. */
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

/** 테스트 전용. 모듈 수준 상태라 테스트끼리 오염된다 — `beforeEach` 에서 부른다. */
export function resetBarStoreForTests(): void {
  lastSub = empty()
  listeners.clear()
}
