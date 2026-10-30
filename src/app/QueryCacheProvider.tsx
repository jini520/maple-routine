/**
 * 쿼리 캐시를 트리에 주고, 저장된 캐시를 먼저 올린다. 올리는 동안 화면의 쿼리는 기다린다(`useIsRestoring`).
 *
 * 다 올리면 옛 Preferences 캐시를 옮기고 회차를 만료로 표시한 뒤, 복원이 끝났다고 알린다. 예열(`prehydrateTabStores`)이
 * 그 신호를 기다린다. 복원이 실패해도 알린다. 안 알리면 예열이 영영 안 돈다.
 */
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'

import { queryClient } from '../features/query/client'
import { createQueryPersistOptions, markQueryCacheRestored } from '../features/query/persist'
import { onQueryCacheRestored } from '../features/schedule-sync/schedule-query'

const persistOptions = createQueryPersistOptions()

async function handleRestored(): Promise<void> {
  try {
    await onQueryCacheRestored()
  } finally {
    markQueryCacheRestored()
  }
}

export function QueryCacheProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={handleRestored}
      onError={markQueryCacheRestored}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
