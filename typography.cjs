// 앱의 글자 계단 — **크기·줄 높이·굵기를 한 곳에서 못박는다** ([[ADR-196]]).
//
// ## 왜 값으로 적나
//
// Tailwind 기본 계단은 `rem` 이고 NativeWind 가 `INLINE_REM`(16)으로 접는다. 한 겹을 더 거치는
// 셈이라, 그 배수를 건드리면 계단 전체가 조용히 따라 움직인다. 여기서는 px 로 적어 그 연결을 끊는다.
//
// ## 왜 줄 높이를 빠짐없이 적나
//
// **줄 높이가 없으면 RN 이 플랫폼 폰트 메트릭으로 줄 상자를 잡는다.** iOS 는 타이트하고
// 안드로이드는 ascent/descent 를 넉넉히 잡아, 같은 코드가 두 플랫폼에서 다른 높이로 나온다
// (실측 2026-09-01 — 10px 글자의 줄 상자가 iOS 12.0 · 안드로이드 15.2). Pretendard 를 심어 글꼴을
// 통일한 뒤에도 **줄 상자 계산 방식은 플랫폼마다 다르므로** 이 표가 필요하다.
//
// Tailwind 기본 계단을 `extend` 로 더하지 않고 **교체한다**. 더하면 여기 없는 이름
// (`text-4xl` 등)이 살아남아 줄 높이 없는 자리가 다시 생긴다. 이름이 표에 있는지는
// `src/__tests__/typography-policy.test.ts` 가 검사한다.
//
// ## 비율
//
// 본문은 1.45 언저리다. 받침 있는 한글이 눌리지 않을 만큼이다. 큰 글자는 그만큼 띄우면 헐렁해서
// 20px 부터 1.4 · 22px 부터 1.3 · 30px 부터 1.2 로 좁힌다(Tailwind 기본 계단과 같은 결이다).
//
// 칩은 한 줄짜리 라벨이라 본문 줄 높이를 쓰면 상자가 헐렁하다. 자기 계단을 따로 둔다.

/** `[크기, { lineHeight }]` — Tailwind 의 `fontSize` 형식 그대로다. */
const fontSize = {
  8: ['8px', { lineHeight: '12px' }],
  9: ['9px', { lineHeight: '13px' }],
  10: ['10px', { lineHeight: '15px' }],
  11: ['11px', { lineHeight: '16px' }],
  xs: ['12px', { lineHeight: '17px' }],
  13: ['13px', { lineHeight: '19px' }],
  sm: ['14px', { lineHeight: '20px' }],
  15: ['15px', { lineHeight: '22px' }],
  base: ['16px', { lineHeight: '23px' }],
  lg: ['18px', { lineHeight: '25px' }],
  19: ['19px', { lineHeight: '27px' }],
  xl: ['20px', { lineHeight: '28px' }],
  22: ['22px', { lineHeight: '29px' }],
  23: ['23px', { lineHeight: '30px' }],
  '2xl': ['24px', { lineHeight: '31px' }],
  30: ['30px', { lineHeight: '36px' }],
  '3xl': ['30px', { lineHeight: '36px' }],
  32: ['32px', { lineHeight: '38px' }],

  // 칩(배지) 계단. 한 줄이라 좁다. `chip` 과 `chip-sm` 은 **줄 높이가 같아** 글자 크기가 달라도
  // 배지 높이가 안 갈린다 — 난이도 배지가 10px 인데 상태 배지와 나란히 서기 때문이다.
  chip: ['12px', { lineHeight: '14px' }],
  'chip-sm': ['10px', { lineHeight: '14px' }],
  'chip-xs': ['9px', { lineHeight: '11px' }],
}

/** 앱이 실제로 쓰는 다섯. Pretendard 에 심은 굵기와 같다. */
const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
}

module.exports = { fontSize, fontWeight }
