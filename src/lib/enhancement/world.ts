/**
 * 이벤트 월드의 기록을 지출에서 뺀다.
 *
 * 스페셜은 이벤트 월드라 **재화에 가치가 없다**(사용자 지정). 넣으면 지출이 두 배로 부푼다.
 * 1년치 실측에서 스페셜이 3,043.9억 중 1,611.1억(52.9%)이었다.
 */
import type { MapleAccount } from '../../types'

/**
 * 챌린저스·챌린저스2 는 여기 안 든다. 시즌 월드지만 재화가 본섭으로 넘어온다(사용자 지정).
 */
const EVENT_WORLDS: ReadonlySet<string> = new Set(['스페셜'])

export function isEventWorld(world: string): boolean {
  return EVENT_WORLDS.has(world)
}

/**
 * 이벤트 월드 캐릭터의 **이름**만.
 *
 * 큐브·잠재 응답에는 `world_name` 이 없고 `character_name` 만 있다. 이름이 유일한 단서다.
 *
 * @example eventWorldCharacterNames(await fetchCharacterList(apiKey))
 */
export function eventWorldCharacterNames(accounts: readonly MapleAccount[]): Set<string> {
  const names = new Set<string>()
  for (const account of accounts) {
    for (const character of account.characters) {
      if (isEventWorld(character.world)) names.add(character.name)
    }
  }
  return names
}

/**
 * 이 기록을 지출로 세나.
 *
 * @param world 그 줄의 `world_name`. 큐브·잠재는 안 주므로 `null`
 * @param eventNames `eventWorldCharacterNames` 가 만든 집합
 *
 * 줄이 월드를 주면 **그 값이 이긴다.** 그때의 월드라 지금 목록보다 정확하고, 삭제되어 목록에서
 * 사라진 캐릭터도 막힌다(실제로 다섯 있었다).
 *
 * 이름 판정은 스페셜에서 본섭으로 못 넘어온다는 데 기댄다. 스페셜에서 쓰던 이름을 본섭에서
 * 다시 만들면 그 캐릭터의 기록까지 빠지는데, 그 경우는 무시한다(사용자 지정).
 */
export function isSpendingRecord(
  world: string | null,
  characterName: string,
  eventNames: ReadonlySet<string>,
): boolean {
  if (world !== null) return !isEventWorld(world)
  return !eventNames.has(characterName)
}
