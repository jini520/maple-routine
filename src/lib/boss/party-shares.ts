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

/** 친 % 를 담는 비율 합. % 를 소수 셋째 자리까지 받으므로 `% × 1000` 이 내 비율이 된다. */
export const SHARE_PERCENT_TOTAL = 100_000

/** 친 % 글자의 모양. 정수 세 자리까지, 소수 세 자리까지. `1.` 처럼 치는 중인 글자도 받는다. */
const PERCENT_TEXT = /^(\d{1,3})(?:\.(\d{0,3}))?$/

/** 저장 칸 셋이 오는 모양. 전부 `null` 일 수 있고 그때가 균등 분배다. */
export interface PartyShares {
  myShare: number | null
  sharesTotal: number | null
  splitFeePercent: number | null
  /** 송금 수수료가 등급을 따라가나. 계산은 안 보고 기록에 함께 적힌다 */
  splitFeeAuto?: boolean
  /** 분배 방식 `제외`. 결정석을 팔지 않은 처치라 내 몫이 0 이고, 위 칸들은 숨겨 둔 분배다 */
  excluded?: boolean
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
 * 한쪽만 적힌 행은 **균등으로 읽는다**. 반쯤 쓰다 만 값으로 금액을 세면 화면이 조용히 틀린 수를 말한다.
 *
 * **반반(50%)은 균등이 아니다.** 비율은 늘 비율이다. 균등으로 읽으면 파티 인원을 3 으로 정해 둔 채 50% 를 고를 때
 * `가격 / 3` 으로 센다.
 *
 * **내 비율 0 은 균등이 아니다.** 이 몫을 하나도 안 갖는 약속이라 내 몫이 0 이 되어야 하는데,
 * 균등으로 읽으면 `가격 / 인원` 을 받은 것으로 센다.
 */
export function parseShares(shares: PartyShares): ResolvedShares {
  const splitFeePercent = shares.splitFeePercent ?? DEFAULT_SPLIT_FEE_PERCENT
  const { myShare, sharesTotal } = shares
  const isEven = myShare === null || sharesTotal === null || myShare < 0 || sharesTotal <= 0

  if (isEven) return { myShare: 1, sharesTotal: 2, splitFeePercent, isEven: true }
  return { myShare, sharesTotal, splitFeePercent, isEven: false }
}

/**
 * 결정석에서 내가 쥐는 메소.
 *
 * 비율이 안 적혔으면 `floor(가격 / 인원)` 이다. 반반(`myShare × 2 = 합`)은 비율 식의 분자와 분모의 괄호가 같아져
 * 게임 지급액 `floor(가격 / 2)` 만 남는다. 2인 균등과 한 메소도 안 다르고, 인원을 몇으로 정해 두었든 같다.
 *
 * `제외` 면 숨겨 둔 분배와 상관없이 0 이다.
 *
 * @param partySize **균등일 때만** 쓴다. 비율을 쓰면 두 쪽이라 이 수가 안 들어간다.
 */
export function crystalPayoutMeso(priceMeso: number, partySize: number, shares: PartyShares): number {
  if (shares.excluded === true) return 0
  const { myShare, sharesTotal, splitFeePercent, isEven } = parseShares(shares)
  if (isEven) return Math.floor(priceMeso / partySize)

  // 게임이 두 쪽에 각각 주는 몫. 비율 약속은 이 값을 주고받아 맞춘다.
  const granted = BigInt(Math.floor(priceMeso / 2))
  // 수수료를 무는 것은 보내는 쪽이고, 그쪽이 곧 비율이 작은 쪽이다.
  const senderShare = BigInt(Math.min(myShare, sharesTotal - myShare))
  const fee = BigInt(splitFeePercent)
  // 비율 합 100000 과 곱하면 안전 정수를 넘어 부동소수 내림이 한 메소 어긋난다.
  return Number(
    (granted * (200n - fee) * BigInt(myShare)) / (100n * BigInt(sharesTotal) - fee * senderShare),
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
 * 내 몫을 `%` 없는 백분율 글자로. **소수 셋째 자리까지**고 끝의 0 은 뗀다(`50` · `66.667`).
 *
 * 칸에 다시 적는 글자이기도 하다. 친 % 를 셋째 자리까지 받으므로 이 자리수면 친 값이 그대로 돌아온다.
 *
 * 나누는 것은 `내 비율 / 비율 합` 이다. `나 : 나머지` 로 적으면 2:1 과 4:2 가 다른 값처럼
 * 보이는데, 둘은 같은 약속이다. 정수 산술이다. 부동소수로 나누면 `33.300000000000004` 같은 값이 나온다.
 *
 * @example sharePercentText(2, 3) // '66.667'
 */
export function sharePercentText(myShare: number, sharesTotal: number): string {
  const thousandths = Math.round((myShare * SHARE_PERCENT_TOTAL) / sharesTotal)
  const whole = Math.floor(thousandths / 1000)
  const rest = String(thousandths % 1000).padStart(3, '0').replace(/0+$/, '')
  return rest === '' ? `${whole}` : `${whole}.${rest}`
}

/**
 * 내 몫을 백분율로(`50%` · `66.667%`). 자리수 규칙은 `sharePercentText` 와 같다.
 *
 * @example formatSharePercent(2, 3) // '66.667%'
 */
export function formatSharePercent(myShare: number, sharesTotal: number): string {
  return `${sharePercentText(myShare, sharesTotal)}%`
}

/**
 * 친 % 글자를 저장 칸으로(`85` → `85000 / 100000`). 0 ~ 100, 소수 셋째 자리까지만 받고 나머지는 `null`.
 *
 * **글자에서 바로 정수로 옮긴다.** 부동소수로 `33.333 × 1000` 을 곱하면 `33332.99…` 가 되어 한 칸 어긋난다.
 */
export function sharesFromPercentText(text: string): { myShare: number; sharesTotal: number } | null {
  const match = PERCENT_TEXT.exec(text)
  if (match === null) return null
  const myShare = Number(match[1]) * 1000 + Number((match[2] ?? '').padEnd(3, '0'))
  if (myShare > SHARE_PERCENT_TOTAL) return null
  return { myShare, sharesTotal: SHARE_PERCENT_TOTAL }
}

/**
 * % 칸이 받는 다음 글자. 받을 수 없는 글자(넷째 자리 · 100 초과 · 숫자 아님)면 앞 글자를 그대로 둔다.
 *
 * 앞자리 0 은 걷고(`05` → `5`), 소수점으로 시작하면 0 을 붙인다(`.` → `0.`).
 */
export function acceptSharePercentText(previous: string, next: string): string {
  if (next === '') return ''
  const text = (next.startsWith('.') ? `0${next}` : next).replace(/^0+(?=\d)/, '')
  return sharesFromPercentText(text) === null ? previous : text
}

/**
 * 화면이 적는 비율 글자. **비율을 안 쓰는 행**이면 `null` 이라 인원만 선다.
 *
 * @example formatShareRatio({ myShare: 2, sharesTotal: 3, splitFeePercent: null }) // '66.667%'
 */
export function formatShareRatio(shares: PartyShares): string | null {
  const { myShare, sharesTotal } = shares
  // 0 은 값이다. 하나도 안 갖는 약속이라 `0%` 로 적어야 하고, 여기서 빼면 인원만 서서 균등처럼
  // 보인다.
  if (myShare === null || sharesTotal === null || myShare < 0 || sharesTotal <= 0) return null
  return formatSharePercent(myShare, sharesTotal)
}
