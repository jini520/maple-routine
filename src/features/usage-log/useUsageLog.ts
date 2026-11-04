/**
 * 앱을 열 때 방문을 적고, 백그라운드로 갈 때와 돌아올 때를 사용 로그에 잇는 훅. 여는 순간에 지난 실행에서 못 보낸 것도 보낸다.
 *
 * 신호는 쿼리의 복귀 재조회와 같은 `focusManager` 하나다. iOS 의 `inactive` 는 거기서 걸러진다.
 *
 * @example useUsageLog()
 */
import { useEffect } from 'react'
import { focusManager } from '@tanstack/react-query'
import { flushUsageEvents } from './flush'
import { usageTracker } from './record'

export function useUsageLog(): void {
  useEffect(() => {
    void usageTracker.start(new Date()).then(() => flushUsageEvents())
    return focusManager.subscribe((focused) => {
      if (focused) void usageTracker.foreground(new Date())
      else void usageTracker.background(new Date()).then(() => flushUsageEvents())
    })
  }, [])
}
