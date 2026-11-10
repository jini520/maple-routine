/**
 * 강화 줄의 이름을 ocid 에 붙이는 첫 차례. 앱이 그 이름으로 그 캐릭터를 본 기간(`character_accounts` 의 처음 본 날 ~ 마지막 본
 * 날) 안의 날이면 넥슨을 부르지 않고 붙인다. 앱이 그 기간에 확인한 사실이기 때문이다.
 *
 * 이관(넥슨을 부를 수 없다)과 수집기가 함께 쓴다.
 */

/** 소속 기록 한 줄. `nexonAccountId` 가 빈 글자면 계정 칸이 생기기 전의 행이다. */
export interface OwnerSighting {
  ocid: string
  name: string
  accountId: string
  nexonAccountId: string | null
  /** KST `YYYY-MM-DD` */
  firstSeenOn: string
  /** KST `YYYY-MM-DD` */
  lastSeenOn: string
}

/**
 * 그날 그 이름이었던 캐릭터의 소속 기록. 못 고르면 `null`.
 *
 * 그 넥슨 계정에서 본 기록을 먼저 고른다. 없으면 다른 계정 id 나 계정을 모르는 기록까지 본다. 계정 id 는 기기가 만든 값이라,
 * 옛 번호로 받은 줄과 새 번호로 적힌 소속이 엇갈릴 수 있기 때문이다. 고른 기록들의 ocid 가 둘 이상이면 어느 캐릭터의 기록인지
 * 모르는 것이라 고르지 않는다.
 *
 * @param nexonAccountId 그 줄을 받은 자격의 넥슨 계정 id
 */
export function sightedOwnerOf(
  sightings: readonly OwnerSighting[],
  name: string,
  dateKey: string,
  nexonAccountId: string,
): OwnerSighting | null {
  const inRange = sightings.filter(
    (sighting) => sighting.name === name && sighting.firstSeenOn <= dateKey && dateKey <= sighting.lastSeenOn,
  )
  const ofAccount = inRange.filter((sighting) => sighting.nexonAccountId === nexonAccountId)
  const candidates = ofAccount.length > 0 ? ofAccount : inRange
  const ocids = new Set(candidates.map((sighting) => sighting.ocid))
  return ocids.size === 1 ? (candidates[0] ?? null) : null
}
