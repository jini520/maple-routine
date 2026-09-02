import type { FixedDropItem } from '../../types/drops'

// 고정 드롭 표시용 로직(순수 함수). URL 해석은 컴포넌트가 item-icons에서 처리한다 — 여기선
// "무슨 아이콘을 몇 개로 보여줄지"만 결정한다.

// '솔 에르다의 기운'은 단일 아이콘이 아니라 기운량을 단위별 아이콘으로 분해해 표시한다(사용자 지시).
// 단위: 1000(솔 에르다) > 500 > 200 > 10. 큰 단위부터 greedy로 나눈다.
export const SOL_ERDA_ENERGY_NAME = '솔 에르다의 기운'
export const SOL_ERDA_DENOMINATIONS: ReadonlyArray<{ value: number; iconFile: string }> = [
  { value: 1000, iconFile: 'sole_1000.webp' },
  { value: 500, iconFile: 'sole_500.webp' },
  { value: 200, iconFile: 'sole_200.png' },
  { value: 10, iconFile: 'sole_10.png' },
]

// "6개" → 6, "550" → 550, undefined → 1. 앞쪽 정수만 읽으므로 '개' 접미사는 무시된다.
export function parseFixedAmount(amount?: string): number {
  if (amount === undefined) return 1
  const n = Number.parseInt(amount, 10)
  return Number.isNaN(n) ? 1 : n
}

// 기운량을 단위별 (아이콘, 개수)로 분해. 예: 850 → 500×1, 200×1, 10×15.
export function decomposeSolErda(energy: number): Array<{ iconFile: string; count: number }> {
  const result: Array<{ iconFile: string; count: number }> = []
  let remaining = energy
  for (const denom of SOL_ERDA_DENOMINATIONS) {
    const count = Math.floor(remaining / denom.value)
    if (count > 0) {
      result.push({ iconFile: denom.iconFile, count })
      remaining -= count * denom.value
    }
  }
  return result
}

export interface FixedDropIconSpec {
  // 표시전용 분해 아이콘이면 파일명(솔 에르다 단위), 일반 아이템이면 null(itemName으로 조회).
  iconFile: string | null
  itemName: string
  count: number
}

// 고정 드롭 항목 하나를 화면에 그릴 아이콘 목록으로 변환한다. 솔 에르다는 다단위로 펼쳐지고,
// 일반 항목은 아이콘 1개. 수량은 1개여도 항상 표시한다(뱃지).
export function getFixedDropIcons(item: FixedDropItem): FixedDropIconSpec[] {
  if (item.name === SOL_ERDA_ENERGY_NAME) {
    return decomposeSolErda(parseFixedAmount(item.amount)).map((denom) => ({
      iconFile: denom.iconFile,
      itemName: SOL_ERDA_ENERGY_NAME,
      count: denom.count,
    }))
  }
  return [{ iconFile: null, itemName: item.name, count: parseFixedAmount(item.amount) }]
}
