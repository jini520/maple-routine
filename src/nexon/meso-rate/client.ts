/**
 * 캐릭터의 **메소 획득량**을 읽는 다섯([[ADR-177]] 결정 2·9).
 *
 * `character/basic` 에는 메획이 **없다** — `foundation/nexon-api.md` 의 «새 판정에 캐릭터 속성이
 * 필요하면 추가 호출 전에 이 응답부터 확인» 규칙을 따라 확인했고, 그래서 다섯을 새로 부른다.
 *
 * **부르는 계기는 시트에서 캐릭터를 고를 때 하나**다(레벨을 갈아 끼우는 그 순간). 시트를 열
 * 때마다가 아니다. 다섯은 **병렬**이고, 사용자 조작 하나에 5건이라 초당 500건 예산에 닿지 않는다
 * ([[ADR-116]] 결정 1).
 */
import type {
  NexonAbilityResponse,
  NexonItemEquipmentResponse,
  NexonSymbolEquipmentResponse,
  NexonUnionArtifactResponse,
  NexonUnionRaiderResponse,
} from '../../types'
import { maxMesoRateOf } from '../../lib/meso-rate'
import { requestJson } from '../http'

const withOcid = (path: string, ocid: string): string => `${path}?ocid=${encodeURIComponent(ocid)}`

/**
 * 도달 가능한 **최대 메소 획득량**(%).
 *
 * **하나라도 실패하면 던진다** — 넷만 읽고 낸 값은 최대치가 아니라 «최대치보다 작은 어떤 수» 이고,
 * 화면이 그것을 자동값으로 세우면 사용자는 그것이 참인 줄 안다. 부르는 쪽이 실패를 받아
 * 손입력으로 내려간다([[ADR-177]] 결정 7).
 *
 * 미접속 캐릭터의 **축약 응답**은 실패가 아니다 — 필드가 없으면 그 축이 0 이고 합도 0 이 된다.
 */
export async function fetchMesoRate(apiKey: string, ocid: string): Promise<number> {
  const [itemEquipment, ability, symbol, unionRaider, unionArtifact] = await Promise.all([
    requestJson<NexonItemEquipmentResponse>(withOcid('/maplestory/v1/character/item-equipment', ocid), apiKey),
    requestJson<NexonAbilityResponse>(withOcid('/maplestory/v1/character/ability', ocid), apiKey),
    requestJson<NexonSymbolEquipmentResponse>(withOcid('/maplestory/v1/character/symbol-equipment', ocid), apiKey),
    requestJson<NexonUnionRaiderResponse>(withOcid('/maplestory/v1/user/union-raider', ocid), apiKey),
    requestJson<NexonUnionArtifactResponse>(withOcid('/maplestory/v1/user/union-artifact', ocid), apiKey),
  ])

  return maxMesoRateOf({ itemEquipment, ability, symbol, unionRaider, unionArtifact })
}
