import { highestMvpGrade, starforceDiscountPercentOf } from './grades'
import { type MvpGradeEntry, mvpGradeAt } from './history'
import { type CharacterAccountSighting, accountOfName } from './membership'

/**
 * 스타포스 줄의 MVP 할인(%)을 찾는 함수. 줄은 캐릭터 이름만 들어 소속을 이름으로 찾는다.
 * 소속을 모르면 그 날 등급을 가진 ID 가운데 가장 높은 등급이고, 고른 ID 의 등급으로 세지 않는다.
 * 고른 ID 를 바꿀 때마다 지난 줄의 값이 바뀌기 때문이다.
 */
export function starforceMvpDiscountResolver(
  histories: ReadonlyMap<string, readonly MvpGradeEntry[]>,
  sightings: readonly CharacterAccountSighting[],
): (characterName: string, dateKey: string) => number {
  return (characterName, dateKey) => {
    const accountId = accountOfName(sightings, characterName, dateKey)
    if (accountId !== null) return starforceDiscountPercentOf(mvpGradeAt(histories.get(accountId) ?? [], dateKey))
    const grades = [...histories.values()].map((history) => mvpGradeAt(history, dateKey))
    return starforceDiscountPercentOf(highestMvpGrade(grades))
  }
}
