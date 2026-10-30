/**
 * KST 자정마다 넥슨 쿼리를 무효화하는 공용 타이머 하나. 보고 있는 화면이 있으면 그 자리에서 다시 받는다.
 *
 * 화면마다 타이머를 두면 빠뜨린 화면이 어제에 머문다. 화면이 다시 그릴 때 쓰는 틱도 여기서 낸다. 초기화 시각과
 * 기간 값은 렌더의 `new Date()` 로 정해져서, 다시 렌더되지 않으면 카운트다운이 `0초` 에 멈추고 기간이 지난 기간에
 * 머문다.
 */
import { create } from 'zustand'
import type { QueryClient } from '@tanstack/react-query'

import { nextKstMidnightAfter } from './freshness'

interface ResetBoundaryTickState {
  /** 이 실행에서 자정을 넘긴 횟수. 값 자체는 뜻이 없고 바뀌는 것이 신호다. */
  tick: number
}

export const useResetBoundaryTick = create<ResetBoundaryTickState>()(() => ({ tick: 0 }))

/** 넥슨에서 받은 쿼리. `meta.source` 가 이 값이면 초기화 시각에 무효화된다. */
export const NEXON_QUERY_SOURCE = 'nexon'

/** @returns 타이머를 멈추는 함수 */
export function startResetBoundaryTimer(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const arm = (): void => {
    const now = Date.now()
    timer = setTimeout(() => {
      void client.invalidateQueries({ predicate: (query) => query.meta?.source === NEXON_QUERY_SOURCE })
      useResetBoundaryTick.setState((state) => ({ tick: state.tick + 1 }))
      arm()
    }, nextKstMidnightAfter(now) - now)
  }
  arm()

  return () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
}
