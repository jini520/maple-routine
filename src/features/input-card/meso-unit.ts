/**
 * 금액 칸마다 고른 단위. 칸을 열 때 동기로 읽어야 해서 메모리에 한 벌 들고, 부팅 때 저장소에서 채운다.
 */
import { getMesoUnits, setMesoUnits } from '../../storage/meso-unit'
import type { MesoUnit, MesoUnitKey } from '../../types/meso-unit'

let known: Record<string, MesoUnit> = {}

/** 저장된 단위를 읽어 온다. 부팅 때 한 번 부른다. */
export async function loadMesoUnits(): Promise<void> {
  known = { ...(await getMesoUnits()), ...known }
}

/** 그 칸이 열릴 단위. 고른 적이 없으면 `기본`. */
export function mesoUnitOf(key: MesoUnitKey): MesoUnit {
  return known[key] ?? 'base'
}

/** 고른 즉시 기억하고 저장한다. */
export function rememberMesoUnit(key: MesoUnitKey, unit: MesoUnit): void {
  known = { ...known, [key]: unit }
  void setMesoUnits(known)
}

export function __resetMesoUnitsForTest(): void {
  known = {}
}
