/**
 * 금액 칸마다 마지막으로 고른 단위. 입력 카드가 그 칸을 열 때 이 단위로 선다.
 *
 * 모르는 칸 이름이나 값은 버린다. 읽는 쪽이 없는 칸을 `기본` 으로 연다.
 */
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'
import type { MesoUnit } from '../types/meso-unit'

const UNITS: readonly string[] = ['base', 'man', 'eok'] satisfies readonly MesoUnit[]

export async function getMesoUnits(): Promise<Record<string, MesoUnit>> {
  const raw = await preferences.get(STORAGE_KEYS.mesoUnits)
  if (raw === null) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, MesoUnit] => UNITS.includes(entry[1] as string)),
    )
  } catch {
    return {}
  }
}

export async function setMesoUnits(units: Record<string, MesoUnit>): Promise<void> {
  await preferences.set(STORAGE_KEYS.mesoUnits, JSON.stringify(units))
}
