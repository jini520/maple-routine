import { preferences } from './ports'
import type { CharacterBasicProfile } from '../types'
import {
  characterBasicCacheIndexKey,
  characterBasicCacheKey,
  LEGACY_CHARACTER_BASIC_CACHE_INDEX_KEY,
  STORAGE_KEYS,
} from './keys'

export interface CachedCharacterBasicEntry {
  profile: CharacterBasicProfile
  cachedAt: string
}

// ADR-017 결정 6: character-basic-cache는 ocid별로 개별 키에 저장돼 있어, "지금까지 캐싱된
// 캐릭터가 누구누구인지" 자체를 조회할 방법이 없었다. 이 인덱스가 그 목록을 별도로 들고 있어
// "캐릭터 관리" 피커가 character/list 응답을 기다리지 않고도 캐싱된 전체 캐릭터로 stub 목록을
// 만들 수 있게 한다.
//
// ADR-086 결정 9: 그 인덱스에 **계정 개념이 없어서** 계정을 바꿔도 stub 단계가 이전 계정
// 캐릭터를 먼저 그렸다. 이제 계정별로 나눈다 — 엔트리(characterBasicCache:{ocid}) 자체는 그대로
// 두고 보이는 범위만 좁히므로, 그 계정으로 돌아가면 인덱스가 되살아나 따뜻한 캐시를 재사용한다.
async function getIndexedOcids(accountId: string): Promise<string[]> {
  const value = await preferences.get(characterBasicCacheIndexKey(accountId))
  if (value === null) {
    return []
  }

  try {
    return JSON.parse(value) as string[]
  } catch {
    return []
  }
}

async function setIndexedOcids(accountId: string, ocids: string[]): Promise<void> {
  await preferences.set(characterBasicCacheIndexKey(accountId), JSON.stringify(ocids))
}

// ADR-086 결정 9 마이그레이션(1회): 전역 인덱스를 **레거시 `selectedAccountId`** 의 것으로 이관한다.
// 캐패시터 시절 예열(ADR-016)이 채운 계정은 그것 하나뿐이라 이 이관은 정확하다. 그 값이 없으면
// (RN 에서 시작한 설치본) 이관할 것도 없으므로 미룬다 — 전역 키가 그대로 남아 다음에 다시 시도한다.
async function runLegacyIndexMigration(): Promise<void> {
  const legacy = await preferences.get(LEGACY_CHARACTER_BASIC_CACHE_INDEX_KEY)
  if (legacy === null) {
    return
  }

  const selectedAccountId = await preferences.get(STORAGE_KEYS.legacySelectedAccountId)
  if (selectedAccountId === null) {
    return
  }

  const existing = await getIndexedOcids(selectedAccountId)
  let legacyOcids: string[]
  try {
    legacyOcids = JSON.parse(legacy) as string[]
  } catch {
    legacyOcids = []
  }

  await setIndexedOcids(selectedAccountId, Array.from(new Set([...existing, ...legacyOcids])))
  await preferences.remove(LEGACY_CHARACTER_BASIC_CACHE_INDEX_KEY)
}

// 2026-07-14 정정: 인덱스는 읽고-수정하고-쓰는(read-modify-write) 방식이라, 여러 캐릭터를
// Promise.all로 동시에 캐싱하면(온보딩 예열, 피커의 character/basic 스트리밍 갱신) 락 없이
// 겹쳐 쓰다가 한쪽의 갱신이 다른 쪽에 덮어써져 유실될 수 있었다. 이 프로미스 체인으로 인덱스
// 갱신 구간을 직렬화해 동시 호출이 항상 순차적으로만 인덱스에 반영되도록 한다.
// 마이그레이션도 같은 구간을 건드리므로 같은 락 안에서 돈다.
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
  const value = await preferences.get(characterBasicCacheKey(ocid))
  if (value === null) {
    return null
  }

  try {
    return JSON.parse(value) as CachedCharacterBasicEntry
  } catch {
    return null
  }
}

export async function getAllCachedCharacterBasicOcids(accountId: string): Promise<string[]> {
  await withIndexLock(runLegacyIndexMigration)
  return getIndexedOcids(accountId)
}

export async function setCachedCharacterBasic(
  accountId: string,
  ocid: string,
  entry: CachedCharacterBasicEntry,
): Promise<void> {
  await preferences.set(characterBasicCacheKey(ocid), JSON.stringify(entry))

  await withIndexLock(async () => {
    await runLegacyIndexMigration()
    const index = await getIndexedOcids(accountId)
    if (!index.includes(ocid)) {
      await setIndexedOcids(accountId, [...index, ocid])
    }
  })
}

export async function clearCachedCharacterBasic(accountId: string, ocid: string): Promise<void> {
  await preferences.remove(characterBasicCacheKey(ocid))

  await withIndexLock(async () => {
    const index = await getIndexedOcids(accountId)
    await setIndexedOcids(
      accountId,
      index.filter((id) => id !== ocid),
    )
  })
}
