/**
 * 마지막으로 계산기에 세운 사냥 자리. 캐릭터와 사냥터 key 둘.
 *
 * 지역은 안 적는다. 사냥터 key 하나로 참조표가 지역을 돌려주고, 두 벌로 두면 참조표가 바뀔 때
 * 한쪽만 낡는다.
 *
 * 사냥터 이름을 들던 옛 모양(`ground`)은 읽을 때 이름으로 사냥터를 찾아 key 로 옮기고 다시 적는다.
 * 못 찾으면 지운다. 남기면 읽을 때마다 다시 찾고, 사냥 기록을 한 번 더 적으면 다시 생기는 값이다.
 *
 * 값을 **행에 박는 것과 별개**다. 지난 기록의 사냥터는 이미 그 행에 있어 여기 값이 바뀌어도
 * 소급하지 않는다. 이것은 다음 입력의 기본값일 뿐이다.
 *
 * 새 모양은 **모양만** 본다. 그 사냥터가 참조표에 아직 있는지는 되살리는 쪽이 판정한다. 참조표를
 * 읽는 것은 옛 모양을 옮길 때뿐이다.
 */
import { findHuntingGroundByName } from '../lib/cashbook/hunting-grounds'
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

export interface LastHuntSelection {
  /** `null` 이면 캐릭터 없이 적은 것이다. 그때는 사냥터만 되살아난다. */
  ocid: string | null
  /** 사냥터 key. 지역이 따라온다. */
  groundKey: string
}

function parse(raw: string): LastHuntSelection | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { ocid, groundKey } = value as Record<string, unknown>
    if (typeof groundKey !== 'string' || groundKey === '') return null
    if (ocid !== null && typeof ocid !== 'string') return null
    return { ocid, groundKey }
  } catch {
    return null
  }
}

/** 사냥터 이름을 든 옛 모양의 이름. 옛 모양이 아니면 `null` 이다. */
function legacyGroundNameOf(raw: string): { ocid: string | null; ground: string } | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || 'groundKey' in value) return null
    const { ocid, ground } = value as Record<string, unknown>
    if (typeof ground !== 'string' || (ocid !== null && typeof ocid !== 'string')) return null
    return { ocid, ground }
  } catch {
    return null
  }
}

export async function getLastHuntSelection(): Promise<LastHuntSelection | null> {
  const raw = await preferences.get(STORAGE_KEYS.lastHuntSelection)
  if (raw === null) return null
  const legacy = legacyGroundNameOf(raw)
  if (legacy === null) return parse(raw)

  const found = findHuntingGroundByName(legacy.ground)
  if (found === null) {
    await preferences.remove(STORAGE_KEYS.lastHuntSelection)
    return null
  }
  const migrated = { ocid: legacy.ocid, groundKey: found.ground.key }
  await preferences.set(STORAGE_KEYS.lastHuntSelection, JSON.stringify(migrated))
  return migrated
}

export async function setLastHuntSelection(selection: LastHuntSelection): Promise<void> {
  // 사냥터가 없으면 되살릴 것이 없다. 빈 값을 적어 두면 버튼만 켜지고 눌러도 아무 일이 없다.
  if (selection.groundKey === '') return
  await preferences.set(STORAGE_KEYS.lastHuntSelection, JSON.stringify(selection))
}
