// 웹(Tailwind v4)의 **테마와 무관한 축**을 RN 쪽 Tailwind v3 설정이 그대로 쓰게 만드는 다리
// ([[ADR-128]] 3단계).
//
// ── 왜 이 파일이 있는가 ────────────────────────────────────────────────────────────
//
// 두 앱이 서로 다른 Tailwind 메이저를 쓴다. NativeWind 안정판(4.2.6)이 v4 를 **명시적으로 거부하고**
// (`"NativeWind only supports Tailwind CSS v3"`), 웹은 이미 v4 로 배포 중이라 어느 쪽도 못 옮긴다.
// 그러면 `p-4` 같은 이름은 같은데 값이 갈리는 자리가 생긴다. 실측해 보니 이 저장소에서 실제로
// 갈리는 축은 셋뿐이다:
//
//   spacing        v4 는 `--spacing` 배수로 **모든 정수**를 만든다. v3 는 고정 계단이라
//                  `h-13`(2곳)·`h-22`(1곳)가 아예 없는 클래스가 된다 — 조용히 무시된다.
//   container      `max-w-2xs`(288, 파티 인원 모달 폭 하한 — [[ADR-121]])·`max-w-3xs` 가 v4 에만 있다.
//   borderRadius   v4 가 계단 이름을 한 칸 밀었다(v3 `rounded-sm`=2px / v4 `rounded-sm`=4px).
//                  지금 코드는 `rounded-full` 과 임의값(`rounded-[14px]`)만 써서 **영향이 0** 이지만,
//                  step 3~6 에서 누가 `rounded-sm` 을 쓰는 순간 조용히 두 배가 된다.
//
// 나머지 축(`fontSize`·`fontWeight`·`leading`·`tracking`·`screens`)은 두 메이저의 값이 **같다**.
// 같은 것을 굳이 파생시키면 파생 코드 자체가 새 오차원이 되므로 건드리지 않는다.
//
// ── 값을 어디서 가져오는가 — **읽던 것을 동결했다** ([[ADR-155]] 결정 4) ────────────
//
// 원래 이 파일은 웹이 실제로 컴파일에 쓰는 `tailwindcss/theme.css` 를 **읽었다**. 손으로 안 베끼면
// Tailwind 를 올릴 때 이쪽이 따라 움직이기 때문이었다.
//
// **그 웹이 없어졌다.** `packages/app-capacitor` 와 함께 v4 도 저장소에서 사라졌고(그 파일은 그
// 패키지의 `node_modules` 에 있었다), 그러면 «따라 움직일 상대» 가 없다. 남는 것은 RN 이 쓰는
// 축 값들뿐이고 그것은 이제 파생이 아니라 **이 앱의 치수**다.
//
// 그래서 마지막으로 읽은 값을 여기 고정했다 — **tailwindcss 4.3.3 의 `theme.css`**(2026-08-21).
// 읽어 오던 입력은 실제로 아래 셋뿐이었고, 그 위에 서는 파생(`deriveSpacing`)은 그대로 둔다.
//
// 값이 안 바뀌었다는 것은 `packages/app-rn/src/__tests__/tailwind-axes.test.ts` 의 «v4 축 파생» 이
// 지킨다 — `spacing[13]`·`max-w-2xs`(288, [[ADR-121]])처럼 **사람이 정한 수치**를 직접 단언한다.

/** v4 의 `--spacing` 배수. 이 하나에서 간격 계단 전체가 파생된다. */
const SPACING_VALUE = '0.25rem'

/** v4 의 `--container-*`. `max-w-2xs`(288 = 18rem) 처럼 컨테이너 스케일을 쓰는 유틸리티의 원천. */
const CONTAINER = {
  '3xs': '16rem',
  '2xs': '18rem',
  xs: '20rem',
  sm: '24rem',
  md: '28rem',
  lg: '32rem',
  xl: '36rem',
  '2xl': '42rem',
  '3xl': '48rem',
  '4xl': '56rem',
  '5xl': '64rem',
  '6xl': '72rem',
  '7xl': '80rem',
}

/** v4 의 `--radius-*`. v3 와 계단 이름이 한 칸 밀려 있어(`rounded-sm` 2px → 4px) 교체가 필요하다. */
const RADIUS = {
  xs: '0.125rem',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  '4xl': '2rem',
}

/**
 * v4 의 `--spacing` 배수를 v3 가 이해하는 **고정 계단**으로 펼친다.
 *
 * v4 는 `p-13`·`h-22` 같은 임의 정수를 그때그때 만들지만 v3 는 표에 있는 키만 안다. 그래서 표를
 * 만들어 준다 — 상한 96 은 v3 기본 스케일의 최댓값이고, 0.5 간격은 v4 가 허용하는 최소 단위다.
 */
function deriveSpacing(step) {
  const scale = { px: '1px' }
  for (let n = 0; n <= 96 * 2; n++) {
    const multiple = n / 2
    scale[String(multiple)] = `${round(multiple * step)}rem`
  }
  return scale
}

/** `0.25` × `1.5` 같은 곱에서 뜨는 부동소수 꼬리(0.375000000000001)를 자른다. */
function round(value) {
  return Number(value.toFixed(5))
}

const SPACING_STEP = Number.parseFloat(SPACING_VALUE)

/** v4 의 radius 계단. `none`·`full` 은 `theme.css` 에 없는 내장값이라 여기서만 더한다. */
const BORDER_RADIUS = {
  none: '0px',
  full: '9999px',
  ...RADIUS,
}

module.exports = {
  SPACING_STEP,
  /**
   * Tailwind v3 `theme` 조각. 호출부가 `theme.extend` 가 아니라 `theme` 에 얹어 **계단을 교체**한다
   * — `extend` 로 더하면 v3 의 옛 `rounded-sm`(2px)이 남아 이기지 못한다.
   */
  theme: {
    spacing: deriveSpacing(SPACING_STEP),
    borderRadius: BORDER_RADIUS,
    // v3 는 `maxWidth` 를 `spacing` 에서 파생하지 않으므로 셋을 각각 얹어야 한다. `screen-*`·`prose`
    // 같은 v3 전용 키는 웹에 없는 값이라 되살리지 않는다(RN 에 화면 폭 상수를 박을 이유도 없다).
    maxWidth: { none: 'none', full: '100%', ...CONTAINER },
    minWidth: { full: '100%', ...CONTAINER },
  },
}
