/**
 * 수정으로 연 사냥 기록의 조각 최소 개수. 정산 · 헥사 강화가 가져간 몫 아래로 줄이지 못하게 조각 개수 카드가 쓴다.
 * 사냥 폼 둘이 함께 쓴다.
 */
import { useEffect, useState } from 'react'

import type { IncomeRecord } from '../../../storage/income'

/** 수정으로 연 사냥 기록의 조각을 이보다 적게 저장할 수 없는 개수를 읽는 콜백. 화면이 넘긴다. */
export type LoadHuntFragmentFloor = (record: IncomeRecord) => Promise<number>

/**
 * 조각 개수 카드가 막을 최소 개수. 수정으로 연 사냥 기록에서 0 보다 클 때만 낸다.
 *
 * 조각 가격을 채웠거나 캐릭터 · 날짜를 바꾸면 내지 않는다. 연 기록으로 센 경계가 맞지 않기 때문이고, 그때 막히는지는
 * 저장이 본다.
 *
 * @param now 폼에 지금 든 캐릭터 · 날짜 · 조각 가격
 */
export function useHuntFragmentFloor(
  editing: IncomeRecord | undefined,
  load: LoadHuntFragmentFloor,
  now: { ocid: string | null; dateKey: string; fragmentPrice: number | null },
): number | undefined {
  const [floor, setFloor] = useState(0)
  useEffect(() => {
    if (editing === undefined) return
    let alive = true
    void load(editing).then((value) => {
      if (alive) setFloor(value)
    })
    return () => {
      alive = false
    }
  }, [editing, load])
  if (editing === undefined || floor <= 0) return undefined
  if (now.fragmentPrice !== null || now.ocid !== editing.ocid || now.dateKey !== editing.earnedOn) return undefined
  return floor
}

/** 조각 개수 카드의 설명 줄. 최소 개수가 있으면 뒤에 붙인다. */
export function fragmentCountContextOf(floor: number | undefined): string {
  return floor === undefined ? '솔 에르다 조각' : `솔 에르다 조각 · 최소 ${floor.toLocaleString()}개`
}
