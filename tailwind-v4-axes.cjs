// 웹(Tailwind v4)의 **테마와 무관한 축**을 RN 쪽 Tailwind v3 설정이 그대로 쓰게 만드는 다리
// ([[ADR-127]] 3단계).
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
// ── 값을 어디서 가져오는가 ──────────────────────────────────────────────────────────
//
// **웹이 실제로 컴파일에 쓰는 그 파일**(`tailwindcss/theme.css`)을 읽어 판다. 손으로 베끼지 않으므로
// Tailwind 를 올리면 이쪽이 따라 움직인다. 베껴 두면 한쪽만 바뀌어도 아무도 모른다.
const { readFileSync } = require('node:fs')

/** 웹이 쓰는 tailwindcss(v4)의 기본 테마 파일. **웹 패키지 기준으로** 풀어야 루트의 v3 가 안 잡힌다. */
const V4_THEME_CSS = readFileSync(
  require.resolve('tailwindcss/theme.css', {
    paths: [require('node:path').join(__dirname, 'packages/app-capacitor')],
  }),
  'utf8',
)

/** `--<name>: <value>;` 선언을 전부 뽑는다. */
function readCustomProperties(prefix) {
  const found = new Map()
  const pattern = new RegExp(`--${prefix}(?<name>[a-z0-9-]*):\\s*(?<value>[^;]+);`, 'g')
  for (const match of V4_THEME_CSS.matchAll(pattern)) {
    found.set(match.groups.name, match.groups.value.trim())
  }
  return found
}

function requireValue(map, key, what) {
  const value = map.get(key)
  // 조용히 비면 그 축이 통째로 사라진 채 빌드가 성공한다 — Tailwind 가 `theme.css` 형식을 바꾸면
  // 여기서 터뜨린다.
  if (value === undefined) throw new Error(`tailwindcss/theme.css 에서 ${what} 를 못 찾았다`)
  return value
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

const SPACING_STEP = Number.parseFloat(requireValue(readCustomProperties('spacing'), '', '--spacing'))

/** `max-w-2xs` 처럼 컨테이너 스케일을 쓰는 유틸리티가 v3 에도 서게 한다. */
const CONTAINER = Object.fromEntries(
  [...readCustomProperties('container-')].map(([name, value]) => [name, value]),
)

/** v4 의 radius 계단. `none`·`full` 은 `theme.css` 에 없는 내장값이라 여기서만 더한다. */
const BORDER_RADIUS = {
  none: '0px',
  full: '9999px',
  ...Object.fromEntries([...readCustomProperties('radius-')].map(([name, value]) => [name, value])),
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
