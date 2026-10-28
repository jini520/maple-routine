/**
 * 지금 글자 배수를 담는 한 칸 저장소. `features/text-size/store.ts` 가 쓰고 글자 atom 과 SVG 글자가 읽는다.
 *
 * `components/` 는 `features/` 를 가져오지 못해서 스토어 대신 이 칸을 구독한다. 초기값 1 은 저장된 단계를
 * 읽기 전의 기본 단계다.
 */
import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { useWindowDimensions } from 'react-native'

import { capTextScale } from '../lib/text-size'

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

/** 안쪽 글자만 다른 배수로 그리는 자리. 없으면 `null` 이라 지금 배수를 쓴다. */
const ScopedTextScale = createContext<number | null>(null)

/**
 * 안쪽 글자에 지금 배수 대신 `scale` 을 곱하는 스코프. 글자 크기 페이지가 적용 전의 단계를 보여 줄 때 쓴다.
 *
 * @example <TextScaleScope scale={TEXT_SIZE_SCALE[draft]}>{page}</TextScaleScope>
 */
export function TextScaleScope(props: { scale: number; children: ReactNode }): React.JSX.Element {
  return createElement(ScopedTextScale.Provider, { value: props.scale }, props.children)
}

/** 글자 크기에 곱할 배수. 고른 단계에 화면 폭으로 상한을 걸고, 단계나 폭이 바뀌면 다시 그리게 하는 훅. */
export function useTextScale(): number {
  const { width } = useWindowDimensions()
  const scoped = useContext(ScopedTextScale)
  const current = useSyncExternalStore(subscribe, getTextScale)
  return capTextScale(scoped ?? current, width)
}

/** 테스트 격리용. */
export function __resetTextScaleForTest(): void {
  current = 1
  listeners.clear()
}
