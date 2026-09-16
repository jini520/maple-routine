/**
 * 마지막으로 저장한 사냥 기록의 체크 셋. 조각 가격을 나중에 적기로 했나와 켠 메소 획득률 아이템.
 *
 * 한 칸에 둘을 함께 두는 것은 읽는 쪽이 언제나 둘을 한 번에 쓰기 때문이다. 시트를 열 때 한 번
 * 읽어 체크박스 셋의 첫 값으로 세운다.
 *
 * 값을 **행에 박는 것과 별개**다. 지난 기록의 체크는 이미 그 행에 있어 여기 값이 바뀌어도
 * 소급하지 않는다. 이것은 다음 입력의 기본값일 뿐이다.
 *
 * **모양만** 본다. 그 아이템 id 가 참조표에 아직 있는지는 세우는 쪽이 판정한다.
 */
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

export interface LastHuntToggles {
  /** 조각 가격 나중에 입력. 계산기·수동 두 폼이 함께 쓴다. */
  fragmentsDeferred: boolean
  /** 켠 메소 획득률 아이템 id. 계산기에만 있는 줄이라 수동으로 적은 행은 이 값을 안 바꾼다. */
  boosts: string[]
}

function parse(raw: string): LastHuntToggles | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { fragmentsDeferred, boosts } = value as Record<string, unknown>
    if (typeof fragmentsDeferred !== 'boolean') return null
    if (!Array.isArray(boosts) || boosts.some((each) => typeof each !== 'string')) return null
    return { fragmentsDeferred, boosts: boosts as string[] }
  } catch {
    return null
  }
}

export async function getLastHuntToggles(): Promise<LastHuntToggles | null> {
  const raw = await preferences.get(STORAGE_KEYS.lastHuntToggles)
  return raw === null ? null : parse(raw)
}

export async function setLastHuntToggles(toggles: LastHuntToggles): Promise<void> {
  await preferences.set(STORAGE_KEYS.lastHuntToggles, JSON.stringify(toggles))
}
