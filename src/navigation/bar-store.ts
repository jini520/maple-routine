/**
 * 하단바가 드는 **기록** 하나 — [[ADR-132]] 결정 10.
 *
 * ## 왜 zustand 가 아니라 모듈 수준인가
 *
 * 드는 값이 셋뿐이고(`history`·`showGroups`·`lastSub`) 그 값을 읽는 곳도 둘뿐이다 — 바 자신과
 * 시스템 뒤로가기. 이 패키지는 zustand 를 **직접** 의존하지 않으므로(core 가 쓸 뿐이다) 그 하나를
 * 위해 의존성을 늘리는 대신 `useSyncExternalStore` 를 쓴다. 같은 이유로 API 도 셋뿐이다.
 *
 * ## 지금 페이지는 여기 없다
 *
 * 페이지의 진실 공급원은 react-navigation 이다(`bar-model.ts` 머리말). 여기 두면 두 벌이 되고,
 * 두 벌이 되면 «탭은 가계부인데 바는 스케줄» 같은 프레임이 반드시 생긴다.
 *
 * ## 뒤로가기 핸들러를 등록받는 이유
 *
 * 시스템 뒤로가기(`use-root-back`)는 내비게이션 컨테이너 **밖**에 살아서 지금 탭이 무엇인지 모른다.
 * 바는 안다. 그래서 «뒤로 갈 수 있는가 · 뒤로 가라» 둘을 바가 등록하고 훅은 그것만 부른다 —
 * 페이지를 두 곳에서 각자 알아내려 하면 그 둘이 어긋나는 프레임이 생긴다.
 */

import { useSyncExternalStore } from 'react'

import type { BarState } from './bar-model'
import { initialBarState } from './bar-model'

export type BarRecord = Omit<BarState, 'page'>

/**
 * 상태에서 **기록 부분만** 떼어낸다.
 *
 * 페이지는 react-navigation 이 갖고 이 저장소는 나머지만 든다(파일 머리 «지금 페이지는 여기 없다»).
 * 그 분리를 호출부마다 손으로 하면 필드 목록이 두 벌·세 벌이 되고, `BarRecord` 에 필드가 하나 늘 때
 * 어느 호출부가 안 따라왔는지 컴파일러가 말해 주지 않는다.
 */
export function toBarRecord(state: BarState): BarRecord {
  return { history: state.history, showGroups: state.showGroups, lastSub: state.lastSub }
}

export interface BarBackHandler {
  canGoBack(): boolean
  goBack(): void
}

function emptyRecord(): BarRecord {
  // 초기값을 여기서 다시 적지 않는다 — `bar-model.ts` 가 유일한 출처이고, 두 벌이 되면 «앱을 켠
  // 직후» 의 정의가 갈린다.
  return toBarRecord(initialBarState())
}

let record: BarRecord = emptyRecord()
let backHandler: BarBackHandler | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function getBarRecord(): BarRecord {
  return record
}

export function setBarRecord(next: BarRecord): void {
  if (next === record) return
  record = next
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useBarRecord(): BarRecord {
  return useSyncExternalStore(subscribe, getBarRecord, getBarRecord)
}

/** 바가 마운트되며 자기 «뒤로가기» 를 맡긴다. 언마운트에서 `null` 로 되돌린다. */
export function registerBarBackHandler(handler: BarBackHandler | null): void {
  backHandler = handler
}

export function barCanGoBack(): boolean {
  return backHandler?.canGoBack() ?? false
}

export function barGoBack(): void {
  backHandler?.goBack()
}

/** 테스트 전용. 모듈 수준 상태라 테스트끼리 오염된다 — `beforeEach` 에서 부른다. */
export function resetBarStoreForTests(): void {
  record = emptyRecord()
  backHandler = null
  listeners.clear()
}
