/**
 * 마지막으로 계산기로 저장한 사냥 기록의 켠 메소 획득률 아이템. 시트를 열 때 한 번 읽어 체크박스의
 * 첫 값으로 세운다.
 *
 * 값을 **행에 박는 것과 별개**다. 지난 기록의 체크는 이미 그 행에 있어 여기 값이 바뀌어도
 * 소급하지 않는다. 이것은 다음 입력의 기본값일 뿐이다.
 *
 * **모양만** 본다. 그 아이템 id 가 참조표에 아직 있는지는 세우는 쪽이 판정한다.
 */
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

export interface LastHuntToggles {
  /** 켠 메소 획득률 아이템 id. 계산기에만 있는 줄이라 수동으로 적은 행은 이 값을 안 바꾼다. */
  boosts: string[]
}

/** 옛 값에 남은 `fragmentsDeferred` 는 읽지 않는다. 그 체크박스가 걷혔다. */
function parse(raw: string): LastHuntToggles | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { boosts } = value as Record<string, unknown>
    if (!Array.isArray(boosts) || boosts.some((each) => typeof each !== 'string')) return null
    return { boosts: boosts as string[] }
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
