/**
 * 금액 칸의 단위(기본 · 만 · 억) 환산. 칸이 든 **단위 글자**와 카드가 내보내는 **메소 글자**를 서로 옮긴다.
 *
 * **곱하지 않고 소수점 자리를 옮긴다.** `8.29 * 1e8` 은 828999999.9999999 라 곱하면 1메소가 사라지고,
 * `Math.round` 로 덮어도 자릿수가 커지면 다시 어긋난다.
 */
import { MAX_MESO, acceptMesoText } from './meso-pad'
import type { MesoUnit } from '../../../types/meso-unit'

export const MESO_UNITS = ['base', 'man', 'eok'] as const satisfies readonly MesoUnit[]

/** 세그먼트의 글자. 값 칸 오른쪽 단위 글자(`억 메소`)의 머리이기도 하다. */
export const MESO_UNIT_LABELS: Record<MesoUnit, string> = { base: '기본', man: '만', eok: '억' }

/** 소수 자릿수. 1메소까지 받으므로 만은 4자리, 억은 8자리다. */
const DECIMALS: Record<MesoUnit, number> = { base: 0, man: 4, eok: 8 }

/** 정수부의 앞자리 0 걷기. 다 0 이면 `0` 하나를 남긴다. */
function trimLeadingZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, '')
}

/**
 * 메소 글자를 그 단위의 글자로. `9990000000` 을 억으로 옮기면 `99.9` 다.
 *
 * 기본 단위는 **글자를 그대로 둔다.** 편집 중인 앞자리 0 을 걷는 것은 `settleMesoText` 의 일이다.
 */
export function unitTextOf(mesoText: string, unit: MesoUnit): string {
  const decimals = DECIMALS[unit]
  if (mesoText === '' || decimals === 0) return mesoText
  const padded = mesoText.padStart(decimals + 1, '0')
  const int = trimLeadingZeros(padded.slice(0, -decimals))
  const frac = padded.slice(-decimals).replace(/0+$/, '')
  return frac === '' ? int : `${int}.${frac}`
}

/** 단위 글자를 메소 글자로. `unitTextOf` 의 짝이다. 치는 중인 `99.` 은 `99` 와 같은 값이다. */
export function mesoTextOfUnit(unitText: string, unit: MesoUnit): string {
  const decimals = DECIMALS[unit]
  if (unitText === '' || decimals === 0) return unitText
  const [int = '', frac = ''] = unitText.split('.')
  return trimLeadingZeros(`${int}${frac.padEnd(decimals, '0').slice(0, decimals)}`.padStart(1, '0'))
}

/**
 * 칸에 남길 단위 글자. 숫자와 소수점 하나만 남기고, 받을 수 없으면 앞 글자를 그대로 둔다.
 *
 * 기본 단위는 `acceptMesoText` 와 같다. 소수 자릿수가 1메소를 넘거나 메소로 옮긴 값이 상한을
 * 넘으면 안 먹는다. 소수점부터 치면 앞에 `0` 을 붙인다.
 */
export function acceptUnitText(prev: string, next: string, unit: MesoUnit): string {
  const decimals = DECIMALS[unit]
  if (decimals === 0) return acceptMesoText(prev, next)
  const cleaned = next.replace(/[^0-9.]/g, '')
  if (cleaned === '') return ''
  const [int, frac, ...rest] = cleaned.split('.')
  if (rest.length > 0 || (frac !== undefined && frac.length > decimals)) return prev
  const text = int === '' ? `0${cleaned}` : cleaned
  const meso = mesoTextOfUnit(text, unit)
  return meso.length > String(MAX_MESO).length || Number(meso) > MAX_MESO ? prev : text
}

/**
 * 칸에 보이는 글자. **정수부에만 콤마를 넣고** 소수점과 소수부는 친 그대로 둔다.
 *
 * 치는 중인 `99.` 을 `99` 로 접으면 소수점을 칠 수 없다.
 */
export function shownUnitText(unitText: string): string {
  if (unitText === '') return ''
  const dot = unitText.indexOf('.')
  const int = dot === -1 ? unitText : unitText.slice(0, dot)
  return `${Number(int).toLocaleString()}${dot === -1 ? '' : unitText.slice(dot)}`
}
