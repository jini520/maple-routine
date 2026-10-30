/**
 * 캐릭터의 헥사 매트릭스. 헥사 스킬 폼이 코어의 지금 레벨을 알 때 부른다.
 *
 * 부르는 계기는 지출 시트의 헥사 매트릭스 폼에서 캐릭터를 고를 때 하나다. 조작 하나에 1건이다.
 */
import type { NexonCredential } from '../../types/auth'
import type { NexonHexaCore, NexonHexaMatrixResponse } from '../../types'
import { requestJson } from '../http'

/** 코어 줄. 활성화하지 않은 코어는 줄이 없다. */
export async function fetchHexaMatrix(credential: NexonCredential, ocid: string): Promise<NexonHexaCore[]> {
  const response = await requestJson<NexonHexaMatrixResponse>(
    `/maplestory/v1/character/hexamatrix?ocid=${encodeURIComponent(ocid)}`,
    credential,
  )
  return response.character_hexa_core_equipment ?? []
}
