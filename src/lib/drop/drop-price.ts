/**
 * 드롭 판매가 → 수익 환산(#185).
 *
 * 가격은 **기록 한 건**에 붙는 실제 판매가이고(사용자 결정), 분배 인원도 그 건의 스냅샷이다.
 * 나누는 수는 결정석과 다르다. 결정석은 그 행의 파티원 수, 드롭은 입력할 때 사용자가 정한
 * 값이다(기본값만 파티원 수에서 온다).
 *
 * 드롭은 경매장에 팔 때 판매 수수료를, 파티원에게 나눠 보낼 때 분배 수수료를 문다. 두 칸이 다 빈 옛 기록은
 * 수수료 없이 나눈 옛 식 그대로 센다.
 */

import { formatSharePercent } from '../boss/party-shares'

/**
 * 가격 세 필드만 보는 구조적 타입.
 *
 * `RecordedDrop`(도메인, `undefined`)과 `BossDropRecord`(저장 계층, `null`)가 **같은 함수를
 * 쓰게 하려는 것이다**. 합산이 두 벌이 되면 화면과 증감 칩이 서로 다른 규칙으로 더하게 된다.
 */
export interface DropPriceFields {
  priceState?: 'entered' | 'excluded' | null
  priceMeso?: number | null
  /** 분배 인원. 비율을 쓰는 기록에서는 **비율 합**이다. 균등이면 둘이 같은 수다. */
  priceShare?: number | null
  /** 내 비율. 없으면 1 이라 옛 기록의 금액이 안 움직인다. */
  priceMyShare?: number | null
  /** 경매장 판매 수수료(%). `null` 은 없음 */
  saleFeePercent?: number | null
  /** 파티원에게 보낼 때의 분배 수수료(%). `null` 은 없음 */
  splitFeePercent?: number | null
}

/**
 * 기록 한 건이 수익에 얹는 금액.
 *
 * **스킵과 미입력은 둘 다 0이다.** 두 상태를 여기서 가르지 않는 이유는 합산에서 하는 일이 같기
 * 때문이고, 화면은 `priceState` 를 직접 보고 다르게 그린다("스킵됨" vs "미입력").
 */
export function dropPayoutMeso(drop: DropPriceFields): number {
  if (drop.priceState !== 'entered' || drop.priceMeso === undefined || drop.priceMeso === null) return 0
  // 분배 인원이 없거나 0이면 1로 본다. 0으로 나누어 Infinity 가 수익에 섞이는 것을 막는다.
  const total = Math.max(1, drop.priceShare ?? 1)
  /**
   * **적힌 0 은 0 이다**(사용자 결정 2026-09-23). 슬라이더의 0 은 이 드롭의 돈을 하나도 안 받는다는
   * 약속이라 그대로 센다. 안 적힌 것(`NULL`)만 1 이라 옛 기록의 금액이 안 움직인다.
   */
  const mine = Math.max(0, drop.priceMyShare ?? 1)
  const saleFee = drop.saleFeePercent ?? null
  const splitFee = drop.splitFeePercent ?? null
  if (saleFee === null && splitFee === null) return Math.floor((drop.priceMeso * mine) / total)

  // 판매 분배금 계산기(`lib/cashbook/item-split`)와 같은 역산이다. 받는 쪽이 분배 수수료를 물고도 약속한 몫이 되게 보낸다.
  const net = drop.priceMeso - Math.floor((drop.priceMeso * (saleFee ?? 0)) / 100)
  if (mine >= total) return net
  const d = splitFee ?? 0
  if (drop.priceMyShare == null) {
    const perMember = Math.floor((net * 100) / (total * 100 - d))
    return net - perMember * (total - 1)
  }
  const others = total - mine
  // **보내는 쪽은 몫이 큰 쪽이다.** 내 몫이 작으면 상대가 팔아 나에게 보낸 것으로 센다. 내가 큰 금액을 보내는 것으로
  // 세면 수수료가 그만큼 더 나가 둘 다 손해다(결정석의 `crystalPayoutMeso` 와 같은 규칙).
  if (mine < others) return Math.floor((net * mine * (100 - d)) / (others * (100 - d) + 100 * mine))
  return net - Math.floor((100 * net * others) / (mine * (100 - d) + 100 * others))
}

/**
 * 그 드롭을 어떻게 나눴나. 균등이면 `4인`, 비율이면 내 몫 `75%` 이고, 안 나눴거나 값을 안 매겼으면 `null`.
 *
 * 비율로 나눈 드롭에 인원을 적으면 화면이 금액과 다른 말을 한다. 그 드롭은 인원으로 안 나눴다.
 *
 * @example dropSplitLabel(drop) // '75%'
 */
