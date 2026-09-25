/**
 * 커서를 **숫자 기준**으로 되짚는 산수.
 *
 * 금액 칸이 **든 것**은 숫자만(`1000000000`)이고 **보이는 것**은 콤마가 낀 글자
 * (`1,000,000,000`)다. 한 자를 칠 때마다 콤마 자리가 바뀌어 글자 길이가 달라지는데, 커서를
 * 글자 인덱스로 들고 있으면 다시 그린 글자의 **다른 곳**을 가리킨다(`1,000|,000,000` 에 `34` 를
 * 치면 `100,0|00,000,034`).
 *
 * 숫자 개수는 그 사이에 안 변한다. 그래서 커서를 **앞에 숫자가 몇 개**로 바꿔 들고, 다시 그린
 * 글자에서 그 개수째 숫자 뒤로 되돌린다.
 *
 * 값이 파일로 나와 있는 것은 두 곳이 같은 규칙을 봐야 하기 때문이다. 칸이 칠 때(`onChangeText`)와
 * 자체 판이 누를 때(`NumberPad`)가 같은 자리에 넣어야 한다.
 */

/** 한 글자가 숫자인가. `toLocaleString` 이 넣는 것은 콤마뿐이지만 규칙을 글자에 안 매어 둔다. */
function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

/**
 * `index` 앞에 있는 숫자의 개수. 콤마는 안 센다.
 *
 * 콤마 바로 앞과 뒤가 같은 수를 낸다. 그 사이에는 숫자가 없으므로 되짚을 때 앞 숫자 뒤로 당겨진다.
 */
export function digitsBefore(text: string, index: number): number {
  const 끝 = Math.min(Math.max(index, 0), text.length)
  let 개수 = 0
  for (let i = 0; i < 끝; i += 1) {
    if (isDigit(text[i]!)) 개수 += 1
  }
  return 개수
}

/**
 * `digits` 번째 숫자 **바로 뒤**의 글자 인덱스. `digitsBefore` 의 짝이다.
 *
 * 0 이면 맨 앞이고, 숫자가 모자라면 맨 뒤다. 모자라는 경우는 값이 상한에 걸려 안 늘었을 때 난다.
 */
export function caretAfterDigits(text: string, digits: number): number {
  if (digits <= 0) return 0
  let 개수 = 0
  for (let i = 0; i < text.length; i += 1) {
    if (isDigit(text[i]!)) {
      개수 += 1
      if (개수 === digits) return i + 1
    }
  }
  return text.length
}
