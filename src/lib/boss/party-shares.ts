/**
 * 파티 분배 비율의 계산. 결정석에서 내가 쥐는 메소와 상대와 오가는 송금액.
 *
 * **파티 인원은 안 들어간다.** 비율 약속은 `나 : 나머지` 라 늘 두 쪽이고, 몇 명이 그 나머지를
 * 이루는지는 내 몫에도 송금액에도 안 쓰인다. 인원이 필요한 것은 비율을 안 쓰는 균등 분배
 * (`floor(가격 / 인원)`)뿐이다.
 *
 * 게임은 두 쪽에 각각 절반을 지급한다. 2:1 약속은 그렇게 받은 메소를 다시 보내주는 것이고 **그
 * 송금에 경매장 수수료가 붙는다**. 차액을 그대로 보내면 받는 쪽만 수수료를 물어 약속한 비율이
 * 깨지므로, 수수료를 뗀 뒤의 잔액이 약속한 비율이 되도록 역산한다. 화면은 그 결과(내 몫)만
 * 말하고 오가는 금액은 안 적는다.
 *
 * 정수 산술만 쓴다. 부동소수 곱은 메소 단위에서 값이 튄다.
 */

/** 수수료를 안 적은 행이 쓰는 값. MVP 실버 등급 이상의 경매장 수수료다. */
const DEFAULT_SPLIT_FEE_PERCENT = 3

/** 저장 칸 셋이 오는 모양. 전부 `null` 일 수 있고 그때가 균등 분배다. */
export interface PartyShares {
  myShare: number | null
  sharesTotal: number | null
  splitFeePercent: number | null
}

/** 계산이 쓰는 모양. `isEven` 이면 나눌 것이 비율이 아니라 파티 인원이다. */
export interface ResolvedShares {
  myShare: number
  sharesTotal: number
  splitFeePercent: number
  isEven: boolean
}

/**
 * 저장 칸 셋을 계산이 쓰는 모양으로.
 *
 * 한쪽만 적힌 행과 반반(`1:1`)은 **균등으로 읽는다**. 반쯤 쓰다 만 값으로 금액을 세면 화면이
 * 조용히 틀린 수를 말한다.
 *
 * **내 비율 0 은 균등이 아니다.** 이 몫을 하나도 안 갖는 약속이라 내 몫이 0 이 되어야 하는데,
 * 균등으로 읽으면 `가격 / 인원` 을 받은 것으로 센다.
 */
export function parseShares(shares: PartyShares): ResolvedShares {
  const splitFeePercent = shares.splitFeePercent ?? DEFAULT_SPLIT_FEE_PERCENT
  const { myShare, sharesTotal } = shares
  const isEven =
    myShare === null || sharesTotal === null || myShare < 0 || sharesTotal <= 0 || myShare * 2 === sharesTotal

  if (isEven) return { myShare: 1, sharesTotal: 2, splitFeePercent, isEven: true }
  return { myShare, sharesTotal, splitFeePercent, isEven: false }
}

/**
 * 결정석에서 내가 쥐는 메소.
 *
 * 비율이 균등이거나 안 적혔으면 `floor(가격 / 인원)` 과 **한 메소도 안 다르다**. 비율 식에
 * 반반(`myShare × 2 = 합`)을 넣으면 분자와 분모의 괄호가 같아져 게임 지급액만 남기 때문이고,
 * 그래서 비율을 안 쓰는 파티와 옛 기록의 금액이 이 기능 때문에 움직이지 않는다.
 *
 * @param partySize **균등일 때만** 쓴다. 비율을 쓰면 두 쪽이라 이 수가 안 들어간다.
 */
export function crystalPayoutMeso(priceMeso: number, partySize: number, shares: PartyShares): number {
  const { myShare, sharesTotal, splitFeePercent, isEven } = parseShares(shares)
  if (isEven) return Math.floor(priceMeso / partySize)

  // 게임이 두 쪽에 각각 주는 몫. 비율 약속은 이 값을 주고받아 맞춘다.
  const granted = Math.floor(priceMeso / 2)
  // 수수료를 무는 것은 보내는 쪽이고, 그쪽이 곧 비율이 작은 쪽이다.
  const senderShare = Math.min(myShare, sharesTotal - myShare)
  return Math.floor(
    (granted * (200 - splitFeePercent) * myShare) / (100 * sharesTotal - splitFeePercent * senderShare),
  )
}

/**
 * 저장할 파티 인원. 비율을 쓰면 **두 쪽**이라 2 다.
 *
 * 금액은 이 수를 안 보지만(비율 식에 인원이 없다) 보스 카드의 파티 배지 · 솔로/파티 필터 ·
 * 드롭 분배 기본값이 본다. 화면이 `2:1` 을 말하는데 저장이 4인이면 둘이 다른 말을 한다.
 */
export function partySizeForShares(shares: PartyShares, evenPartySize: number): number {
  return parseShares(shares).isEven ? evenPartySize : 2
}

/**
 * 내 몫을 백분율로. **소수 첫째 자리까지**고 딱 떨어지면 소수를 안 적는다(`50%` · `66.7%`).
 *
 * 나누는 것은 `내 비율 / 비율 합` 이다. `나 : 나머지` 로 적으면 2:1 과 4:2 가 다른 값처럼
 * 보이는데, 둘은 같은 약속이다.
 *
 * 정수 산술이다. 부동소수로 나누면 `33.300000000000004` 같은 값이 나온다.
 *
 * @example formatSharePercent(2, 3) // '66.7%'
 */
export function formatSharePercent(myShare: number, sharesTotal: number): string {
  const tenths = Math.round((myShare * 1000) / sharesTotal)
  const whole = Math.floor(tenths / 10)
  const rest = tenths % 10
  return rest === 0 ? `${whole}%` : `${whole}.${rest}%`
}

/**
 * 화면이 적는 비율 글자. **비율을 안 쓰는 행**이면 `null` 이라 인원만 선다.
 *
 * `parseShares` 의 `isEven` 과 묻는 것이 다르다. 그쪽은 **송금이 있나**이고 여기는 **비율을
 * 쓰나**다. 반반(`1:1`)은 송금이 없지만 사용자가 정한 비율이라 `50%` 로 적어야 한다.
 *
 * @example formatShareRatio({ myShare: 2, sharesTotal: 3, splitFeePercent: null }) // '66.7%'
 */
export function formatShareRatio(shares: PartyShares): string | null {
  const { myShare, sharesTotal } = shares
  // 0 은 값이다. 하나도 안 갖는 약속이라 `0%` 로 적어야 하고, 여기서 빼면 인원만 서서 균등처럼
  // 보인다.
  if (myShare === null || sharesTotal === null || myShare < 0 || sharesTotal <= 0) return null
  return formatSharePercent(myShare, sharesTotal)
}
