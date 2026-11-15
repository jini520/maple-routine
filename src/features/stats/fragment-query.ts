/**
 * 사냥 수입 카드의 보유 조각을 세는 조각 장부 쿼리. 조각은 사냥 · 정산(수입)과 헥사 강화(지출)로 들고 나므로 두 표의 판이
 * 오르면 다시 읽는다.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import type { StoredFragmentMove } from '../../storage/fragment-ledger'
import { queryKeys } from '../query/keys'
import { useQuerySubscribed } from '../query/subscription'
import { loadFragmentMoves } from './load'

export function fragmentMovesOptions() {
  return queryOptions<StoredFragmentMove[]>({
    queryKey: queryKeys.fragmentMoves(),
    queryFn: loadFragmentMoves,
    staleTime: Number.POSITIVE_INFINITY,
    meta: { tables: ['income_records', 'spend_records'] },
  })
}

/** 아직 못 읽었으면 `null` 이다. */
export function useFragmentMoves(): readonly StoredFragmentMove[] | null {
  const { data } = useQuery({ ...fragmentMovesOptions(), subscribed: useQuerySubscribed() })
  return data ?? null
}
