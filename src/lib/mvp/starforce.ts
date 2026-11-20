import { starforceDiscountPercentOf } from './grades'
import { type MvpGradeEntry, mvpGradeAt } from './history'

/**
 * 스타포스 줄의 MVP 할인(%). 그 줄을 붙인 캐릭터의 메이플 ID 의 그 날 등급이다. 등급 이력이 없으면 할인이 없다.
 *
 * 강화 줄은 캐릭터(ocid)와 그 메이플 ID 를 들어 소속을 이름으로 찾지 않는다. 이름으로 찾으면 이름을 바꾼 캐릭터의 지난 줄이나
 * 다른 캐릭터가 쓰던 이름의 줄이 다른 ID 의 등급을 받는다.
 *
 * @param accountId 그 줄의 메이플 ID
 */
export function starforceMvpDiscountOf(
  histories: ReadonlyMap<string, readonly MvpGradeEntry[]>,
  accountId: string,
  dateKey: string,
): number {
  return starforceDiscountPercentOf(mvpGradeAt(histories.get(accountId) ?? [], dateKey))
}
