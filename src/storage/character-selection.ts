import { preferences } from './ports'
import { lastSelectedCharacterKey, representativeCharacterKey, trackedCharactersKey } from './keys'

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

// ADR-143 결정 4: 참조 무결성은 **쓰는 쪽**이 지킨다. 저장된 대표가 새 목록에 없으면 그 키를
// 지운다. 판정을 목록 저장 안에 두는 이유는 대표가 목록을 벗어날 수 있는 순간이 "저장 시점"
// 하나뿐이라서다. 지우고 나면 규칙대로 첫 번째가 (읽는 쪽에서) 임시 대표가 된다.
async function pruneDanglingRepresentative(ocids: string[]): Promise<void> {
  const representative = await preferences.get(representativeCharacterKey())
  if (representative !== null && !ocids.includes(representative)) {
    await preferences.remove(representativeCharacterKey())
  }
}

export async function setTrackedCharacterOcids(ocids: string[]): Promise<void> {
  await preferences.set(trackedCharactersKey(), JSON.stringify(ocids))
  await pruneDanglingRepresentative(ocids)
}

export async function clearTrackedCharacterOcids(): Promise<void> {
  await preferences.remove(trackedCharactersKey())
}

/**
 * 추적 목록과 대표를 **한 호출로** 저장한다(ADR-143 결정 3·4).
 *
 * 호출부가 목록과 대표를 따로 저장하면 그 사이에 둘이 어긋난 상태가 실재한다(대표가 목록에 없는
 * 순간). 목록을 먼저 쓰고 — 그래서 목록 저장이 실패하면 대표도 손대지 않은 채 끝난다. 대표는
 * 그 목록 기준으로만 확정한다. 대표가 `null`이거나 목록에 없으면 키를 지운다.
 */
export async function setCharacterSelection(
  ocids: string[],
  representativeOcid: string | null,
): Promise<void> {
  await setTrackedCharacterOcids(ocids)

  if (representativeOcid !== null && ocids.includes(representativeOcid)) {
    await setRepresentativeCharacter(representativeOcid)
    return
  }

  await clearRepresentativeCharacter()
}

export async function getRepresentativeCharacter(): Promise<string | null> {
  return preferences.get(representativeCharacterKey())
}

export async function setRepresentativeCharacter(ocid: string): Promise<void> {
  await preferences.set(representativeCharacterKey(), ocid)
}

export async function clearRepresentativeCharacter(): Promise<void> {
  await preferences.remove(representativeCharacterKey())
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
