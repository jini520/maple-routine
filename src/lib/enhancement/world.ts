/**
 * 이벤트 월드의 기록을 지출에서 뺀다.
 *
 * 스페셜은 이벤트 월드라 **재화에 가치가 없다**(사용자 지정). 넣으면 지출이 두 배로 부푼다.
 * 1년치 실측에서 스페셜이 3,043.9억 중 1,611.1억(52.9%)이었다.
 */
import type { MapleAccount } from '../../types'
import { isEventWorld, worldKeyOfApiName } from '../world/worlds'

/** 줄 하나의 판정. */
export interface EventWorldJudgment {
  /** 이벤트 월드면 참, 일반 월드면 거짓, 모르면 `null` */
  eventWorld: boolean | null
  /** 모르는 까닭이 월드 표에 없는 월드면 그 월드 이름. 운영자가 표에 넣을 이름이다 */
  unknownWorld: string | null
}

const NORMAL: EventWorldJudgment = { eventWorld: false, unknownWorld: null }

/**
 * 월드 이름 원문의 판정. 표에 없는 월드는 일반 월드가 아니라 모름이다.
 *
 * 지금 표에서 찾는다. 받은 때 찾아 둔 key 는 그때 표가 비어 있었으면 비어 있다.
 */
export function judgmentOfWorld(worldName: string): EventWorldJudgment {
  const key = worldKeyOfApiName(worldName)
  return key === null ? { eventWorld: null, unknownWorld: worldName } : { eventWorld: isEventWorld(key), unknownWorld: null }
}

/**
 * 캐릭터 목록의 이름별 판정. 캐시가 든 `worldKey` 가 아니라 월드 이름 원문(`world`)으로 가른다.
 *
 * @example listedJudgmentsOf(await fetchCharacterListCached(credential))
 */
export function listedJudgmentsOf(accounts: readonly MapleAccount[]): Map<string, EventWorldJudgment> {
  const judgments = new Map<string, EventWorldJudgment>()
  for (const account of accounts) {
    for (const character of account.characters) judgments.set(character.name, judgmentOfWorld(character.world))
  }
  return judgments
}

/**
 * 이벤트 월드 캐릭터의 **이름**만. 옛 원본을 합계로 옮기는 단계가 쓰도록 남긴다.
 *
 * @example eventWorldCharacterNames(await fetchCharacterList(apiKey))
 */
export function eventWorldCharacterNames(accounts: readonly MapleAccount[]): Set<string> {
  const names = new Set<string>()
  for (const [name, judgment] of listedJudgmentsOf(accounts)) {
    if (judgment.eventWorld === true) names.add(name)
  }
  return names
}

/** 줄을 붙인 캐릭터에서 판정에 쓰는 것. */
export interface OwnerWorld {
  /** 그 캐릭터의 월드 이름 원문. 모르면 `null` */
  worldName: string | null
  /** 그 캐릭터의 월드 key. 모르면 `null` */
  worldKey: string | null
  /** 리프 전 기간의 줄인가 */
  preLeap: boolean
}

/**
 * 강화 줄 하나가 이벤트 월드인가.
 *
 * 줄이 월드를 주면(스타포스) 그 월드가 이긴다. 그때의 월드라 캐릭터의 지금 월드보다 정확하다. 월드가 없으면(큐브 · 잠재 ·
 * 소울) 줄을 붙인 캐릭터의 월드다. 같은 ocid 의 월드는 바뀌지 않는다.
 *
 * 리프 전 기간의 줄은 이벤트 월드가 아니다. 스페셜 월드에서 일반 월드로는 리프할 수 없다. 캐릭터의 월드를 모르면 일반 월드로
 * 센다. 모름으로 두면 그 날이 굳지 않아 같은 날을 끝없이 다시 받는다.
 *
 * @param worldName 줄의 `world_name`. 큐브 · 잠재 · 소울은 빈 글자
 */
export function judgeEventWorld(worldName: string, owner: OwnerWorld): EventWorldJudgment {
  if (worldName !== '') return judgmentOfWorld(worldName)
  if (owner.preLeap) return NORMAL
  if (owner.worldName !== null) return judgmentOfWorld(owner.worldName)
  if (owner.worldKey !== null) return { eventWorld: isEventWorld(owner.worldKey), unknownWorld: null }
  return NORMAL
}
