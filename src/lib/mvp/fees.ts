import { auctionFeePercentOf, highestMvpGrade, type MvpGradeKey } from './grades'
import { type MvpGradeEntry, mvpGradeAt } from './history'
import { type CharacterAccountSighting, accountOfOcid } from './membership'

export interface FeeRateContext {
  histories: ReadonlyMap<string, readonly MvpGradeEntry[]>
  sightings: readonly CharacterAccountSighting[]
}

/**
 * 기록의 그 날 등급. 그 캐릭터가 속한 ID 의 등급이고, 소속을 모르면 스타포스와 같이 그 날 등급을 가진 ID
 * 가운데 가장 높은 등급이다. 등급이 없으면 `null`.
 *
 * @param ocid 기록의 캐릭터. 캐릭터 없는 옛 기록은 부르는 쪽이 대표 캐릭터를 넘긴다
 */
export function recordGradeAt(context: FeeRateContext, ocid: string | null, dateKey: string): MvpGradeKey | null {
  const accountId = ocid === null ? null : accountOfOcid(context.sightings, ocid)
  if (accountId !== null) return mvpGradeAt(context.histories.get(accountId) ?? [], dateKey)
  return highestMvpGrade([...context.histories.values()].map((history) => mvpGradeAt(history, dateKey)))
}

/** 자동 수수료 요율(%). 기록의 그 날 등급 요율이고, 등급이 없으면 일반 요율. */
export function autoFeePercent(context: FeeRateContext, ocid: string | null, dateKey: string): number {
  return auctionFeePercentOf(recordGradeAt(context, ocid, dateKey))
}
