/**
 * 헥사 매트릭스 폼의 두 체크(보관 중인 조각 사용 · 지출 체크)의 마지막 상태. 새 기록의 폼이 이 상태로 열린다.
 *
 * 새 기록을 저장할 때만 적는다. 기억이 없거나 모양이 틀리면 둘 다 꺼진 상태다.
 */
import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

export interface HexaStorageChecks {
  useStorage: boolean
  storageAsSpend: boolean
}

export const DEFAULT_HEXA_STORAGE_CHECKS: HexaStorageChecks = { useStorage: false, storageAsSpend: false }

export async function getHexaStorageChecks(): Promise<HexaStorageChecks> {
  const raw = await preferences.get(STORAGE_KEYS.hexaStorageChecks)
  if (raw === null) return DEFAULT_HEXA_STORAGE_CHECKS
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null
    return { useStorage: value?.useStorage === true, storageAsSpend: value?.storageAsSpend === true }
  } catch {
    return DEFAULT_HEXA_STORAGE_CHECKS
  }
}

export async function setHexaStorageChecks(checks: HexaStorageChecks): Promise<void> {
  await preferences.set(STORAGE_KEYS.hexaStorageChecks, JSON.stringify(checks))
}
