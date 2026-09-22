import { auctionFeePercentOf, highestMvpGrade, type MvpGradeKey } from './grades'
import { type MvpGradeEntry, mvpGradeAt } from './history'
import { type CharacterAccountSighting, accountOfOcid } from './membership'

export interface FeeRateContext {
  histories: ReadonlyMap<string, readonly MvpGradeEntry[]>
  sightings: readonly CharacterAccountSighting[]
}

/**
 * 자동 수수료 요율(%). 그 캐릭터가 속한 ID 의 그 날 등급 요율이고, 등급이 없으면 일반 요율.
 * 소속을 모르면 스타포스와 같이 그 날 등급을 가진 ID 가운데 가장 높은 등급이다.
 *
 * @param ocid 기록의 캐릭터. 캐릭터 없는 옛 기록은 부르는 쪽이 대표 캐릭터를 넘긴다
 */
export function autoFeePercent(context: FeeRateContext, ocid: string | null, dateKey: string): number {
  const accountId = ocid === null ? null : accountOfOcid(context.sightings, ocid)
  let grade: MvpGradeKey | null
  if (accountId !== null) {
    grade = mvpGradeAt(context.histories.get(accountId) ?? [], dateKey)
  } else {
    grade = highestMvpGrade([...context.histories.values()].map((history) => mvpGradeAt(history, dateKey)))
  }
  return auctionFeePercentOf(grade)
}
