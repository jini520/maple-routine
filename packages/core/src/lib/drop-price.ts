// 드롭 판매가 → 수익 환산(#185).
//
// 가격은 **기록 한 건**에 붙는 실제 판매가이고(사용자 결정), 분배 인원도 그 건의 스냅샷이다.
// 결정석의 `floor(priceMeso / partySize)` 와 같은 식이지만 나누는 수가 다르다 — 결정석은 그 행의
// 파티원 수, 드롭은 입력할 때 사용자가 정한 값이다(기본값만 파티원 수에서 온다).

/**
 * 가격 세 필드만 보는 구조적 타입.
 *
 * `RecordedDrop`(도메인, `undefined`)과 `BossDropRecord`(저장 계층, `null`)가 **같은 함수를
 * 쓰게 하려는 것이다** — 합산이 두 벌이 되면 화면과 증감 칩이 서로 다른 규칙으로 더하게 된다.
 */
export interface DropPriceFields {
  priceState?: 'entered' | 'excluded' | null
  priceMeso?: number | null
  priceShare?: number | null
}

/**
 * 기록 한 건이 수익에 얹는 금액.
 *
 * **스킵과 미입력은 둘 다 0이다.** 두 상태를 여기서 가르지 않는 이유는 합산에서 하는 일이 같기
 * 때문이고, 화면은 `priceState` 를 직접 보고 다르게 그린다("스킵됨" vs "미입력").
 */
export function dropPayoutMeso(drop: DropPriceFields): number {
  if (drop.priceState !== 'entered' || drop.priceMeso === undefined || drop.priceMeso === null) return 0
  // 분배 인원이 없거나 0이면 1로 본다 — 0으로 나누어 Infinity 가 수익에 섞이는 것을 막는다.
  return Math.floor(drop.priceMeso / Math.max(1, drop.priceShare ?? 1))
}

/** 한 보스 행에 기록된 드롭 전체가 그 행에 더하는 금액. */
export function sumDropPayout(drops: DropPriceFields[]): number {
  return drops.reduce((sum, drop) => sum + dropPayoutMeso(drop), 0)
}

/**
 * 입력 중인 금액을 한국어 단위로 접어 읽는다 — `3,250,000,000` 이 아니라 `32억 5,000만`.
 *
 * 확정 금액은 앱 관례대로 `toLocaleString()` 원시 표기이고 칩 안에서는 `formatMesoShort` 로
 * 접는데, 이 함수는 **치는 동안**만 쓴다 — 자릿수를 눈으로 세는 것이 키패드가 없애려는 고통
 * 자체라, 소수점으로 뭉개는 `formatMesoShort`(`32.5억`) 로는 입력 중인 값을 확인할 수 없다.
 */
export function formatMesoUnits(meso: number): string {
  if (meso === 0) return '0'
  const parts: string[] = []
  const eok = Math.floor(meso / 100_000_000)
  const man = Math.floor((meso % 100_000_000) / 10_000)
  const won = meso % 10_000
  if (eok > 0) parts.push(`${eok.toLocaleString()}억`)
  if (man > 0) parts.push(`${man.toLocaleString()}만`)
  if (won > 0) parts.push(won.toLocaleString())
  return parts.join(' ')
}

