/**
 * 앱 전체의 쿼리 캐시 하나. 화면은 같은 열쇠로 같은 사본을 본다.
 *
 * React 밖에서 읽고 쓰는 코드(회차 · 저장 · 예열)는 이 인스턴스를 직접 쓴다. 화면 훅은 `QueryClientProvider` 로
 * 같은 인스턴스를 받는다.
 */
import { QueryClient } from '@tanstack/react-query'

import { installAppStateFocus } from './app-focus'
import { startRecordInvalidation } from './invalidation'
import { startResetBoundaryTimer } from './reset-timer'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 넥슨 · 서버 실패는 종류마다 처방이 달라 화면이 가른다. 세 번 다시 부르면 429 를 셀프로 만든다.
      retry: false,
      // 보는 화면이 없어도 캐시를 버리지 않는다. 저장된 캐시를 복원해 두고 5분 뒤 지우면 복원이 헛일이 된다.
      gcTime: Number.POSITIVE_INFINITY,
      // 돌아올 때 다시 받는 것은 넥슨 · 서버 쿼리가 각자 켠다. 기기 DB 읽기는 표의 판이 오를 때 무효화된다.
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * 앱 복귀 · KST 자정 · 표의 판을 캐시에 잇는다. 포트 주입 뒤, 첫 렌더 전에 한 번 부른다.
 *
 * @returns 셋을 떼는 함수. 테스트가 쓴다
 */
export function startQueryRuntime(): () => void {
  const stopFocus = installAppStateFocus()
  const stopTimer = startResetBoundaryTimer(queryClient)
  const stopInvalidation = startRecordInvalidation(queryClient)
  return () => {
    stopFocus()
    stopTimer()
    stopInvalidation()
  }
}
