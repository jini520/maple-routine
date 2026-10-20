/**
 * 메소가 아닌 칸의 빠른 칩 눈금.
 *
 * 낱개로 세는 값이다. 조각 개수 · 판 개수 · 수량 · 메소 획득량이 여기 든다. 메소의 10배 눈금
 * (`MESO_QUICK_ADDS`)은 자릿수를 짚는 것이라 이런 칸에서는 뜻이 없다. 84개를 만드는 데 필요한
 * 것은 `+1억` 이 아니라 `+10` 을 여덟 번이다.
 *
 * 메소 눈금과 파일을 나눈 것은 이름이 말하는 것이 달라서다. 그쪽은 메소를 넣는 자리의 감각을
 * 세 화면이 나눠 갖는 상수다.
 */
export const COUNT_QUICK_ADDS = [
  { label: '+10', value: 10 },
  { label: '+1', value: 1 },
] as const

/**
 * 메소마켓 시세(메포)의 눈금. **큰 것이 왼쪽이다**(사용자 지정).
 *
 * 시세가 네 자리라 칩 넷이 곧 자릿수 넷이다. 1,350 을 +1000 한 번 · +100 세 번 · +10 다섯 번으로
 * 만든다.
 */
export const POINT_QUICK_ADDS = [
  { label: '+1000', value: 1000 },
  { label: '+100', value: 100 },
  { label: '+10', value: 10 },
  { label: '+1', value: 1 },
] as const

/**
 * 캐시로 낸 금액(원)의 눈금. **큰 것이 왼쪽이다**(사용자 지정).
 *
 * 메소 눈금을 그대로 두면 1만 원짜리를 치는 카드에 `+100억` 이 뜬다.
 */
export const CASH_QUICK_ADDS = [
  { label: '+1만', value: 10_000 },
  { label: '+5천', value: 5_000 },
  { label: '+1천', value: 1_000 },
  { label: '+100', value: 100 },
] as const

/**
 * 메포로 낸 금액의 눈금. **큰 것이 왼쪽이다**(사용자 지정).
 *
 * 위 `POINT_QUICK_ADDS` 는 메포 시세를 치는 칸의 눈금이라 이 칸과 값이 다르다.
 */
export const POINT_AMOUNT_QUICK_ADDS = [
  { label: '+500', value: 500 },
  { label: '+100', value: 100 },
  { label: '+10', value: 10 },
  { label: '+1', value: 1 },
] as const
