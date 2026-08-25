/**
 * 앞 키패드의 **타건 규칙**([[ADR-124]] 결정 5) — 판정과 그리기를 가른다([[ADR-147]] 결정 8).
 *
 * 이 키패드가 존재하는 이유는 **OS 키보드를 안 부르기 위해서**다. 메소는 자릿수가 커서 시스템
 * 숫자 키패드로는 0 을 세게 되고(`keyboardType="numeric"` 이 못 고치는 것이 그것이다),
 * `KeyboardAvoidingView` 는 플랫폼마다 동작이 갈리는 데다 시트의 동적 높이와 겹친다.
 * **앱이 자기 키패드를 그리면 보정할 것이 애초에 없다.**
 */

/** 자릿수 상한 — 조 단위를 넘기면 `Number` 정밀도가 아니라 **화면이 먼저 깨진다.** */
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
 * 한 번 친 결과. **값이 왼쪽으로만 자란다** — 그래서 지금 무엇을 치고 있는지가 흔들리지 않는다
 * ([[ADR-124]] 결정 5 가 억/만 접기를 주 표기에서 뺀 이유와 같다).
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
