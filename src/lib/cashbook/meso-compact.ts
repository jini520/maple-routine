/**
 * 메소를 한 단위로 줄여 적는 표기. 캘린더 칸처럼 좁은 자리용.
 *
 * `formatMesoUnits`(`lib/drop/drop-price.ts`)와 목적이 다르다. 그쪽은 입력한 값을 **정확히** 되읽어
 * 주는 자리라 1억 2345만 6789처럼 단위를 다 적지만, 여기는 **화면 폭 ÷ 7** 안에 들어가야 하므로
 * 단위 하나만 남긴다. 두 함수는 서로를 대체하지 않는다.
 *
 * 자릿수는 단위가 정한다(사용자 지정). **만 이하는 소수점이 없고, 억 이상은 숫자 넷까지 적되
 * 소수는 둘째 자리가 상한**이다.
 *
 * 만 미만을 0만 으로 뭉개지 않는다. 적었는데 0 으로 보이면 없음 과
 * 구분이 사라진다.
 */

/** 억·조에서 적는 숫자의 최대 개수. 정수부와 소수부를 합쳐 센다. */
const MAX_DIGITS = 4
/** 그 안에서도 소수는 여기까지다. 정수부가 짧아도 셋째 자리는 안 적는다. */
const MAX_DECIMALS = 2

const JO = 1_000_000_000_000
const EOK = 100_000_000
const MAN = 10_000

/** 정수부에만 콤마를 넣은 문자열. `toLocaleString` 에 옵션을 안 주는 것은 Hermes 의 Intl 편차 때문이다. */
function withThousands(fixed: string): string {
  const [integer, fraction] = fixed.split('.')
  const grouped = Number(integer).toLocaleString()
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

function trimTrailingZeros(fixed: string): string {
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

/**
 * 단위로 나눈 수를 **숫자 넷까지, 소수는 둘째 자리까지** 적는다. 둘 중 먼저 걸리는 쪽이 이긴다.
 *
 *   5.432 → `5.43`     정수 한 자리라 소수 셋이 들어갈 자리가 있어도 둘이 상한이다
 *   129.4 → `129.4`    정수 셋이라 소수는 하나뿐이다
 *   1294  → `1,294`    정수가 이미 넷이라 소수가 없다
 */
function scaled(value: number): string {
  const intDigits = String(Math.floor(Math.abs(value))).length
  const digits = Math.min(MAX_DECIMALS, Math.max(0, MAX_DIGITS - intDigits))
  return withThousands(trimTrailingZeros(value.toFixed(digits)))
}

/**
 * 단위를 고를 때 쓰는 크기. **반올림이 문턱을 넘길 수 있어** 값 그대로 안 쓴다.
 *
 * 999,990,000,000 은 9,999.9억이라 억으로 고르면 반올림해서 `10,000억`(다섯 자리)이 된다.
 * 여기서 미리 올려 조로 보내면 `1조` 다. 9,999억 자체는 네 자리라 안 올린다.
 *
 * 만은 자르므로(`Math.trunc`) 이런 일이 없다. 9,999만이 상한이고 그 위는 이미 억이다.
 */
function roundedMagnitude(meso: number): number {
  const magnitude = Math.abs(meso)
  // **넘칠 때만 올린다.** 9,999억은 네 자리로 멀쩡하다. 그 위에서만 다섯 자리가 된다.
  if (magnitude >= EOK && Math.round(magnitude / EOK) > 9_999) return JO
  return magnitude
}

export function formatMesoCompact(meso: number): string {
  if (meso === 0) return '0'

  // **반올림한 뒤의 크기로 단위를 고른다.** 값으로 고르면 9,999억을 넘는 순간 반올림이
  // `10,000억`(다섯 자리)을 만든다. 조가 없으면 1조 2,940억도 `12,940억`이 된다.
  const magnitude = roundedMagnitude(meso)
  if (magnitude >= JO) return `${scaled(meso / JO)}조`
  // 숫자는 넷까지, 소수는 둘째 자리까지다(사용자 지정). 반올림한다.
  if (magnitude >= EOK) return `${scaled(meso / EOK)}억`

  if (magnitude >= MAN) return `${Math.trunc(meso / MAN).toLocaleString()}만`

  return meso.toLocaleString()
}
