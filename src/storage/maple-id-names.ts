/**
 * 사용자가 바꾼 메이플 ID 이름. Preferences 의 JSON 한 칸(`{ [메이플 ID]: 이름 }`)이다.
 *
 * 바꾼 이름만 든다. 기본 이름은 그릴 때 짓는다. 깨진 값은 빈 값으로 읽는다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'
import { enqueueChangedPreferenceRecords, preferenceRecordIdOf } from './server-sync-queue'

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

/** 메이플 ID 마다 대기 줄 하나. */
function recordsOf(names: Readonly<Record<string, string>>): Map<string, string> {
  return new Map(Object.entries(names).map(([mapleId, name]) => [preferenceRecordIdOf('mapleIdNames', [mapleId]), name]))
}

/** 처음 동기화가 넣는 대기 줄 id. 저장 함수가 넣는 것과 같다. */
export async function mapleIdNameSyncRecordIds(): Promise<string[]> {
  return [...recordsOf(await getMapleIdNames()).keys()]
}

/** 바꾸거나 지운 메이플 ID 의 이름을 대기 표에 넣는다. */
export async function setMapleIdNames(names: Readonly<Record<string, string>>): Promise<void> {
  const before = await getMapleIdNames()
  await preferences.set(STORAGE_KEYS.mapleIdNames, JSON.stringify(names))
  await enqueueChangedPreferenceRecords('mapleIdNames', recordsOf(before), recordsOf(names))
}
