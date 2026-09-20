/**
 * 캐릭터의 심볼 장비. 심볼 강화 드롭다운이 만렙인 심볼을 가를 때 부른다.
 *
 * 부르는 계기는 지출 시트의 심볼 강화 폼에서 캐릭터를 고를 때 하나다. 조작 하나에 1건이다.
 */
import type { NexonSymbol, NexonSymbolEquipmentResponse } from '../../types'
import { requestJson } from '../http'

/** 심볼 줄. 미접속 캐릭터의 축약 응답은 빈 배열이다. */
export async function fetchSymbolEquipment(apiKey: string, ocid: string): Promise<NexonSymbol[]> {
  const response = await requestJson<NexonSymbolEquipmentResponse>(
    `/maplestory/v1/character/symbol-equipment?ocid=${encodeURIComponent(ocid)}`,
    apiKey,
  )
  return response.symbol ?? []
}
