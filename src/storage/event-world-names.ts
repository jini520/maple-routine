/**
 * 이벤트 월드(스페셜) 캐릭터 이름.
 *
 * 수집기가 `character/list` 에서 받아 남기고, 지출을 읽는 쪽이 그대로 쓴다. 칸 하나 그릴 때마다
 * 계정 목록을 부를 수는 없어서다.
 *
 * **없는 것과 빈 집합은 다르다.** 앞은 아직 못 받았다는 뜻이라 `null` 이고, 뒤는 스페셜 캐릭터가
 * 없는 계정이라 답이 난 것이다. 앞을 뒤로 읽으면 스페셜 지출이 그대로 샌다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

/** 아직 못 받았으면 `null`. */
export async function getEventWorldNames(): Promise<Set<string> | null> {
  const raw = await preferences.get(STORAGE_KEYS.eventWorldNames)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    // 상한 값은 **없는 것으로 본다**. 빈 집합으로 읽으면 스페셜이 지출에 섞인다.
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : null
  } catch {
    return null
  }
}

export async function saveEventWorldNames(names: ReadonlySet<string>): Promise<void> {
  await preferences.set(STORAGE_KEYS.eventWorldNames, JSON.stringify([...names]))
}
