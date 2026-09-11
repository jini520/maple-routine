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

// 마이그레이션(1회): 화면별로 갈려 있던 추적 목록을 단일 키로 합친다.
// content∪boss뿐 아니라 daily/weekly(이전 설치본)까지 흡수하는 이유. 통합 후에는
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

// 참조 무결성은 **쓰는 쪽**이 지킨다. 저장된 대표가 새 목록에 없으면 그 키를
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
 * 추적 목록과 대표를 한 호출로 하는 저장.
 *
 * 호출부가 목록과 대표를 따로 저장하면 그 사이에 둘이 어긋난 상태가 실재한다(대표가 목록에 없는
 * 순간). 목록을 먼저 쓰고. 그래서 목록 저장이 실패하면 대표도 손대지 않은 채 끝난다. 대표는
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

/**
 * 월드 이전으로 ocid 가 바뀐 캐릭터를 **추적 목록에서 갈아끼운다**.
 *
 * 사용자가 확인 모달에서 그렇다고 답할 때만 불린다. 앱이 스스로 부르는 자리는 없다.
 *
 * 바뀌는 것은 **추적 목록의 그 자리와, 옛 ocid 를 가리키던 포인터 둘**뿐이다. 기록
 * (`boss_profit_records`)·프로필 스냅샷·조회 원장은 안 건드린다. 챌린저스에서 만들어진 기록은
 * 챌린저스 기록으로 남아야 하고, 보스 수익 화면은 `추적 목록 ∪ 기록을 남긴 캐릭터` 를 그리므로
 * 추적에서 빠져도 과거 카드가 안 사라진다.
 *
 * **자리를 지킨다.** 빼고 뒤에 붙이면 사용자가 끌어서 맞춰 둔 순서가 그 캐릭터만 맨 아래로
 * 떨어진다.
 *
 * 새 ocid 가 이미 목록에 있으면(모달을 띄워 둔 채 손으로 추가한 경우) 옛 자리만 빼고 중복을
 * 안 만든다. 같은 ocid 가 두 번 서면 격자 키가 겹쳐 행 하나가 조용히 사라진다.
 *
 * **바뀐 목록을 돌려준다.** 저장소만 고치면 화면은 스토어가 든 옛 목록을 그대로 보여 주고,
 * 그 상태에서 저장을 누르면 방금 뺀 ocid 가 다시 쓰인다. 호출부가 이 값을 앱 상태에 전파해야
 * 한다. 할 일이 없었으면 `null`.
 */
export async function replaceTrackedCharacter(
  oldOcid: string,
  newOcid: string,
): Promise<string[] | null> {
  const tracked = await getTrackedCharacterOcids()
  if (tracked === null || !tracked.includes(oldOcid)) {
    return null
  }

  // **포인터를 목록보다 먼저 읽는다.** `setTrackedCharacterOcids` 안의
  // `pruneDanglingRepresentative` 가 새 목록에 없는 대표를 지우므로, 쓰고 나서 읽으면 옛 대표가
  // 이미 `null` 이라 옮길 대상을 잃는다.
  const wasRepresentative = (await getRepresentativeCharacter()) === oldOcid
  const wasLastSelected = (await getLastSelectedCharacter()) === oldOcid

  const replaced = [...new Set(tracked.map((ocid) => (ocid === oldOcid ? newOcid : ocid)))]
  // 쓰기는 목록이 먼저다. 대표를 앞세우면 목록 저장이 실패했을 때 목록에 없는 대표가 남는다
  // (`setCharacterSelection` 과 같은 순서).
  await setTrackedCharacterOcids(replaced)

  if (wasRepresentative) {
    await setRepresentativeCharacter(newOcid)
  }
  if (wasLastSelected) {
    await setLastSelectedCharacter(newOcid)
  }
  return replaced
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
