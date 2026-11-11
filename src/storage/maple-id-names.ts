/**
 * 사용자가 바꾼 메이플 ID 이름. Preferences 의 JSON 한 칸(`{ [메이플 ID]: 이름 }`)이다.
 *
 * 바꾼 이름만 든다. 기본 이름은 그릴 때 짓는다. 깨진 값은 빈 값으로 읽는다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export async function getMapleIdNames(): Promise<Record<string, string>> {
  const raw = await preferences.get(STORAGE_KEYS.mapleIdNames)
  if (raw === null) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const names: Record<string, string> = {}
    for (const [mapleId, name] of Object.entries(parsed)) if (typeof name === 'string' && name !== '') names[mapleId] = name
    return names
  } catch {
    return {}
  }
}

export async function setMapleIdNames(names: Readonly<Record<string, string>>): Promise<void> {
  await preferences.set(STORAGE_KEYS.mapleIdNames, JSON.stringify(names))
}
