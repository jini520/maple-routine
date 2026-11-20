// **테마와 무관한 축**(간격·radius·container)의 값. Tailwind v4 의 값을 NativeWind 의 Tailwind v3
// 설정에 얹는다.
//
// ── 왜 이 파일이 있는가 ────────────────────────────────────────────────────────────
//
// 이 앱의 치수는 Tailwind v4 의 값으로 정해져 있다. 그런데 NativeWind 안정판(4.2.6)이 v4 를
// **명시적으로 거부해서**(`"NativeWind only supports Tailwind CSS v3"`) 설정은 v3 로 쓴다.
// v3 기본값을 그대로 두면 클래스 이름은 같은데 값이 v4 와 갈리는 축이 셋 있다:
//
//   spacing        v4 는 `--spacing` 배수로 **모든 정수**를 만든다. v3 는 고정 계단이라
//                  `h-13`·`h-22` 같은 클래스가 아예 없다(조용히 무시된다).
//   container      `max-w-2xs`(288px)·`max-w-3xs` 가 v4 에만 있다.
//   borderRadius   v4 가 계단 이름을 한 칸 밀었다(v3 `rounded-sm`=2px / v4 `rounded-sm`=4px).
//                  지금 코드는 `rounded-sm` 을 쓰지 않지만, v3 값이면 누가 쓰는 순간 v4 의 절반으로 그려진다.
//
// `leading`·`tracking`·`screens` 는 두 메이저의 값이 **같다**. 같은 값을 여기서 다시 만들면 그 코드가
// 새 오차의 원인이 되므로 건드리지 않는다. 글자 크기와 굵기는 `typography.cjs` 가 따로 정한다.
//
// ── 값의 출처 ──────────────────────────────────────────────────────────────────
//
// 아래 값은 **tailwindcss 4.3.3 의 `theme.css`** 에서 옮겨 적었다. 저장소에는 v3 만 설치돼 있어
// 읽어 올 원본이 없고, 이 값이 곧 **이 앱의 치수**다. 그 위에 서는 파생(`deriveSpacing`)만 코드로 둔다.
//
// 값이 안 바뀌었다는 것은 `src/__tests__/tailwind-axes.test.ts` 의 `v4 축 파생` 이 지킨다.
// `spacing[13]`·`max-w-2xs`(288)처럼 **사람이 정한 수치**를 직접 단언한다.

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
 * 만들어 준다. 상한 96 은 v3 기본 스케일의 최댓값이고, 0.5 간격은 v4 가 허용하는 최소 단위다.
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
   * `extend` 로 더하면 v3 의 옛 `rounded-sm`(2px)이 남아 이기지 못한다.
   */
  theme: {
    spacing: deriveSpacing(SPACING_STEP),
    borderRadius: BORDER_RADIUS,
    // v3 는 `maxWidth` 를 `spacing` 에서 파생하지 않으므로 셋을 각각 얹어야 한다. `screen-*`·`prose`
    // 같은 v3 전용 키는 쓰는 곳이 없어 되살리지 않는다(RN 에 화면 폭 상수를 박을 이유도 없다).
    maxWidth: { none: 'none', full: '100%', ...CONTAINER },
    minWidth: { full: '100%', ...CONTAINER },
  },
}
