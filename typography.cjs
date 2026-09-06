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
// (실측 2026-09-01 — 10px 글자의 줄 상자가 iOS 12.0 · 안드로이드 15.2). 글꼴을 심은 뒤에도
// **줄 상자 계산 방식은 플랫폼마다 다르므로** 이 표가 필요하다. 두 플랫폼이 쓰는 글꼴도 갈린다
// (iOS Pretendard · 안드로이드 Noto Sans KR, `app-font.ts`).
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

// ## 줄 높이의 하한은 1.30em 이다 (쉼표가 나오는 자리)
//
// RN 은 줄 높이가 글꼴의 자연 줄 상자보다 낮으면 **모자란 만큼의 절반을 descent 에서 깎는다**
// (`CustomLineHeightSpan`). 안드로이드 글꼴(Noto Sans KR)의 자연 상자가 1.448em 이고 쉼표는
// 기준선 아래로 0.214em 내려가므로, 줄 높이가 1.30em 밑이면 **쉼표 꼬리가 잘린다**(실측).
// 이 표는 1.30em 을 넘지만 `2xl`·`30`·`32`·`chip`·`chip-xs` 는 그 아래다. 그 크기로 쉼표가 든
// 숫자를 그릴 때는 `leading-snug`(1.375em)을 함께 준다. 한글 라벨은 0.088em 이라 안 걸린다.

/**
 * 앱이 실제로 쓰는 넷. 심은 글꼴의 굵기와 같다.
 *
 * **800(`extrabold`)은 표에 없다.** 안드로이드가 그 굵기에서 글자를 잰 폭보다 넓게 그려, 마지막
 * 음절이 다음 줄로 넘어가 상자에 가려 사라졌다(`주간` 이 `주` 로 보였다). 굵기 문턱은 기기를 타서
 * 700 도 안전하다고 단정할 수 없지만, 관측된 것은 800 이라 거기까지 끊는다. 최대는 `bold` 다.
 */
const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}

module.exports = { fontSize, fontWeight }
