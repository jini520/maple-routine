/**
 * `주간 보스 수입 이전` 의 수수료. 다른 계정 캐릭터의 메소를 경매장으로 옮길 때 빠지는 메소다.
 *
 * @see docs/features/cashbook.md 의 `입력`
 */

/** 옮길 메소에 붙는 수수료. 소수점은 버린다 */
export function transferFeeMeso(transferMeso: number, feePercent: number): number {
  return Math.floor((transferMeso * feePercent) / 100)
}
