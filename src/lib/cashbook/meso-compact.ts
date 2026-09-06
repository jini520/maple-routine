/**
 * 메소를 한 단위로 줄여 적는 표기. 캘린더 칸처럼 좁은 자리용.
 *
 * `formatMesoUnits`(`lib/drop/drop-price.ts`)와 목적이 다르다. 그쪽은 입력한 값을 **정확히** 되읽어
 * 주는 자리라 1억 2345만 6789처럼 단위를 다 적지만, 여기는 **화면 폭 ÷ 7** 안에 들어가야 하므로
 * 단위 하나만 남긴다. 두 함수는 서로를 대체하지 않는다.
 *
 * 자릿수는 단위가 정한다(사용자 지정). **만 이하는 소수점이 없고 억 이상은 소수 둘째 자리까지**다.
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
    // **소수 둘째 자리까지**다(사용자 지정). 자리가 커져도 안 줄인다.
    //
    // 유효숫자 넷이던 때는 같은 화면의 두 수가 소수 자리 수가 달라(`129.4억` 옆에 `5.432억`)
    // 눈이 자릿수를 못 잡았다.
    //
    // 자르는 것이지 반올림이 아니다. 올림하면 `9,999만` 이 `1억` 이 되는 것과 같은 일이 억
    // 자리에서도 나서, 아직 안 넘은 값이 넘은 것으로 보인다.
    const eok = Math.trunc((meso / EOK) * 100) / 100
    return `${withThousands(trimTrailingZeros(eok.toFixed(2)))}억`
  }

  if (magnitude >= MAN) return `${Math.trunc(meso / MAN).toLocaleString()}만`

  return meso.toLocaleString()
}
