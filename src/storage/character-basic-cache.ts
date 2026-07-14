import { Preferences } from '@capacitor/preferences'
import type { CharacterBasicProfile } from '../types'
import { characterBasicCacheIndexKey, characterBasicCacheKey } from './keys'

export interface CachedCharacterBasicEntry {
  profile: CharacterBasicProfile
  cachedAt: string
}

// ADR-017 결정 6: character-basic-cache는 ocid별로 개별 키에 저장돼 있어, "지금까지 캐싱된
// 캐릭터가 누구누구인지" 자체를 조회할 방법이 없었다. 이 인덱스가 그 목록을 별도로 들고 있어
// "캐릭터 관리" 피커가 character/list 응답을 기다리지 않고도 캐싱된 전체 캐릭터로 stub 목록을
// 만들 수 있게 한다.
async function getIndexedOcids(): Promise<string[]> {
  const { value } = await Preferences.get({ key: characterBasicCacheIndexKey() })
  if (value === null) {
    return []
  }

  try {
    return JSON.parse(value) as string[]
  } catch {
    return []
  }
}

async function setIndexedOcids(ocids: string[]): Promise<void> {
  await Preferences.set({ key: characterBasicCacheIndexKey(), value: JSON.stringify(ocids) })
}

// 2026-07-14 정정: 인덱스는 읽고-수정하고-쓰는(read-modify-write) 방식이라, 여러 캐릭터를
// Promise.all로 동시에 캐싱하면(온보딩 예열, 피커의 character/basic 스트리밍 갱신) 락 없이
// 겹쳐 쓰다가 한쪽의 갱신이 다른 쪽에 덮어써져 유실될 수 있었다. 이 프로미스 체인으로 인덱스
// 갱신 구간을 직렬화해 동시 호출이 항상 순차적으로만 인덱스에 반영되도록 한다.
let indexLock: Promise<void> = Promise.resolve()

function withIndexLock(task: () => Promise<void>): Promise<void> {
  const result = indexLock.then(task, task)
  indexLock = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

export async function getCachedCharacterBasic(ocid: string): Promise<CachedCharacterBasicEntry | null> {
  const { value } = await Preferences.get({ key: characterBasicCacheKey(ocid) })
  if (value === null) {
    return null
  }

  try {
    return JSON.parse(value) as CachedCharacterBasicEntry
  } catch {
    return null
  }
}

export async function getAllCachedCharacterBasicOcids(): Promise<string[]> {
  return getIndexedOcids()
}

export async function setCachedCharacterBasic(
  ocid: string,
  entry: CachedCharacterBasicEntry,
): Promise<void> {
  await Preferences.set({ key: characterBasicCacheKey(ocid), value: JSON.stringify(entry) })

  await withIndexLock(async () => {
    const index = await getIndexedOcids()
    if (!index.includes(ocid)) {
      await setIndexedOcids([...index, ocid])
    }
  })
}

export async function clearCachedCharacterBasic(ocid: string): Promise<void> {
  await Preferences.remove({ key: characterBasicCacheKey(ocid) })

  await withIndexLock(async () => {
    const index = await getIndexedOcids()
    await setIndexedOcids(index.filter((id) => id !== ocid))
  })
}
