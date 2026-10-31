/**
 * 부팅 때 옛 Preferences 키를 지우는 한 자리. 끝나면 표식을 두어 다음 부팅부터는 표식만 읽는다.
 *
 * 이제 아무도 읽지 않는 키들이다. 남겨 두면 Preferences 파일이 그만큼 커진 채 설정을 쓸 때마다 함께 다시 쓰인다.
 */
import {
  characterBasicCacheIndexKey,
  LEGACY_CHARACTER_BASIC_CACHE_INDEX_KEY,
  mesoRateCacheKey,
  STORAGE_KEYS,
} from './keys'
import { preferences } from './ports'

const LEGACY_KEYS = new Set<string>([
  STORAGE_KEYS.queryCache,
  STORAGE_KEYS.legacyBossCatalog,
  STORAGE_KEYS.legacyNotices,
  STORAGE_KEYS.eventWorldNames,
  LEGACY_CHARACTER_BASIC_CACHE_INDEX_KEY,
])
const BASIC_INDEX_PREFIX = characterBasicCacheIndexKey('')
const MESO_RATE_PREFIX = mesoRateCacheKey('')

function isLegacyKey(key: string): boolean {
  return LEGACY_KEYS.has(key) || key.startsWith(BASIC_INDEX_PREFIX) || key.startsWith(MESO_RATE_PREFIX)
}

/** 1.0.12 까지의 메소 획득량. 잘못된 값은 뺀다. 폴백 칸의 기본값이 될 값이라 NaN 이 새면 치는 칸이 깨진다. */
export async function readLegacyMesoRates(): Promise<Map<string, number>> {
  const keys = (await preferences.keys()).filter((key) => key.startsWith(MESO_RATE_PREFIX))
  const entries = await Promise.all(
    keys.map(async (key) => [key.slice(MESO_RATE_PREFIX.length), Number((await preferences.get(key)) ?? Number.NaN)] as const),
  )
  return new Map(entries.filter(([, percent]) => Number.isFinite(percent) && percent >= 0))
}

/** 1.0.12 까지의 이벤트 월드 캐릭터 이름. 안 적혔거나 상한 값이면 `null`. 빈 배열로 읽으면 스페셜 지출이 샌다. */
export async function readLegacyEventWorldNames(): Promise<string[] | null> {
  const raw = await preferences.get(STORAGE_KEYS.eventWorldNames)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : null
  } catch {
    return null
  }
}

/**
 * 표식이 없을 때 한 번 도는 정리. 어느 단계든 던지면 표식을 안 두어 다음 부팅이 처음부터 다시 돈다.
 *
 * @param seed 옛 값을 쿼리 캐시로 옮기는 함수. `storage/` 는 쿼리를 몰라 부르는 쪽이 넘긴다
 */
export async function runLegacyCleanupOnce(seed: () => Promise<void>): Promise<void> {
  if ((await preferences.get(STORAGE_KEYS.legacyCleanupDone)) !== null) return
  await seed()
  const keys = await preferences.keys()
  await Promise.all(keys.filter(isLegacyKey).map((key) => preferences.remove(key)))
  await preferences.set(STORAGE_KEYS.legacyCleanupDone, '1')
}
