/**
 * 캐릭터의 **메소 획득량**을 읽는 여섯([[ADR-177]] 결정 2·9 + 챌린저스, 2026-09-01).
 *
 * `character/basic` 에는 메획이 **없다** — `foundation/nexon-api.md` 의 «새 판정에 캐릭터 속성이
 * 필요하면 추가 호출 전에 이 응답부터 확인» 규칙을 따라 확인했고, 그래서 여섯을 새로 부른다.
 *
 * **부르는 계기는 시트에서 캐릭터를 고를 때 하나**다(레벨을 갈아 끼우는 그 순간). 시트를 열
 * 때마다가 아니다. 여섯은 **병렬**이고, 사용자 조작 하나에 6건이라 초당 500건 예산에 닿지 않는다
 * ([[ADR-116]] 결정 1).
 *
 * **직업은 안 부른다** — 섀도어의 「그리드」는 그 직업이면 늘 켜져 있는 값이라 스킬을 조회해도
 * 언제나 같은 답이 나온다(사용자 지정 2026-09-01). 직업 이름은 이미 캐시에 있으므로 부르는 쪽이
 * 넘긴다.
 */
import type {
  NexonAbilityResponse,
  NexonCharacterSkillResponse,
  NexonItemEquipmentResponse,
  NexonSymbolEquipmentResponse,
  NexonUnionArtifactResponse,
  NexonUnionRaiderResponse,
} from '../../types'
import { maxMesoRateOf } from '../../lib/cashbook/meso-rate'
import { requestJson } from '../http'

const withOcid = (path: string, ocid: string): string => `${path}?ocid=${encodeURIComponent(ocid)}`

/**
 * 챌린저스가 사는 차수 — **0차**다(사용자 확인 2026-09-01, [[ADR-006]]).
 *
 * `character/skill` 은 차수가 필수 파라미터라 «전부 훑기» 가 없다. 다른 차수를 함께 부르지 않는
 * 이유는 여기서 읽는 스킬이 챌린저스 하나뿐이기 때문이다.
 */
const CHALLENGERS_SKILL_GRADE = '0'

/**
 * 도달 가능한 **최대 메소 획득량**(%).
 *
 * **하나라도 실패하면 던진다** — 넷만 읽고 낸 값은 최대치가 아니라 «최대치보다 작은 어떤 수» 이고,
 * 화면이 그것을 자동값으로 세우면 사용자는 그것이 참인 줄 안다. 부르는 쪽이 실패를 받아
 * 손입력으로 내려간다([[ADR-177]] 결정 7).
 *
 * 미접속 캐릭터의 **축약 응답**은 실패가 아니다 — 필드가 없으면 그 축이 0 이고 합도 0 이 된다.
 *
 * `jobClass` 는 응답이 아니라 **캐시에서 온다**(`character/list` 가 준 직업 이름). 모르면 `null`
 * 이고 그때 직업 스킬 몫이 0 이다.
 */
export async function fetchMesoRate(
  apiKey: string,
  ocid: string,
  jobClass: string | null,
): Promise<number> {
  const [itemEquipment, ability, symbol, unionRaider, unionArtifact, skill] = await Promise.all([
    requestJson<NexonItemEquipmentResponse>(withOcid('/maplestory/v1/character/item-equipment', ocid), apiKey),
    requestJson<NexonAbilityResponse>(withOcid('/maplestory/v1/character/ability', ocid), apiKey),
    requestJson<NexonSymbolEquipmentResponse>(withOcid('/maplestory/v1/character/symbol-equipment', ocid), apiKey),
    requestJson<NexonUnionRaiderResponse>(withOcid('/maplestory/v1/user/union-raider', ocid), apiKey),
    requestJson<NexonUnionArtifactResponse>(withOcid('/maplestory/v1/user/union-artifact', ocid), apiKey),
    requestJson<NexonCharacterSkillResponse>(
      `${withOcid('/maplestory/v1/character/skill', ocid)}&character_skill_grade=${CHALLENGERS_SKILL_GRADE}`,
      apiKey,
    ),
  ])

  return maxMesoRateOf({ itemEquipment, ability, symbol, unionRaider, unionArtifact, skill, jobClass })
}
