import type { FixedDropItem } from '../../types/drops'
import type { AppImageKey } from '../assets/app-images'

// 고정 드롭 표시용 로직(순수 함수). URL 해석은 컴포넌트가 drop-items 에서 처리한다. 여기선
// "무슨 아이콘을 몇 개로 보여줄지"만 결정한다.

// `솔 에르다의 기운` 은 단일 아이콘이 아니라 기운량을 단위별 아이콘으로 분해해 표시한다.
// 단위는 1000(솔 에르다) > 500 > 200 > 10 이고 큰 단위부터 greedy 로 나눈다.
export const SOL_ERDA_ENERGY_KEY = 'sol_erda_energy'
export const SOL_ERDA_DENOMINATIONS: ReadonlyArray<{ value: number; imageKey: AppImageKey }> = [
  { value: 1000, imageKey: 'sol_erda_energy_1000' },
  { value: 500, imageKey: 'sol_erda_energy_500' },
  { value: 200, imageKey: 'sol_erda_energy_200' },
  { value: 10, imageKey: 'sol_erda_energy_10' },
]

// "6개" → 6, "550" → 550, undefined → 1. 앞쪽 정수만 읽으므로 '개' 접미사는 무시된다.
export function parseFixedAmount(amount?: string): number {
  if (amount === undefined) return 1
  const n = Number.parseInt(amount, 10)
  return Number.isNaN(n) ? 1 : n
}

// 기운량을 단위별 (아이콘, 개수)로 분해. 예: 850 → 500×1, 200×1, 10×15.
export function decomposeSolErda(energy: number): Array<{ imageKey: AppImageKey; count: number }> {
  const result: Array<{ imageKey: AppImageKey; count: number }> = []
  let remaining = energy
  for (const denom of SOL_ERDA_DENOMINATIONS) {
    const count = Math.floor(remaining / denom.value)
    if (count > 0) {
      result.push({ imageKey: denom.imageKey, count })
      remaining -= count * denom.value
    }
  }
  return result
}

export interface FixedDropIconSpec {
  // 표시전용 분해 아이콘이면 앱 그림 key(솔 에르다 단위), 일반 아이템이면 null(itemKey로 조회).
  imageKey: AppImageKey | null
  itemKey: string
  count: number
}

// 고정 드롭 항목 하나를 화면에 그릴 아이콘 목록으로 변환한다. 솔 에르다는 다단위로 펼쳐지고,
// 일반 항목은 아이콘 1개. 수량은 1개여도 항상 표시한다(뱃지).
export function getFixedDropIcons(item: FixedDropItem): FixedDropIconSpec[] {
  if (item.key === SOL_ERDA_ENERGY_KEY) {
    return decomposeSolErda(parseFixedAmount(item.amount)).map((denom) => ({
      imageKey: denom.imageKey,
      itemKey: SOL_ERDA_ENERGY_KEY,
      count: denom.count,
    }))
  }
  return [{ imageKey: null, itemKey: item.key, count: parseFixedAmount(item.amount) }]
}
