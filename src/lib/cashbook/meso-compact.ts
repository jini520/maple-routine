/**
 * 메소를 한 단위로 줄여 적는 표기. 캘린더 칸처럼 좁은 자리용.
 *
 * `formatMesoUnits`(`lib/drop/drop-price.ts`)와 목적이 다르다. 그쪽은 입력한 값을 **정확히** 되읽어
 * 주는 자리라 1억 2345만 6789처럼 단위를 다 적지만, 여기는 **화면 폭 ÷ 7** 안에 들어가야 하므로
 * 단위 하나만 남기고 유효숫자 넷으로 자른다. 두 함수는 서로를 대체하지 않는다.
 *
 * 만 미만을 0만 으로 뭉개지 않는다. 적었는데 0 으로 보이면 없음 과
 * 구분이 사라진다.
 */

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

export function formatMesoCompact(meso: number): string {
  if (meso === 0) return '0'

  const magnitude = Math.abs(meso)
  if (magnitude >= EOK) {
    const eok = meso / EOK
    // 유효숫자 넷을 유지한다. 자리가 커질수록 소수 자리가 줄어든다.
    const scale = Math.abs(eok)
    const digits = scale >= 1000 ? 0 : scale >= 100 ? 1 : scale >= 10 ? 2 : 3
    return `${withThousands(trimTrailingZeros(eok.toFixed(digits)))}억`
  }

  if (magnitude >= MAN) return `${Math.trunc(meso / MAN).toLocaleString()}만`

  return meso.toLocaleString()
}
