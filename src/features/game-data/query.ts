/**
 * 게임 데이터 표 열넷을 받고 · 기기에 저장하고 · 바뀌면 다시 그리는 자리. TanStack Query 하나로 한다.
 *
 * 쿼리 하나(`['game-data']`)에 서버 응답 전체를 둔다. `initialData` 가 번들 열넷이라 켜는 순간 표가 서 있고, 켤 때
 * `hydrateGameData` 가 기기 사본을 복원한 뒤 한 번 받는다. 응답은 `null` 이 아닌 칸만 지금 값 위에 덮는다.
 *
 * React 밖의 조회 모듈은 쿼리를 모른다. 쿼리 캐시 구독 하나가 칸을 `lib/game-data/sections` 의 표로 넘기고,
 * 화면은 `useGameTable` 로 칸 하나를 구독한다. 응답이 통째로 와도 안 바뀐 칸은 같은 참조를 지키므로(구조 공유)
 * 바뀐 칸을 그리는 화면만 다시 그린다.
 */
import { QueryClient, queryOptions, useQuery } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'

import { BUNDLED_GAME_DATA, GAME_DATA_CONTRACT, SECTIONS } from '../../lib/game-data/sections'
import { fetchGameData } from '../../server/game-data'
import { createQueryPersister, removeLegacyBossCatalogCopy } from '../../storage/query-persister'
import { GAME_DATA_SECTIONS, type GameData, type GameDataSection } from '../../types/game-data'

/**
 * 앱의 쿼리 클라이언트. 서버 상태가 더 오면 같은 클라이언트에 쿼리를 더한다.
 *
 * 켜 둔 동안은 다시 받지 않는다(`staleTime: Infinity`). 지우지도 않는다(`gcTime: Infinity`). 지워지면 화면이 다시
 * 열릴 때 번들로 돌아간다. 실패는 한 번 다시 시도한다.
 */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: Infinity, staleTime: Infinity, retry: 1 } },
})

const GAME_DATA_KEY = ['game-data'] as const

/**
 * 응답에서 `null` 이 아닌 칸만 지금 값 위에 덮는다. 응답을 못 받으면 던진다. 그래야 다시 시도하고 캐시는
 * 그대로 남는다.
 */
async function fetchGameDataForQuery(): Promise<GameData> {
  const remote = await fetchGameData()
  if (remote === null) throw new Error('게임 데이터를 받지 못했습니다')
  const current = queryClient.getQueryData<GameData>(GAME_DATA_KEY) ?? BUNDLED_GAME_DATA
  const next: Partial<Record<GameDataSection, unknown>> = { ...current }
  for (const key of GAME_DATA_SECTIONS) {
    if (remote[key] !== null) next[key] = remote[key]
  }
  return next as GameData
}

export const gameDataQueryOptions = queryOptions({
  queryKey: GAME_DATA_KEY,
  queryFn: fetchGameDataForQuery,
  initialData: BUNDLED_GAME_DATA,
  // 번들은 언제 받은 것도 아니라 늘 오래된 값이다. 켤 때 한 번 받는 근거다.
  initialDataUpdatedAt: 0,
})

/**
 * 쿼리 캐시의 칸을 표로 넘기는 구독. 복원 · 응답 · 번들 어느 것으로 바뀌어도 표가 따라간다.
 *
 * 캐시 구독은 React 구독보다 먼저 불린다. 그래서 화면이 다시 그릴 때 조회 모듈은 이미 새 표를 읽는다.
 *
 * @returns 구독을 푸는 함수
 */
export function connectGameTables(): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.query.queryKey[0] !== GAME_DATA_KEY[0]) return
    const data = event.query.state.data as GameData | undefined
    if (data === undefined) return
    for (const key of GAME_DATA_SECTIONS) {
      ;(SECTIONS[key].table as { set(next: unknown): void }).set(data[key])
    }
  })
}

/** 지금 살아 있는 구독 둘(캐시 → 표, 캐시 → 사본)을 푸는 함수. 한 번만 켜지만 두 번 켜도 구독이 쌓이지 않게 한다. */
let disconnect: (() => void) | null = null

/**
 * 켤 때 한 번. 기기 사본을 복원한 뒤 서버를 받는다. **던지지 않는다.**
 *
 * 복원이 실패하면 사본을 버리고 번들로 선다. 못 받으면 복원한 값 그대로다. 옛 보스 사본 키는 여기서 지운다.
 */
export async function hydrateGameData(): Promise<void> {
  disconnect?.()
  const disconnectTables = connectGameTables()
  await removeLegacyBossCatalogCopy().catch(() => undefined)

  const [stopPersisting, restored] = persistQueryClient({
    queryClient,
    persister: createQueryPersister(),
    maxAge: Infinity,
    buster: GAME_DATA_CONTRACT,
    // 서버에서 받은 적 없는 번들 값은 저장하지 않는다. 번들은 이미 앱 안에 있다.
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => query.state.status === 'success' && query.state.dataUpdatedAt > 0,
    },
  })
  disconnect = () => {
    disconnectTables()
    stopPersisting()
  }
  await restored.catch(() => undefined)
  // 켤 때는 사본이 아무리 새것이어도 한 번 받는다. 관리 화면에서 고친 값이 그날 기기에 닿는 유일한 때다.
  await queryClient.prefetchQuery({ ...gameDataQueryOptions, staleTime: 0 })
}

/**
 * 표 하나를 구독하는 훅. 그 칸이 바뀔 때만 다시 그린다.
 *
 * 값은 조회 모듈이 읽는 표와 같은 객체다. 화면은 대개 값을 쓰지 않고 다시 그릴 때를 알기 위해 부른다.
 *
 * @example const catalog = useGameTable('bosses')
 */
export function useGameTable<K extends GameDataSection>(section: K): GameData[K] {
  return useQuery({ ...gameDataQueryOptions, select: (data) => data[section] }, queryClient).data
}

/** 테스트 전용. 구독을 풀고 캐시를 비우고 표 열넷을 번들로 되돌린다. */
export function __resetGameDataForTest(): void {
  disconnect?.()
  disconnect = null
  queryClient.clear()
  for (const key of GAME_DATA_SECTIONS) {
    ;(SECTIONS[key].table as { set(next: unknown): void }).set(BUNDLED_GAME_DATA[key])
  }
}
