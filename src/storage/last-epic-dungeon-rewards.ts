/**
 * 에픽던전별 마지막 리워드. 새 기록의 폼에서 던전 타일을 누르면 그 던전을 마지막에 적은 주인과 그 주인이 고른 단계가 선다.
 *
 * 다음 입력의 기본값일 뿐이고 지난 기록에 소급하지 않는다. **모양만** 본다. 주인이 지금 목록에 있는지, 항목 key 가 참조표에
 * 아직 있는지는 세우는 쪽이 판정한다.
 */
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

/** 기록의 주인. 캐릭터 기록은 `ocid`, 메이플 ID 기록은 `accountId` 다. */
export type RewardOwner = { readonly ocid: string } | { readonly accountId: string }

/** 형태 key → 그 형태에서 산 단계의 항목 key. */
export type FormItemKeys = Readonly<Record<string, string>>

export interface LastEpicDungeonReward {
  readonly last: RewardOwner
  readonly characters: Readonly<Record<string, FormItemKeys>>
  readonly accounts: Readonly<Record<string, FormItemKeys>>
}

/** 던전 타일 key → 그 던전의 마지막 리워드. */
export type LastEpicDungeonRewards = Readonly<Record<string, LastEpicDungeonReward>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ownerOf(value: unknown): RewardOwner | null {
  if (!isRecord(value)) return null
  if (typeof value.ocid === 'string' && value.ocid !== '') return { ocid: value.ocid }
  if (typeof value.accountId === 'string' && value.accountId !== '') return { accountId: value.accountId }
  return null
}

function formItemKeysOf(value: unknown): FormItemKeys | null {
  if (!isRecord(value)) return null
  const entries = Object.entries(value)
  if (entries.length === 0 || entries.some(([, key]) => typeof key !== 'string' || key === '')) return null
  return value as FormItemKeys
}

/** 모양이 틀린 주인 몫은 그 몫만 뺀다. */
function ownerMapOf(value: unknown): Record<string, FormItemKeys> | null {
  if (!isRecord(value)) return null
  const map: Record<string, FormItemKeys> = {}
  for (const [owner, keys] of Object.entries(value)) {
    const valid = formItemKeysOf(keys)
    if (valid !== null) map[owner] = valid
  }
  return map
}

function rewardOf(value: unknown): LastEpicDungeonReward | null {
  if (!isRecord(value)) return null
  const last = ownerOf(value.last)
  const characters = ownerMapOf(value.characters)
  const accounts = ownerMapOf(value.accounts)
  if (last === null || characters === null || accounts === null) return null
  return { last, characters, accounts }
}

/** 모양이 틀린 던전은 그 던전만 뺀다. 한 던전 때문에 다른 던전의 기억까지 버리지 않는다. */
function parse(raw: string): Record<string, LastEpicDungeonReward> {
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value)) return {}
    const rewards: Record<string, LastEpicDungeonReward> = {}
    for (const [choiceKey, each] of Object.entries(value)) {
      const reward = rewardOf(each)
      if (reward !== null) rewards[choiceKey] = reward
    }
    return rewards
  } catch {
    return {}
  }
}

/** 한 던전의 마지막 주인을 바꾸고 그 주인의 단계를 남긴 표. 저장과 화면이 함께 쓰는 규칙. */
export function withLastEpicDungeonReward(
  current: LastEpicDungeonRewards,
  choiceKey: string,
  owner: RewardOwner,
  formItemKeys: FormItemKeys,
): LastEpicDungeonRewards {
  const before = current[choiceKey] ?? { last: owner, characters: {}, accounts: {} }
  const reward: LastEpicDungeonReward =
    'ocid' in owner
      ? { ...before, last: owner, characters: { ...before.characters, [owner.ocid]: formItemKeys } }
      : { ...before, last: owner, accounts: { ...before.accounts, [owner.accountId]: formItemKeys } }
  return { ...current, [choiceKey]: reward }
}

export async function getLastEpicDungeonRewards(): Promise<LastEpicDungeonRewards> {
  const raw = await preferences.get(STORAGE_KEYS.lastEpicDungeonRewards)
  return raw === null ? {} : parse(raw)
}

export async function setLastEpicDungeonReward(choiceKey: string, owner: RewardOwner, formItemKeys: FormItemKeys): Promise<void> {
  const current = await getLastEpicDungeonRewards()
  await preferences.set(
    STORAGE_KEYS.lastEpicDungeonRewards,
    JSON.stringify(withLastEpicDungeonReward(current, choiceKey, owner, formItemKeys)),
  )
}

/**
 * 월드 리프한 캐릭터의 단계와, 던전의 마지막 주인을 새 ocid 로 옮기는 함수. 새 캐릭터의 단계가 있으면 리프 뒤의 그 단계를 둔다.
 */
export async function moveLastEpicDungeonRewardsToOcid(fromOcid: string, toOcid: string): Promise<void> {
  const current = await getLastEpicDungeonRewards()
  let changed = false
  const moved: Record<string, LastEpicDungeonReward> = {}
  for (const [choiceKey, reward] of Object.entries(current)) {
    const fromKeys = reward.characters[fromOcid]
    const lastMoves = 'ocid' in reward.last && reward.last.ocid === fromOcid
    if (fromKeys === undefined && !lastMoves) {
      moved[choiceKey] = reward
      continue
    }
    changed = true
    const characters = Object.fromEntries(Object.entries(reward.characters).filter(([ocid]) => ocid !== fromOcid))
    if (fromKeys !== undefined && characters[toOcid] === undefined) characters[toOcid] = fromKeys
    moved[choiceKey] = { ...reward, last: lastMoves ? { ocid: toOcid } : reward.last, characters }
  }
  if (changed) await preferences.set(STORAGE_KEYS.lastEpicDungeonRewards, JSON.stringify(moved))
}
