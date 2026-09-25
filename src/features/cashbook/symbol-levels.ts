/**
 * 심볼 강화 드롭다운이 쓰는 캐릭터의 심볼 레벨. 화면은 `nexon/` 도 `storage/` 도 직접 안 부른다.
 *
 * 모르면 `null` 이고 그때 드롭다운은 만렙 묶음 없이 선다. 던지지 않는다.
 */
import { symbolLevelsOf } from '../../lib/cashbook/symbol-costs'
import { fetchSymbolEquipment } from '../../nexon/symbol-levels'
import { getAuthConfig } from '../../storage/api-key'
import { credentialOf } from '../../lib/nexon-credential'

export async function loadSymbolLevels(ocid: string): Promise<Record<string, number> | null> {
  const credential = credentialOf(await getAuthConfig())
  // 키가 없으면 부르지도 않는다. 401 을 만들면 그 사슬이 저장된 키를 지운다.
  if (credential === null) return null
  try {
    return symbolLevelsOf(await fetchSymbolEquipment(credential, ocid))
  } catch {
    return null
  }
}
