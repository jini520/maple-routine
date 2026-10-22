/**
 * 지금 글자 배수를 담는 한 칸 저장소. `features/text-size/store.ts` 가 쓰고 글자 atom 과 SVG 글자가 읽는다.
 *
 * `components/` 는 `features/` 를 가져오지 못해서 스토어 대신 이 칸을 구독한다. 초기값 1 은 저장된 단계를
 * 읽기 전의 기본 단계다.
 */
import { useSyncExternalStore } from 'react'

let current = 1
const listeners = new Set<() => void>()

export function getTextScale(): number {
  return current
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 같은 값이면 알리지 않는다. 고른 단계를 다시 고를 때 앱 전체가 다시 그려지지 않게. */
export function setTextScale(scale: number): void {
  if (scale === current) return
  current = scale
  for (const listener of [...listeners]) listener()
}

/** 글자 크기에 곱할 배수. 설정에서 단계를 바꾸면 그 자리에서 다시 그리게 하는 훅. */
export function useTextScale(): number {
  return useSyncExternalStore(subscribe, getTextScale)
}

/** 테스트 격리용. */
export function __resetTextScaleForTest(): void {
  current = 1
  listeners.clear()
}
