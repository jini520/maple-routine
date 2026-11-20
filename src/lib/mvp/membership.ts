/** 캐릭터가 어느 메이플 ID 소속이었는지 찾는 계산. 소속 기록은 `storage/character-accounts` 가 든다. */

export interface CharacterAccountSighting {
  ocid: string
  name: string
  accountId: string
  /** KST `YYYY-MM-DD` */
  firstSeenOn: string
  /** KST `YYYY-MM-DD` */
  lastSeenOn: string
}

/** ocid 를 든 기록의 소속. 가장 늦게 본 기록의 ID, 모르면 `null`. */
export function accountOfOcid(sightings: readonly CharacterAccountSighting[], ocid: string): string | null {
  let best: CharacterAccountSighting | null = null
  for (const sighting of sightings) {
    if (sighting.ocid === ocid && (best === null || sighting.lastSeenOn > best.lastSeenOn)) best = sighting
  }
  return best?.accountId ?? null
}
