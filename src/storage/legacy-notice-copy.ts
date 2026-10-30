/**
 * 1.0.12 까지의 공지 사본(Preferences `notices`). 이제 공지는 쿼리 캐시(`query_cache` 표)가 들어 아무도 읽지 않으므로 켤 때
 * 지운다. 남겨 두면 분류 다섯의 응답이 한 JSON 으로 수십 KB 남아 설정을 쓸 때마다 함께 다시 쓰인다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export async function removeLegacyNoticeCopy(): Promise<void> {
  await preferences.remove(STORAGE_KEYS.legacyNotices)
}
