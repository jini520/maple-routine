import { preferences } from './ports'
import { lastSelectedCharacterKey, trackedCharactersKey } from './keys'

const LEGACY_TRACKED_KEYS = [
  'trackedCharacters:content',
  'trackedCharacters:boss',
  'trackedCharacters:daily',
  'trackedCharacters:weekly',
] as const

const LEGACY_LAST_SELECTED_CONTENT_KEY = 'lastSelectedCharacter:content'
const LEGACY_LAST_SELECTED_BOSS_KEY = 'lastSelectedCharacter:boss'

function parseOcids(value: string | null): string[] | null {
  if (value === null) {
    return null
  }

  try {
    return JSON.parse(value) as string[]
  } catch {
    return null
  }
}

function dedupeByOcid(ocids: string[]): string[] {
  return Array.from(new Set(ocids))
}

// ADR-042 마이그레이션(1회): 화면별로 갈려 있던 추적 목록을 단일 키로 합친다.
// content∪boss뿐 아니라 daily/weekly(ADR-013 이전 설치본)까지 흡수하는 이유 — 통합 후에는
// content 키를 더 이상 쓰지 않아 기존 daily/weekly → content/boss 이관 체인이 끊기므로,
// 그 시대에서 바로 올라오는 설치본의 목록이 통째로 유실된다.
async function runUnifyMigration(): Promise<void> {
  const existing = await preferences.get(trackedCharactersKey())
  if (existing !== null) {
    return
  }

  const legacyLists = await Promise.all(
    LEGACY_TRACKED_KEYS.map(async (key) => parseOcids(await preferences.get(key))),
  )

  if (legacyLists.every((list) => list === null)) {
    return
  }

  const merged = dedupeByOcid(legacyLists.flatMap((list) => list ?? []))
  await preferences.set(trackedCharactersKey(), JSON.stringify(merged))

  const [legacyContentSelected, legacyBossSelected] = await Promise.all([
    preferences.get(LEGACY_LAST_SELECTED_CONTENT_KEY),
    preferences.get(LEGACY_LAST_SELECTED_BOSS_KEY),
  ])
  const lastSelected = legacyContentSelected ?? legacyBossSelected
  if (lastSelected !== null) {
    await preferences.set(lastSelectedCharacterKey(), lastSelected)
  }

  await Promise.all(
    [
      ...LEGACY_TRACKED_KEYS,
      LEGACY_LAST_SELECTED_CONTENT_KEY,
      LEGACY_LAST_SELECTED_BOSS_KEY,
    ].map((key) => preferences.remove(key)),
  )
}

// 마이그레이션은 읽고-수정하고-쓰는 구간이라, 스토어가 추적 목록과 마지막 선택을 Promise.all로
// 동시에 조회하면 락 없이 겹쳐 돌다가 한쪽이 레거시 키를 지운 뒤 다른 쪽이 더 작은 합집합으로
// 덮어쓸 수 있다(character-basic-cache의 인덱스 락과 동일한 문제·동일한 해법).
let migrationLock: Promise<void> = Promise.resolve()

function migrateLegacyCharacterSelection(): Promise<void> {
  const result = migrationLock.then(runUnifyMigration, runUnifyMigration)
  migrationLock = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

export async function getTrackedCharacterOcids(): Promise<string[] | null> {
  await migrateLegacyCharacterSelection()

  const value = await preferences.get(trackedCharactersKey())
  return parseOcids(value)
}

export async function setTrackedCharacterOcids(ocids: string[]): Promise<void> {
  await preferences.set(trackedCharactersKey(), JSON.stringify(ocids))
}

export async function clearTrackedCharacterOcids(): Promise<void> {
  await preferences.remove(trackedCharactersKey())
}

export async function getLastSelectedCharacter(): Promise<string | null> {
  await migrateLegacyCharacterSelection()

  const value = await preferences.get(lastSelectedCharacterKey())
  return value
}

export async function setLastSelectedCharacter(ocid: string): Promise<void> {
  await preferences.set(lastSelectedCharacterKey(), ocid)
}

export async function clearLastSelectedCharacter(): Promise<void> {
  await preferences.remove(lastSelectedCharacterKey())
}
