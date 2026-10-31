/**
 * 쿼리 캐시를 기기에 두는 저장기. `meta.persist` 가 참인 쿼리만 쓴다.
 *
 * 기기 DB 를 읽은 쿼리는 저장하지 않는다. 원본이 SQLite 라 저장하면 같은 기록이 두 벌이 되고, 둘이 어긋날 때 무엇이
 * 맞는지 가를 수 없다.
 *
 * 저장소 실패는 삼킨다. 캐시는 다음 조회가 다시 채우는 값이라, 못 썼다고 화면이 서지 않으면 안 된다.
 */
import type { Query } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'

import { getQueryCache, removeQueryCache, setQueryCache } from '../../storage/query-cache'

/**
 * 저장된 캐시의 모양 판. 정규화 모양을 바꾸면 올려서 옛 캐시를 버린다. 맞지 않는 모양을 읽어 화면이 깨지는 것보다
 * 한 번 다시 받는 것이 낫다.
 */
export const QUERY_CACHE_BUSTER = '1'

const STORAGE_KEY = 'query-cache'

let stopped = false

/** 더는 표에 쓰지 않게 멈추는 함수. 데이터 삭제가 `query_cache` 를 지우기 전에 부른다. 앱을 다시 띄우면 풀린다. */
export function stopQueryPersist(): void {
  stopped = true
}

export function shouldPersistQuery(query: Query): boolean {
  return query.meta?.persist === true && query.state.status === 'success'
}

export function createQueryPersistOptions(): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister: createAsyncStoragePersister({
      key: STORAGE_KEY,
      storage: {
        getItem: (key) => getQueryCache(key).catch(() => null),
        setItem: async (key, value) => {
          if (!stopped) await setQueryCache(key, value).catch(() => undefined)
        },
        removeItem: (key) => removeQueryCache(key).catch(() => undefined),
      },
    }),
    buster: QUERY_CACHE_BUSTER,
    // 오래된 데이터도 그 시각과 함께 그린다. 버리면 오프라인이나 점검 중에 켠 화면이 빈다.
    maxAge: Number.POSITIVE_INFINITY,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  }
}

let resolveRestored: (() => void) | null = null
const restored = new Promise<void>((resolve) => {
  resolveRestored = resolve
})

/** 저장된 캐시를 다 올렸다고(또는 못 올렸다고) 알린다. 복원이 끝나기 전에 읽는 화면 밖 코드가 이것을 기다린다. */
export function markQueryCacheRestored(): void {
  resolveRestored?.()
  resolveRestored = null
}

export function whenQueryCacheRestored(): Promise<void> {
  return restored
}
