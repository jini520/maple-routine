import { useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'

import { queryClient } from '../features/query/client'

/**
 * 화면에 포커스가 올 때 만료된 쿼리만 다시 받는 훅. 탭 화면은 한 번 마운트되면 살아 있어 마운트의 자동 조회가 다시
 * 돌지 않는다. 10분 안의 탭 이동은 캐시로 끝난다.
 *
 * @param queryKey 다시 받을 쿼리. 앞부분만 줘도 그 아래 전부다
 */
export function useRefetchStaleOnFocus(queryKey: readonly unknown[]): void {
  const key = JSON.stringify(queryKey)
  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({ queryKey: JSON.parse(key) as unknown[], stale: true, type: 'active' })
    }, [key]),
  )
}
