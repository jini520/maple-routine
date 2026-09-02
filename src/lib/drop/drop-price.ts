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
 * 금액을 한국어 단위로 접어 읽는다 — `850,000,000` 이 아니라 `8억 5천만`.
 *
 * **값을 하나도 안 깎는다**. 시트의 큰 숫자가 이 서식으로 서므로(그 자리가
 * 곧 저장될 총액이다) 뭉개면 화면과 저장이 갈린다. 소수점으로 접는 `formatMesoShort`(`32.5억`)
 * 를 큰 숫자에 못 쓰는 이유가 그것이고, 자릿수를 눈으로 세는 고통을 없애는 것이 이 함수의 일이다.
 *
 * 메소 밖에도 쓴다 — 큰 숫자는 메포·원도 이 서식으로 그린다. 접는 규칙이 통화와 무관해서다.
 */
export function formatMesoUnits(meso: number): string {
  if (meso === 0) return '0'
  const parts: string[] = []
  let rest = meso
  for (const [size, suffix] of AMOUNT_UNITS) {
    const count = Math.floor(rest / size)
    rest %= size
    if (count > 0) parts.push(`${unitCount(count)}${suffix}`)
  }
  // 단위가 안 붙는 나머지 — 여기에 「천」 을 쓰면 `1만 5천` 이 15,000 인지 5,000 인지 흐려진다.
  if (rest > 0) parts.push(String(rest))
  return parts.join(' ')
}

/** 큰 것부터 본다 — 만 미만은 단위가 없어 나머지로 남는다. */
const AMOUNT_UNITS = [
  [1_000_000_000_000, '조'],
  [100_000_000, '억'],
  [10_000, '만'],
] as const

/**
 * 단위 하나가 이고 있는 수 — `5000만` 이 아니라 **`5천만`** 이다.
 *
 * 콤마는 **조 자리에만** 넣는다. 억·만은 다음 단위로 올라가므로 9999 를 못 넘어 콤마가 끊을
 * 자릿수가 없고, 단위 글자가 이미 그 일을 한다(`2,345만` 은 끊는 기호가 둘이다).
 */
function unitCount(count: number): string {
  if (count < 10_000) return count % 1_000 === 0 ? `${count / 1_000}천` : String(count)
  return count.toLocaleString()
}

