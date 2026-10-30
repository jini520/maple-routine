/**
 * TanStack Query 캐시의 기기 사본. 저장기(`features/query/persist.ts`)가 캐시 전체를 키 하나의 JSON 으로 쓴다.
 *
 * Preferences 에 두지 않는다. 저장기는 캐시 전체를 자주 다시 쓰는데, iOS `UserDefaults` 는 켤 때 전체를 메모리에
 * 올리고 Android SharedPreferences 는 키 하나를 써도 파일 전체를 다시 쓴다.
 */
import { NEW_UUID_SQL } from './uuid'

export const QUERY_CACHE_BODY = `(
    id TEXT NOT NULL PRIMARY KEY DEFAULT (${NEW_UUID_SQL}),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
  )`
