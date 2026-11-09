/**
 * 이벤트 월드의 기록을 지출에서 뺀다.
 *
 * 스페셜은 이벤트 월드라 **재화에 가치가 없다**(사용자 지정). 넣으면 지출이 두 배로 부푼다.
 * 1년치 실측에서 스페셜이 3,043.9억 중 1,611.1억(52.9%)이었다.
 */
import type { MapleAccount } from '../../types'
import { isEventWorld, isInWorldPeriod, worldKeyOfApiName } from '../world/worlds'

/** 줄 하나의 판정. */
export interface EventWorldJudgment {
  /** 이벤트 월드면 참, 일반 월드면 거짓, 모르면 `null` */
  eventWorld: boolean | null
  /** 모르는 까닭이 월드 표에 없는 월드면 그 월드 이름. 운영자가 표에 넣을 이름이다 */
  unknownWorld: string | null
}

/** 회차마다 하나 만드는 판정 근거. */
export interface EventWorldEvidence {
  /** 그 회차 캐릭터 목록의 이름별 판정. **목록을 못 받았으면 `null`** 이고 빈 목록과 다르다 */
  listed: ReadonlyMap<string, EventWorldJudgment> | null
  /** 이벤트 월드 스타포스 줄에서 남겨 둔 이름별 월드 key. 목록에서 사라진 캐릭터를 가르는 단서다 */
  remembered: ReadonlyMap<string, readonly string[]>
}

const UNKNOWN: EventWorldJudgment = { eventWorld: null, unknownWorld: null }

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

/**
 * 강화 줄 하나가 이벤트 월드인가.
 *
 * 차례가 셋이다. 줄이 월드를 주면(스타포스) 그 월드가 이긴다. 그때의 월드라 지금 목록보다 정확하다. 월드가 없으면(큐브 ·
 * 잠재 · 소울) 목록이 1순위이고, 목록에 없는 이름은 남겨 둔 월드의 기간 안일 때만 이벤트 월드다. 이벤트가 끝나기 전에 지운
 * 캐릭터가 그렇다. 남은 이름은 일반 월드다. 삭제 · 이전된 일반 캐릭터는 앞으로도 목록에 안 나오고, 모름으로 두면 그 날을
 * 영원히 다시 부른다.
 *
 * 이름 판정은 이벤트 월드에서 쓰던 이름을 일반 월드에서 다시 만들지 않는다는 데 기댄다. 다시 만들면 그 캐릭터의 기간 안
 * 기록도 빠지는데, 그 경우는 무시한다(사용자 지정).
 *
 * @param worldName 줄의 `world_name`. 큐브 · 잠재 · 소울은 빈 글자
 * @param dateKey 줄의 KST 날짜. 남겨 둔 이름을 그 월드의 기간과 맞춘다
 */
export function judgeEventWorld(
  worldName: string,
  characterName: string,
  dateKey: string,
  evidence: EventWorldEvidence,
): EventWorldJudgment {
  if (worldName !== '') return judgmentOfWorld(worldName)
  if (evidence.listed === null) return UNKNOWN
  const listed = evidence.listed.get(characterName)
  if (listed !== undefined) return listed
  const keys = evidence.remembered.get(characterName) ?? []
  return { eventWorld: keys.some((key) => isEventWorld(key) && isInWorldPeriod(key, dateKey)), unknownWorld: null }
}
