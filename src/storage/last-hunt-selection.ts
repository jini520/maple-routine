/**
 * 마지막으로 계산기에 세운 사냥 자리. 캐릭터와 사냥터 이름 둘.
 *
 * 지역은 안 적는다. 사냥터 이름이 전역 유일이라 참조표가 지역을 돌려주고, 두 벌로 두면 참조표가
 * 바뀔 때 한쪽만 낡는다.
 *
 * 값을 **행에 박는 것과 별개**다. 지난 기록의 사냥터는 이미 그 행에 있어 여기 값이 바뀌어도
 * 소급하지 않는다. 이것은 다음 입력의 기본값일 뿐이다.
 *
 * 여기서 보는 것은 **모양뿐**이다. 그 사냥터가 참조표에 아직 있는지는 되살리는 쪽이 판정한다.
 * 참조표는 `lib/` 것이라 저장 어댑터가 알 자리가 아니다.
 */
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

export interface LastHuntSelection {
  /** `null` 이면 캐릭터 없이 적은 것이다. 그때는 사냥터만 되살아난다. */
  ocid: string | null
  /** 사냥터 이름. 전역 유일이라 지역이 따라온다. */
  ground: string
}

function parse(raw: string): LastHuntSelection | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { ocid, ground } = value as Record<string, unknown>
    if (typeof ground !== 'string' || ground === '') return null
    if (ocid !== null && typeof ocid !== 'string') return null
    return { ocid, ground }
  } catch {
    return null
  }
}

export async function getLastHuntSelection(): Promise<LastHuntSelection | null> {
  const raw = await preferences.get(STORAGE_KEYS.lastHuntSelection)
  return raw === null ? null : parse(raw)
}

export async function setLastHuntSelection(selection: LastHuntSelection): Promise<void> {
  // 사냥터가 없으면 되살릴 것이 없다. 빈 값을 적어 두면 버튼만 켜지고 눌러도 아무 일이 없다.
  if (selection.ground === '') return
  await preferences.set(STORAGE_KEYS.lastHuntSelection, JSON.stringify(selection))
}
