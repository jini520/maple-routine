/**
 * 이 화면이 지금 보이는지. 기기 DB 를 읽는 쿼리가 react-query 의 `subscribed` 로 쓴다. 하단바 탭 화면은 안 보여도 마운트된
 * 채라, 구독을 끊지 않으면 다른 탭에서 기록을 쓸 때마다 다시 읽는다. 내비게이터가 화면마다 값을 넣고(`ScreenQuerySubscription`),
 * 그 밖(모달 · 공급자 · 컴포넌트 테스트)에서는 늘 `true` 다. `features/` 가 내비게이션을 몰라도 되게 컨텍스트로 받는다.
 */
import { createContext, useContext } from 'react'

export const QuerySubscribedContext = createContext(true)

/** 구독하지 않는 동안 무효화된 쿼리는 다시 구독할 때 한 번 읽는다. */
export function useQuerySubscribed(): boolean {
  return useContext(QuerySubscribedContext)
}
