/**
 * 금액 칸의 글자 규칙. 친 글자를 남길지 판정하고, 값과 글자를 서로 옮긴다.
 *
 * 금액을 치는 길은 `InputCard` 하나다. OS 숫자 키보드가 넣은 글자가 `acceptMesoText` 를 지나
 * 칸에 남는다. 앱이 직접 그리던 키패드는 없앴다.
 */

/** 자릿수 상한. 조 단위를 넘기면 `Number` 정밀도가 아니라 **화면이 먼저 깨진다.** */
export const MAX_MESO = 9_999_999_999_999

/** 상한의 자릿수. 0 만 길게 이어지면 값으로는 안 걸려서 이것으로도 막는다. */
const MAX_MESO_DIGITS = String(MAX_MESO).length

/**
 * 칸에 남길 글자. **숫자만 남긴다**.
 *
 * **앞자리 0 을 안 걷는다.** `80000000000` 에서 `8` 을 지운 `0000000000` 은 편집 중이지 0 이
 * 아니다. 여기서 접으면 칸이 비어 처음부터 다시 쳐야 한다. 걷는 것은 커서가 빠질 때
 * (`settleMesoText`)다.
 *
 * 상한을 넘기면 안 먹는다.
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
 * 비워 둔 칸과 0 을 가르는 칸의 값. **빈 칸은 `null`** 이고 `0` 은 0 이다.
 *
 * 사냥 폼의 조각 가격이 쓴다. 빈 칸은 가격을 안 적은 것이라 그 조각이 보관에 들고, 0 은 0 메소에 판 기록이다.
 */
export function optionalMesoValueOf(text: string): number | null {
  return text === '' ? null : Number(text)
}

/**
 * `optionalMesoValueOf` 의 짝. `null` 은 빈 칸이고 **0 은 `0`** 이다.
 *
 * 커서가 빠질 때 두 함수를 이어 부르면 앞자리 0 만 걷힌다. 0 을 빈 칸으로 접으면 적은 값이 보관으로 바뀐다.
 */
export function optionalMesoTextOf(value: number | null): string {
  return value === null ? '' : String(value)
}

/**
 * 커서가 빠질 때의 정리. 앞자리 0 을 걷고 0 이면 빈 칸이다.
 *
 * 타건마다 하면 편집 중인 `0000000000` 이 즉시 빈 칸이 되어 처음부터 다시 쳐야 한다.
 */
export function settleMesoText(text: string): string {
  return mesoTextOf(mesoValueOf(text))
}
