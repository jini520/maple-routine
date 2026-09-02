/**
 * 금액을 치는 **두 길의 규칙**. 판정과 그리기를 가른다.
 *
 * ① `applyMesoKey`. **앱 키패드**의 타건. 그 키패드가 있는 이유는 OS 키보드를
 *    안 부르기 위해서 이고, 안 부르면 `KeyboardAvoidingView` 도 시트 높이 보정도 필요 없어진다.
 *    **그 이득은 그 화면이 키보드를 한 번도 안 부를 때만 있다**. 지금 그런 화면은 `DropPricePad`
 *  하나다.
 * ② `parseMesoText`. **OS 숫자 키보드**가 넣은 글자. 가계부의 지출·수입 시트는
 *    내용·시세 칸 때문에 어차피 키보드를 부르므로, 그 위에 앱 키패드를 또 두지 않는다.
 *
 * **상한 규칙은 둘이 같다**. 넘기는 입력은 안 먹는다. 갈라지면 어느 길로 쳤나 로 저장되는 값이
 * 달라진다.
 */

/** 자릿수 상한. 조 단위를 넘기면 `Number` 정밀도가 아니라 **화면이 먼저 깨진다.** */
export const MAX_MESO = 9_999_999_999_999

export const MESO_KEYS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '00',
  '0',
  'del',
] as const

export type MesoKey = (typeof MESO_KEYS)[number]

/**
 * 한 번 친 결과. **값이 왼쪽으로만 자란다**. 그래서 지금 무엇을 치고 있는지가 흔들리지 않는다
 * (가 억/만 접기를 주 표기에서 뺀 이유와 같다).
 *
 * 상한을 넘기는 타건은 **먹지 않는다.** 잘라서 넣으면 사용자가 친 것과 다른 값이 남는다.
 */
export function applyMesoKey(meso: number, key: MesoKey): number {
  if (key === 'del') {
    return Math.floor(meso / 10)
  }
  const next = Number(`${meso}${key}`)
  return Number.isFinite(next) && next <= MAX_MESO ? next : meso
}

/**
 * 칸에 들어온 글자를 값으로. **숫자만 남긴다.**
 *
 * 칸이 콤마를 그리므로 들어오는 글자에 콤마가 섞이고, 붙여넣기·자동완성은 그 밖의 것도 들여보낸다.
 * 다 걷고 남은 자릿수가 값이다(앞자리 0 은 `Number` 가 접는다).
 *
 * **다 지우면 0 이다**. 그대로 둔다로 하면 지운 것이 화면에 다시 나타난다.
 *
 * 상한을 넘기면 **안 먹는다**(`applyMesoKey` 와 같은 규칙). 잘라 넣으면 사용자가 친 것과 다른
 * 값이 남는다.
 */
export function parseMesoText(meso: number, text: string): number {
  const digits = text.replace(/[^0-9]/g, '')
  if (digits === '') {
    return 0
  }
  const next = Number(digits)
  return Number.isFinite(next) && next <= MAX_MESO ? next : meso
}

/** 상한의 자릿수. 0 만 길게 이어지면 값으로는 안 걸려서 이것으로도 막는다. */
const MAX_MESO_DIGITS = String(MAX_MESO).length

/**
 * 칸에 남길 글자. **숫자만 남긴다**.
 *
 * `parseMesoText` 와 갈리는 자리는 하나다: **앞자리 0 을 안 걷는다.** `80000000000` 에서 `8` 을
 * 지운 `0000000000` 은 편집 중이지 0 이 아니다. 여기서 접으면 칸이 비어 처음부터 다시 쳐야 한다.
 *
 * 상한을 넘기면 안 먹는다(`applyMesoKey`·`parseMesoText` 와 같은 규칙).
 */
export function acceptMesoText(prev: string, next: string): string {
  const digits = next.replace(/[^0-9]/g, '')
  if (digits === '') return ''
  if (digits.length > MAX_MESO_DIGITS) return prev
  const value = Number(digits)
  return Number.isFinite(value) && value <= MAX_MESO ? digits : prev
}

/** 셈에 쓰는 값. 빈 칸도 0 이다. */
export function mesoValueOf(text: string): number {
  return text === '' ? 0 : Number(text)
}

/** 값을 칸의 글자로. **0 은 빈 칸**이다(자리표시자 `0` 이 그 자리를 대신한다). */
export function mesoTextOf(value: number): string {
  return value === 0 ? '' : String(value)
}

/**
 * 커서가 빠질 때 정리한다. 앞자리 0 을 걷고 0 이면 빈 칸이다.
 *
 * 타건마다 하면 편집 중인 `0000000000` 이 즉시 빈 칸이 되어 결정 1 이 막으려던 그것이 되살아난다.
 */
export function settleMesoText(text: string): string {
  return mesoTextOf(mesoValueOf(text))
}
