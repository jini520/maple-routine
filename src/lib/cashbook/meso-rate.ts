/**
 * 캐릭터의 메소 획득량을 최대 세팅 기준으로 내는 파서.
 *
 * `character/stat` 의 환산값을 쓰면 안 된다. 이유가 둘이고 서로 별개다.
 *
 * ① 그 값은 현재 프리셋의 것이다. 사냥할 때는 메획 세팅으로 갈아입으므로 조회 순간이 보스
 *    세팅이면 딴 값이 나온다.
 * ② 일시 버프가 섞인다. 장비·어빌리티·심볼이 날짜별로 완전히 같은 캐릭터에서도 그 값만
 *    161 → 273 → 156 → 161 로 출렁였다.
 *
 * ②가 ①과 별개라, 프리셋을 다 훑는 이 파서를 환산값으로 교차검증하면 안 된다. 어긋나는 것이
 * 정상이다.
 *
 * ```
 * 장비   = max(현재·프리셋 셋)  ← 프리셋마다 min(잠재 + 에디셔널, 100)
 * 어빌   = max(현재·프리셋 셋)
 * 최대치 = 장비 + 어빌 + 유니온 공격대 + 심볼 + 유니온 아티팩트 + 챌린저스 + 직업 스킬
 * ```
 *
 * 축별 최댓값을 더한 것이 실제로 도달 가능한 세팅이다. 장비 프리셋과 어빌리티 프리셋이 서로
 * 독립적으로 전환되므로 조합을 다 셀 필요가 없다.
 */
import type {
  NexonAbilityResponse,
  NexonCharacterSkillResponse,
  NexonItemEquipmentItem,
  NexonItemEquipmentResponse,
  NexonSymbolEquipmentResponse,
  NexonUnionArtifactResponse,
  NexonUnionRaiderPreset,
  NexonUnionRaiderResponse,
} from '../../types'

/**
 * 장비(잠재 + 에디셔널) 합의 상한(%). 심볼은 이 캡 밖이다.
 *
 * 초과 사례를 본 적은 없다. 표본에서 장비 메획의 최댓값이 정확히 100 이었다. 그래서
 * 이 경로는 실데이터가 안 밟고 픽스처가 지킨다.
 */
export const EQUIP_MESO_CAP = 100

/**
 * 메소 획득량 한 줄에서 꺼낸 퍼센트. 없으면 0.
 *
 * **표기가 둘인데 정규식은 하나**다. 잠재·에디셔널은 `메소 획득량 +20%`(`+` 가 붙고 증가가
 * 없다)이고 어빌리티·유니온·아티팩트는 `메소 획득량 20% 증가` 다. 둘을 따로 파싱하면 한쪽 표기가
 * 바뀔 때 **조용히 0 이 된다**.
 *
 * 수치가 없는 `메소 획득량 증가`(아티팩트 크리스탈의 옵션명)는 0 이다. 그 값은 `effect` 에 접혀
 * 있고, 여기서 1 이나 NaN 을 내면 이중 계산이 된다.
 */
export function mesoPercentOf(text: string | null | undefined): number {
  const matched = /메소\s*획득량\s*\+?\s*(\d+(?:\.\d+)?)\s*%/.exec(text ?? '')
  return matched === null ? 0 : Number(matched[1])
}

/** 장비 하나가 든 메획. 잠재 셋 + 에디셔널 셋. **넷째 칸은 존재하지 않는다.** */
function mesoInItem(item: NexonItemEquipmentItem): number {
  return (
    mesoPercentOf(item.potential_option_1) +
    mesoPercentOf(item.potential_option_2) +
    mesoPercentOf(item.potential_option_3) +
    mesoPercentOf(item.additional_potential_option_1) +
    mesoPercentOf(item.additional_potential_option_2) +
    mesoPercentOf(item.additional_potential_option_3)
  )
}

const sum = (values: readonly number[]): number => values.reduce((total, each) => total + each, 0)

/**
 * 장비의 최대 메획. **프리셋마다 캡을 걸고** 그중 최댓값.
 *
 * 합산한 뒤 캡을 걸면 틀린다: 프리셋 둘이 각각 60 이면 답은 60 인데 `min(120, 100)` 은 100 이
 * 된다. 현재 적용본을 후보에 함께 넣는 이유는 그것이 프리셋 배열과 **갈릴 수 있기 때문**이고,
 * 같으면 최댓값이 안 바뀌므로 손해가 없다.
 */
function maxEquipMeso(response: NexonItemEquipmentResponse): number {
  const presets = [
    response.item_equipment,
    response.item_equipment_preset_1,
    response.item_equipment_preset_2,
    response.item_equipment_preset_3,
  ]
  return Math.max(
    0,
    ...presets.map((items) => Math.min(sum((items ?? []).map(mesoInItem)), EQUIP_MESO_CAP)),
  )
}

/** 어빌리티의 최대 메획. 프리셋 셋 + 현재 적용본 중 최댓값. 캡은 없다. */
function maxAbilityMeso(response: NexonAbilityResponse): number {
  const presets = [
    response.ability_info,
    response.ability_preset_1?.ability_info,
    response.ability_preset_2?.ability_info,
    response.ability_preset_3?.ability_info,
  ]
  return Math.max(0, ...presets.map((lines) => sum((lines ?? []).map((each) => mesoPercentOf(each.ability_value)))))
}

/** 심볼. `symbol_meso_rate`(`"13%"`)를 더한다. 문자열 파싱이 필요 없는 축은 이것뿐이다. */
function symbolMeso(response: NexonSymbolEquipmentResponse): number {
  return sum((response.symbol ?? []).map((each) => Number.parseFloat(each.symbol_meso_rate ?? '0') || 0))
}

