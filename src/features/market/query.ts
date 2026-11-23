/**
 * 드롭 시세 쿼리 셋. 값은 모든 앱이 같은 서버 응답이고, 앱은 받은 응답을 그대로 둔다.
 *
 * 기기에 저장된다(`persist`). 앱을 켜면 남긴 응답으로 먼저 그리고 새 응답이 오면 바꾼다. 남기지 않으면 켤 때마다 받을
 * 때까지 today 위젯이 빈다. 응답과 함께 ETag 를 두고 다음에 보내, 바뀐 것이 없으면 서버가 몸 없이 304 로 끝낸다.
 *
 * `staleTime` 이 0 이라 보는 화면이 포커스될 때마다 다시 묻는다. 서버가 KST 0시 뒤에 전날 값을 내므로 날이 바뀐 뒤 처음
 * 보는 순간 새 값이 온다. 실패하면 던져서 든 값을 지킨다.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import {
  fetchMarketItem,
  fetchMarketItems,
  fetchMaspi,
  type MarketFetch,
  type MarketItemResponse,
  type MarketItemsResponse,
  type MarketItemTarget,
  type MaspiResponse,
} from '../../server/market'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'

/** 쿼리에 두는 값. `body` 가 `null` 이면 서버에 그 시세가 없다(404) */
export interface StoredMarket<T> {
  etag: string | null
  body: T | null
}

const META = { persist: true, source: 'server' } as const

async function receive<T>(queryKey: readonly unknown[], fetcher: (etag: string | null) => Promise<MarketFetch<T> | null>): Promise<StoredMarket<T>> {
  const held = queryClient.getQueryData<StoredMarket<T>>(queryKey)
  const result = await fetcher(held?.etag ?? null)
  if (result === null) throw new Error('시세를 받지 못했다')
  if (result.kind === 'not-modified') {
    // ETag 는 가진 응답이 있을 때만 보내므로 304 면 든 값이 있다.
    if (held === undefined) throw new Error('가진 응답 없이 304 를 받았다')
    return held
  }
  if (result.kind === 'missing') return { etag: null, body: null }
  return { etag: result.etag, body: result.body }
}

export function maspiOptions() {
  const queryKey = queryKeys.marketMaspi()
  return queryOptions<StoredMarket<MaspiResponse>>({
    queryKey,
    queryFn: () => receive(queryKey, fetchMaspi),
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    meta: META,
  })
}

export function marketItemsOptions(world: string) {
  const queryKey = queryKeys.marketItems(world)
  return queryOptions<StoredMarket<MarketItemsResponse>>({
    queryKey,
    queryFn: () => receive(queryKey, (etag) => fetchMarketItems(world, etag)),
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    meta: META,
  })
}

export function marketItemOptions(target: MarketItemTarget) {
  const queryKey = queryKeys.marketItem(target.itemKey, target.world)
  return queryOptions<StoredMarket<MarketItemResponse>>({
    queryKey,
    queryFn: () => receive(queryKey, (etag) => fetchMarketItem(target, etag)),
    staleTime: 0,
    refetchOnWindowFocus: 'always',
    meta: META,
  })
}

/**
 * MASPI. `undefined` 는 남긴 응답도 없고 아직 받지 못했다는 뜻이다. 그때 위젯과 카드는 `0.00` 과 평평한 선을 그린다.
 */
export function useMaspi(): MaspiResponse | undefined {
  return useQuery(maspiOptions()).data?.body ?? undefined
}

/**
 * 고른 월드의 목록. `undefined` 는 아직 모른다(첫 조회 중)이고, `null` 은 그 월드에 시세가 없다는 답이다.
 * 받기에 실패했는데 든 값도 없으면 `null` 로 본다. 빈 상태가 영영 스피너로 남지 않게 하려는 것이다.
 */
export function useMarketItems(world: string | null): MarketItemsResponse | null | undefined {
  const query = useQuery({ ...marketItemsOptions(world ?? ''), enabled: world !== null })
  if (query.data !== undefined) return query.data.body
  return query.isError ? null : undefined
}

/** 시세 하나. `undefined` · `null` 의 뜻은 `useMarketItems` 와 같다. */
export function useMarketItem(target: MarketItemTarget): MarketItemResponse | null | undefined {
  const query = useQuery(marketItemOptions(target))
  if (query.data !== undefined) return query.data.body
  return query.isError ? null : undefined
}