export function dropSplitLabel(drop: DropPriceFields): string | null {
  if (drop.priceState !== 'entered') return null
  const total = Math.max(1, drop.priceShare ?? 1)
  const mine = Math.max(0, drop.priceMyShare ?? 1)
  if (mine >= total) return null
  // 1 만 인원으로 적는다. 0 을 1 로 접으면 안 받은 몫이 `10인` 으로 서서 균등으로 나눈 것처럼 읽힌다.
  return mine === 1 ? `${total}인` : formatSharePercent(mine, total)
}

/** 한 보스 행에 기록된 드롭 전체가 그 행에 더하는 금액. */
export function sumDropPayout(drops: DropPriceFields[]): number {
  return drops.reduce((sum, drop) => sum + dropPayoutMeso(drop), 0)
}

/**
 * 금액을 한국어 단위로 접은 표기. `850,000,000` 이 아니라 `8억 5천만`.
 *
 * **값을 하나도 안 깎는다**. 시트의 큰 숫자가 이 서식으로 서므로(그 자리가
 * 곧 저장될 총액이다) 뭉개면 화면과 저장이 갈린다. 소수점으로 접는 `formatMesoShort`(`32.5억`)
 * 를 큰 숫자에 못 쓰는 이유가 그것이고, 자릿수를 눈으로 세는 고통을 없애는 것이 이 함수의 일이다.
 *
 * 메소 밖에도 쓴다. 큰 숫자는 메포·원도 이 서식으로 그린다. 접는 규칙이 통화와 무관해서다.
 */
export function formatMesoUnits(meso: number): string {
  if (meso === 0) return '0'
  // 부호를 떼어 접고 다시 붙인다. 단위 나눗셈이 음수에서 0개로 떨어져 글자가 통째로 빈다.
  if (meso < 0) return `-${formatMesoUnits(-meso)}`
  const parts: string[] = []
  let rest = meso
  for (const [size, suffix] of AMOUNT_UNITS) {
    const count = Math.floor(rest / size)
    rest %= size
    if (count > 0) parts.push(`${unitCount(count)}${suffix}`)
  }
  // 단위가 안 붙는 나머지. 여기에 `천` 을 쓰면 `1만 5천` 이 15,000 인지 5,000 인지 흐려진다.
  if (rest > 0) parts.push(String(rest))
  return parts.join(' ')
}

/** 금액을 접는 단위 표. 큰 것부터 보고 만 미만은 단위 없이 나머지로 남는다. */
const AMOUNT_UNITS = [
  [1_000_000_000_000, '조'],
  [100_000_000, '억'],
  [10_000, '만'],
] as const

/**
 * 단위 하나가 이고 있는 수. `5000만` 이 아니라 **`5천만`** 이다.
 *
 * 콤마는 **조 자리에만** 넣는다. 억·만은 다음 단위로 올라가므로 9999 를 못 넘어 콤마가 끊을
 * 자릿수가 없고, 단위 글자가 이미 그 일을 한다(`2,345만` 은 끊는 기호가 둘이다).
 */
function unitCount(count: number): string {
  if (count < 10_000) return count % 1_000 === 0 ? `${count / 1_000}천` : String(count)
  return count.toLocaleString()
}


/**
 * 좁은 자리에 넣는 **축약 금액**. 단위 하나에 소수 첫째 자리까지다(`32.5억`).
 *
 * `formatMesoUnits` 는 단위를 이어 붙여(`32억 5천만`) 읽기에는 좋지만 72px 타일에는 안 들어간다.
 * 여기서는 가장 큰 단위 하나만 쓰고 나머지를 소수로 접는다.
 *
 * **올림이 아니라 버림이다.** 올리면 안 받은 돈을 받은 것처럼 적는다. 정확한 값은 가격 카드가
 * 들고 있고 이 글자는 훑어볼 때의 눈금이다.
 *
 * @example formatMesoCompact(3_250_000_000) // '32.5억'
 * @example formatMesoCompact(1_000_000_000) // '10억'
 * @example formatMesoCompact(10_000_000) // '1000만'
 */
export function formatMesoCompact(meso: number): string {
  if (meso === 0) return '0'
  if (meso < 0) return `-${formatMesoCompact(-meso)}`
  for (const [size, suffix] of AMOUNT_UNITS) {
    if (meso < size) continue
    // 소수 첫째 자리에서 버린다. 곱한 뒤 나누는 것은 `0.1` 을 못 담는 부동소수를 피하려는 것이다.
    const tenths = Math.floor((meso * 10) / size)
    const whole = Math.floor(tenths / 10)
    const rest = tenths % 10
    return rest === 0 ? `${whole}${suffix}` : `${whole}.${rest}${suffix}`
  }
  return String(meso)
}
