/** 분배 비율 고르개(`ShareField`)의 계산. 가로 위치를 칸으로 옮기고 합이 줄 때 내 비율을 맞춘다. */

export interface Shares {
  myShare: number
  sharesTotal: number
}

/** 비율 합의 상한. 입력 편의에서 온 값이지 게임 규칙이 아니다. */
export const MAX_SHARES_TOTAL = 9

/**
 * 가로 위치가 가리키는 비율. **0 부터** 합까지고, 가장 가까운 눈금으로 붙는다.
 *
 * 0 은 이 몫을 하나도 안 갖는 약속이다. 결정석은 내가 다 넘기고 아이템만 갖는 파티가 있다.
 *
 * 눈금이 합보다 하나 많다(0 을 세므로). 손잡이가 칸 가운데가 아니라 눈금 위에 서는 이유다.
 * 트랙 밖은 끝 눈금이다.
 */
export function shareAt(x: number, width: number, sharesTotal: number): number {
  if (width <= 0) return 0
  return Math.min(Math.max(Math.round((x / width) * sharesTotal), 0), sharesTotal)
}

/**
 * 합을 바꾼 뒤의 비율. **내 비율이 합을 넘으면 합까지 내린다.**
 *
 * 합을 줄이는 쪽으로만 일어난다. 안 맞추면 내 비율이 합보다 커져 내 몫이 100%를 넘는다.
 */
export function withSharesTotal(shares: Shares, sharesTotal: number): Shares {
  const next = Math.min(Math.max(sharesTotal, 2), MAX_SHARES_TOTAL)
  return { myShare: Math.min(shares.myShare, next), sharesTotal: next }
}

/** 비율이 균등인가. 합이 파티 인원의 배수로 내 비율에 떨어지면 1/n 과 같은 약속이다. */
export function isEvenShares(shares: Shares, partySize: number): boolean {
  return shares.myShare * partySize === shares.sharesTotal
}
