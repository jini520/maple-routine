// 아이템 분배 계산기의 계산.
//
// ══ 나누는 것은 **몫** 이 아니라 **수수료** 다 ═══════════════════════════════════════════
//
// 파티가 먹은 아이템을 한 명이 경매장에 팔아 나눠 줄 때 **수수료가 두 번** 떼인다 — 판매 한 번,
// 분배 한 번. 그래서 `정산 대상 ÷ 인원`을 그대로 보내면 **받는 사람만 분배 수수료를 물고** 먹은
// 사람은 안 물어 균등이 깨진다(10억·6인·3%/3% 에서 480만 메소 차이 — 의 표).
//
// 여기서 푸는 것은 그래서 나눗셈이 아니라 **역산**이다: 수수료를 두 번 거쳐도 여섯이 같아지려면
// 얼마를 보내야 하는가.
//
//   x(1 − d/100) = N − (n−1)x   →   x = 100N / (100n − d)
//
// **결정석은 여기 들어오지 않는다** — 게임이 파티원 각자에게 직접 지급하고, 그 몫은 보스 수익이
// 이미 계산한다(`features/boss-profit/auto-record.ts` 의 `Math.floor(priceMeso / partySize)`).
// 여기서 다시 세면 같은 돈을 두 번 센다.
//
// ── 정수 산술만 쓴다 ──────────────────────────────────────────
//
// `N * 0.97` 같은 부동소수 곱은 메소 단위에서 1 메소가 흔들리고, 그 1 메소가 "여섯이 같은가" 를
// 무너뜨린다. 대신 `100N / (100n − d)` 를 정수로 계산한다 — 그래서 중간값 `N × 100` 이 안전 정수
// 안에 있어야 하고, 그 제약이 곧 아래 판매가 상한이다.

/**
 * 수수료율(%) — MVP 실버 등급 이상이면 경매장 수수료가 5% → 3% 로 내려간다.
 *
 * ** 대상이다**(사용자 확인, 2026-08-23). 넥슨이 요율을 바꾸면 여기가 스탈이 된다 —
 * 앱이 추정해 채운 값이 아니다.
 */
export type FeePercent = 3 | 5

/**
 * 판매가 상한 — **정밀도에서 온 값이지 게임 규칙이 아니다**(열린 질문).
 *
 * `netProceeds × 100` 이 `Number.MAX_SAFE_INTEGER`(≈9.007×10¹⁵) 안에 있어야 한다. 같은 값을
 * `DropPricePad` 의 `MAX_MESO` 도 쓰는데, 그쪽 근거는 *"조 단위를 넘기면 `Number` 정밀도가 아니라
 * 화면이 먼저 깨진다"* 이고 여기서는 정밀도 근거가 하나 더 붙는다.
 */
export const MAX_SALE_PRICE_MESO = 9_999_999_999_999

/**
 * 파티원 수 상한 — `src/data/boss-crystal-prices.json` 의
 * `partySizeScaling.defaultMaxPartySize`(사용자 확인값, 2026-07-09)를 따른다.
 */
export const MAX_PARTY_SIZE = 6

export interface ItemSplitInput {
  salePriceMeso: number
  partySize: number
  saleFeePercent: FeePercent
  splitFeePercent: FeePercent
}

/**
 * 판매 수수료를 뗀 금액 — 먹은 사람 손에 실제로 들어오는 메소.
 *
 * **수수료 쪽을 내림한다** = 정산 대상이 커지는 쪽이다. 게임의 반올림 방향은 미확인이라
 * (열린 질문) 이 선택이 1 메소를 움직인다.
 */
export function netProceedsMeso(salePriceMeso: number, saleFeePercent: FeePercent): number {
  return salePriceMeso - Math.floor((salePriceMeso * saleFeePercent) / 100)
}

/**
 * 파티원 한 명에게 **보낼 금액**. 이것이 화면이 내놓는 숫자 전부다.
 *
 * 남는 메소는 내림으로 먹은 사람에게 간다 — 앱이 결정석을 나눌 때 쓰는 규칙과
 * 같다. `null` 은 **보낼 곳이 없다**는 뜻이다(1인 파티).
 */
export function transferPerMember(input: ItemSplitInput): number | null {
  if (input.partySize < 2) return null

  const netProceeds = netProceedsMeso(input.salePriceMeso, input.saleFeePercent)
  return Math.floor((netProceeds * 100) / (input.partySize * 100 - input.splitFeePercent))
}
