/**
 * 게임 데이터 표의 기기 사본. TanStack Query 의 캐시 전체를 Preferences 키 하나(`queryCache`)에 문자열 하나로 둔다.
 *
 * 저장소 플러그인을 직접 부르지 않고 `preferences` 포트 위에 선다. 쓰기는 persister 가 1초에 한 번으로 묶는다.
 * 계약이 바뀌어 옛 사본을 못 읽게 되면 `features/game-data/query` 가 `GAME_DATA_CONTRACT` 로 통째로 버린다.
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export function createQueryPersister(): ReturnType<typeof createAsyncStoragePersister> {
  return createAsyncStoragePersister({
    storage: {
      getItem: (key) => preferences.get(key),
      setItem: (key, value) => preferences.set(key, value),
      removeItem: (key) => preferences.remove(key),
    },
    key: STORAGE_KEYS.queryCache,
  })
}

/** 1.0.12+3 까지 보스 표만 들던 기기 사본. 이제 아무도 읽지 않으므로 켤 때 한 번 지운다. */
export async function removeLegacyBossCatalogCopy(): Promise<void> {
  await preferences.remove(STORAGE_KEYS.legacyBossCatalog)
}
