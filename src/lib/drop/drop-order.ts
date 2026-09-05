/**
 * 화면에 드롭을 세우는 순서.
 *
 * 보스 행의 아이콘 스택은 **셋만** 보여주고 나머지는 `+N` 으로 접는다. 그래서 이 순서가 곧
 * 무엇이 보이는가다. 기록된 순서로 두면 그 판의 사건이 `+N` 뒤에 숨을 수 있다.
 *
 * 규칙 둘(사용자 지정).
 *
 * 1. **연출이 나는 아이템이 먼저다.** 값을 안 매겼어도 앞이다. 그것이 그 판에서 일어난 일이고,
 *    값은 나중에 매기면 된다.
 * 2. 그다음이 **비싼 순**. 값을 안 매긴 것은 0 이라 자연히 뒤로 간다.
 *
 * @example
 * const shown = sortDropsForDisplay(drops).slice(0, 3)
 */
import { dropPayoutMeso, type DropPriceFields } from './drop-price'
import { isValuableDrop } from './valuable-drops'

/** 순서를 정하는 데 필요한 것만 본다. 도메인 `RecordedDrop` 과 저장 계층 기록이 함께 통과한다. */
type OrderableDrop = DropPriceFields & { itemName: string }

/**
 * 견주는 값은 **내가 받은 몫**(`dropPayoutMeso`)이지 판매 총액이 아니다. 화면이 세는 값과
 * 달라지면 목록에서 위에 선 것이 아래보다 적게 번 것으로 보인다.
 *
 * 원본을 안 뒤집는다. 부르는 쪽이 넘긴 배열은 스토어의 스냅샷이라 그 자리에서 바꾸면 안 된다.
 * 견줄 것이 없을 때 기록된 순서가 남는 것은 `Array.prototype.sort` 가 안정 정렬이기 때문이다.
 */
export function sortDropsForDisplay<T extends OrderableDrop>(drops: readonly T[]): T[] {
  return [...drops].sort((left, right) => {
    const valuable = Number(isValuableDrop(right.itemName)) - Number(isValuableDrop(left.itemName))
    if (valuable !== 0) return valuable
    return dropPayoutMeso(right) - dropPayoutMeso(left)
  })
}
