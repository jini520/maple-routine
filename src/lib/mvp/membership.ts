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

/** 그 날 이하에서 가장 늦게 본 기록. 처음 본 날이 그 날보다 뒤인 기록은 그때 소속을 몰랐던 것이라 뺀다. */
function latestSeenBy(sightings: readonly CharacterAccountSighting[], dateKey: string): CharacterAccountSighting | null {
  let best: CharacterAccountSighting | null = null
  let bestSeen = ''
  for (const sighting of sightings) {
    if (sighting.firstSeenOn > dateKey) continue
    const seen = sighting.lastSeenOn < dateKey ? sighting.lastSeenOn : dateKey
    if (best === null || seen > bestSeen) {
      best = sighting
      bestSeen = seen
    }
  }
  return best
}

/** 스타포스 줄처럼 이름만 든 기록의 소속. 모르면 `null`. */
export function accountOfName(sightings: readonly CharacterAccountSighting[], name: string, dateKey: string): string | null {
  return latestSeenBy(sightings.filter((sighting) => sighting.name === name), dateKey)?.accountId ?? null
}

/** ocid 를 든 기록의 소속. 가장 늦게 본 기록의 ID, 모르면 `null`. */
export function accountOfOcid(sightings: readonly CharacterAccountSighting[], ocid: string): string | null {
  let best: CharacterAccountSighting | null = null
  for (const sighting of sightings) {
    if (sighting.ocid === ocid && (best === null || sighting.lastSeenOn > best.lastSeenOn)) best = sighting
  }
  return best?.accountId ?? null
}
