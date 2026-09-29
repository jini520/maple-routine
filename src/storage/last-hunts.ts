/**
 * 캐릭터별 마지막 사냥. 사냥 계산기에서 캐릭터를 고르면 그 몫의 사냥터와 켠 아이템이 선다.
 *
 * 지역은 안 적는다. 사냥터 key 하나로 참조표가 지역을 돌려주고, 두 벌로 두면 참조표가 바뀔 때
 * 한쪽만 낡는다.
 *
 * 값을 **행에 박는 것과 별개**다. 지난 기록의 사냥터는 이미 그 행에 있어 여기 값이 바뀌어도
 * 소급하지 않는다. 이것은 다음 입력의 기본값일 뿐이다.
 *
 * **모양만** 본다. 그 사냥터 · 아이템이 참조표에 아직 있는지는 세우는 쪽이 판정한다. 참조표를
 * 읽는 것은 옛 한 벌을 옮길 때뿐이다.
 */
import { findHuntingGroundByName } from '../lib/cashbook/hunting-grounds'
import { UNION_TIERS, type UnionTier } from '../lib/cashbook/hunting-meso'
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

export interface LastHunt {
  /** 사냥터 key. 지역이 따라온다. */
  groundKey: string
  /** 켠 메소 획득률 아이템 id. */
  boosts: string[]
  /** 마지막에 고른 유니온의 부 단계. 단계가 없는 옛 기억은 3단계다. */
  unionTier: UnionTier
}

/** ocid → 그 캐릭터의 마지막 사냥. */
export type LastHunts = Readonly<Record<string, LastHunt>>

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((each) => typeof each === 'string')
}

function lastHuntOf(value: unknown): LastHunt | null {
  if (typeof value !== 'object' || value === null) return null
  const { groundKey, boosts, unionTier } = value as Record<string, unknown>
  if (typeof groundKey !== 'string' || groundKey === '' || !isStringArray(boosts)) return null
  return { groundKey, boosts, unionTier: UNION_TIERS.includes(unionTier as UnionTier) ? (unionTier as UnionTier) : 3 }
}

/** 상한 캐릭터 몫은 그 몫만 뺀다. 한 몫 때문에 다른 캐릭터의 기억까지 버리지 않는다. */
function parse(raw: string): Record<string, LastHunt> {
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    const hunts: Record<string, LastHunt> = {}
    for (const [ocid, each] of Object.entries(value)) {
      const hunt = lastHuntOf(each)
      if (hunt !== null) hunts[ocid] = hunt
    }
    return hunts
  } catch {
    return {}
  }
}

function parseJson(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** 옛 한 벌의 사냥터 key. 이름을 든 더 옛 모양(`ground`)은 이름으로 찾는다. */
function legacyGroundKeyOf(selection: Record<string, unknown>): string | null {
  if (typeof selection.groundKey === 'string' && selection.groundKey !== '') return selection.groundKey
  if (typeof selection.ground === 'string') return findHuntingGroundByName(selection.ground)?.ground.key ?? null
  return null
}

/**
 * 옛 두 키(`lastHuntSelection` · `lastHuntToggles`)의 한 벌을 그 `ocid` 몫으로 옮기고 옛 키를 지운다.
 *
 * 두 값은 같은 저장에서 적혔으므로 같은 기록의 사냥터와 아이템이다. 캐릭터가 없거나 사냥터를 못
 * 찾으면 붙일 자리가 없어 버린다.
 */
async function migrateLegacy(): Promise<Record<string, LastHunt>> {
  const selection = parseJson(await preferences.get(STORAGE_KEYS.lastHuntSelection))
  const toggles = parseJson(await preferences.get(STORAGE_KEYS.lastHuntToggles))
  await preferences.remove(STORAGE_KEYS.lastHuntSelection)
  await preferences.remove(STORAGE_KEYS.lastHuntToggles)

  const ocid = selection?.ocid
  const groundKey = selection === null ? null : legacyGroundKeyOf(selection)
  if (typeof ocid !== 'string' || groundKey === null) return {}

  const hunts: Record<string, LastHunt> = {
    [ocid]: { groundKey, boosts: isStringArray(toggles?.boosts) ? toggles.boosts : [], unionTier: 3 },
  }
  await preferences.set(STORAGE_KEYS.lastHunts, JSON.stringify(hunts))
  return hunts
}

export async function getLastHunts(): Promise<LastHunts> {
  const raw = await preferences.get(STORAGE_KEYS.lastHunts)
  return raw === null ? migrateLegacy() : parse(raw)
}

export async function setLastHunt(ocid: string, hunt: LastHunt): Promise<void> {
  // 사냥터가 없으면 되살릴 것이 없다.
  if (hunt.groundKey === '') return
  const current = await getLastHunts()
  await preferences.set(STORAGE_KEYS.lastHunts, JSON.stringify({ ...current, [ocid]: hunt }))
}