const raiderMesoIn = (preset: NexonUnionRaiderPreset): number =>
  sum([...(preset.union_raider_stat ?? []), ...(preset.union_occupied_stat ?? [])].map(mesoPercentOf))

/**
 * 유니온. 공격대원/점령 효과 + 스테이트 효과.
 *
 * `union_raider_preset_1~5` 는 **전 계정이 `null`** 인 죽은 필드라 현재 적용본으로 폴백한다.
 * 있으면 최댓값, 없으면 현재값으로 짜 두는 이유는 되살아났을 때 **코드가 자동으로 잡게**
 * 하려는 것이다. 그때 이 파일을 다시 열 계기가 없다.
 */
function unionMeso(response: NexonUnionRaiderResponse): number {
  const presets = [
    response.union_raider_preset_1,
    response.union_raider_preset_2,
    response.union_raider_preset_3,
    response.union_raider_preset_4,
    response.union_raider_preset_5,
  ].filter((each): each is NexonUnionRaiderPreset => each !== null && each !== undefined)

  const raider = presets.length === 0 ? raiderMesoIn(response) : Math.max(...presets.map(raiderMesoIn))
  const state = Math.max(
    sum((response.union_state_stat ?? []).map(mesoPercentOf)),
    ...(response.union_state_stat_preset ?? []).map((each) => sum((each.union_state_stat ?? []).map(mesoPercentOf))),
  )
  return raider + state
}

/**
 * 유니온 아티팩트. **`effect` 만** 센다.
 *
 * `union_artifact_crystal` 의 메소 획득량 증가에는 수치가 없고, 그 크리스탈들의 레벨 합이
 * 이미 `effect` 에 접혀 있다(발록 lv5 + 자쿰 lv5 → `level: 10`). 같이 더하면 이중 계산이다.
 */
function artifactMeso(response: NexonUnionArtifactResponse): number {
  return sum((response.union_artifact_effect ?? []).map((each) => mesoPercentOf(each.name)))
}

/**
 * 챌린저스 월드 버프가 주는 메획(%).
 *
 * 장비 캡 밖이다(심볼과 같다). 세팅이 아니라 월드가 주는 값이라 100% 를 채운 장비 위에 그대로
 * 얹힌다.
 */
export const CHALLENGERS_MESO_PERCENT = 20

const CHALLENGERS_SKILL_NAME = '챌린저스'

/**
 * 버프를 **받는 티어 다섯**. 설명문에 이 다섯이 다 적혀 있어야 그 스킬이다.
 *
 * 이름만으로 가르면 틀린다. 아래 티어도 같은 이름의 스킬을 들 수 있고, 그때는 메획이 안 붙는다.
 * `skill_level` 은 늘 1 이고 `skill_effect` 는 빈 문자열이라 **가를 수 있는 칸이 설명문뿐**이다
 * (사용자 확인).
 */
const CHALLENGERS_TIERS = ['사파이어', '다이아몬드', '마스터', '챌린저', '슈퍼챌린저'] as const

/** 챌린저스 버프가 주는 메획(%). 못 찾으면 0. */
export function challengersMesoOf(response: NexonCharacterSkillResponse): number {
  const granted = (response.character_skill ?? []).some(
    (each) =>
      each.skill_name === CHALLENGERS_SKILL_NAME &&
      CHALLENGERS_TIERS.every((tier) => (each.skill_description ?? '').includes(tier)),
  )
  return granted ? CHALLENGERS_MESO_PERCENT : 0
}

/**
 * 직업이 스스로 갖는 메획(%). 지금은 섀도어의 그리드 하나다.
 *
 * 스킬 응답을 안 본다. 그 직업이면 늘 켜져 있는 값이라 조회가 언제나 같은 답을 준다. 직업이
 * 늘면 이 표에 한 줄을 더한다.
 */
export const JOB_MESO_PERCENTS: Readonly<Record<string, number>> = { 섀도어: 20 }

/**
 * `jobClass` 는 `character/list` 가 준 직업 이름이고 캐시에 실려 온다. **모르면 0** 이다.
 * 캐시가 아직 안 따뜻한 캐릭터가 있고, 그때 아무 값이나 얹으면 금액이 조용히 틀린다.
 */
export function jobMesoOf(jobClass: string | null | undefined): number {
  return JOB_MESO_PERCENTS[jobClass ?? ''] ?? 0
}

/**
 * 일곱을 한 번에 넘기는 조회. 하나라도 못 읽으면 최대치를 셀 수 없으므로 부분 성공을 안 만든다.
 *
 * `jobClass` 만 응답이 아니라 **캐시에서 온다**(`character/list` 가 준 값). 부르는 쪽이 채운다.
 */
export interface MesoRateSources {
  itemEquipment: NexonItemEquipmentResponse
  ability: NexonAbilityResponse
  symbol: NexonSymbolEquipmentResponse
  unionRaider: NexonUnionRaiderResponse
  unionArtifact: NexonUnionArtifactResponse
  /** 0차 스킬 목록. 여기서 보는 것은 챌린저스 하나다. */
  skill: NexonCharacterSkillResponse
  /** 직업 이름. 모르면 `null` 이고 그때 직업 스킬 몫은 0 이다. */
  jobClass: string | null
}

/** 도달 가능한 **최대 메소 획득량**(%). 축별 최댓값의 합이다. */
export function maxMesoRateOf(sources: MesoRateSources): number {
  return (
    maxEquipMeso(sources.itemEquipment) +
    maxAbilityMeso(sources.ability) +
    symbolMeso(sources.symbol) +
    unionMeso(sources.unionRaider) +
    artifactMeso(sources.unionArtifact) +
    challengersMesoOf(sources.skill) +
    jobMesoOf(sources.jobClass)
  )
}
