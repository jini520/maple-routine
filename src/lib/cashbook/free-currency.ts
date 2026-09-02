/**
 * 손입력이 고르는 **통화 셋** — 지출의 기타와 수입의 기타가 같이 쓴다
 *
 *
 * ## 왜 한 자리인가
 *
 * 두 시트가 **같은 셋**을 고르고 **같은 규칙**으로 잰다(메포는 시세로 메소 환산 · 캐시는 환산
 * 안 함 —). 각자 베껴 두면 한쪽에 통화가 늘거나 라벨이 바뀔 때 **다른 쪽만
 * 조용히 옛 목록으로 남는다**. 저장 칸 이름도 두 테이블이 같으므로(`point_amount`·`cash_amount`)
 * 여기서 갈라질 이유가 없다.
 *
 * ## `unit` 이 라벨과 갈리는 자리
 *
 * 캐시는 라벨이 캐시(무엇으로 내나)이고 단위는 원(얼마인가)이다. 큰 숫자 옆에는 단위가,
 * 통화를 고르는 자리에는 라벨이 선다 — 묻는 것이 달라서다.
 */
export const FREE_CURRENCIES = [
  { id: 'meso', label: '메소', unit: '메소' },
  { id: 'point', label: '메포', unit: '메포' },
  { id: 'cash', label: '캐시', unit: '원' },
] as const

export type FreeCurrency = (typeof FREE_CURRENCIES)[number]['id']

/** 세그먼트는 **글자**를 고른다 — 아이디와 라벨 사이를 여기서 옮긴다. */
export const FREE_CURRENCY_LABELS = FREE_CURRENCIES.map((each) => each.label)

export function labelOfCurrency(id: FreeCurrency): string {
  return FREE_CURRENCIES.find((each) => each.id === id)?.label ?? '메소'
}

export function currencyOfLabel(label: string): FreeCurrency {
  return FREE_CURRENCIES.find((each) => each.label === label)?.id ?? 'meso'
}

/** 큰 숫자 옆에 서는 단위 — 캐시만 원이다. */
export function unitOfCurrency(id: FreeCurrency): string {
  return FREE_CURRENCIES.find((each) => each.id === id)?.unit ?? '메소'
}
