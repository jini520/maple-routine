export interface NexonCharacterSummary {
  ocid: string
  character_name: string
  world_name: string
  character_class: string
  character_level: number
}

export interface NexonAccountSummary {
  account_id: string
  character_list: NexonCharacterSummary[]
}

export interface NexonCharacterListResponse {
  account_list: NexonAccountSummary[]
}

export interface NexonCharacterBasicResponse {
  character_name: string
  world_name?: string
  character_level: number
  character_image: string
  access_flag: 'true' | 'false'
  // 가입한 길드명(사용자 확인 2026-07-29, [[ADR-057]]). 미가입이면 null 또는 빈 문자열로 오고,
  // 응답 자체에 필드가 없을 수 있으므로 옵셔널이다 — 그 둘의 구분은 normalizeCharacterBasic이 한다.
  character_guild_name?: string | null
  // 누적 경험치 절대값(사용자 확인 2026-08-17, [[ADR-147]] 결정 7). 도메인으로는 나르지 않는다 —
  // 레벨이 오를수록 커지는 값이라 "얼마나 남았나"를 말하지 못한다.
  character_exp?: number
  // 현재 레벨 진행률(%). **number가 아니라 string이다** — `"80.300"` 처럼 소수 3자리 문자열로 온다
  // (access_flag와 같은 모양의 함정). 문자열째 비교하면 `"9.500" > "80.300"` 이 사전순으로 참이라
  // 진행률이 조용히 뒤집히므로 normalizeCharacterBasic이 반드시 Number로 푼다.
  // 축약 응답(미접속 캐릭터)에서 빠질 수 있어 옵셔널이다.
  character_exp_rate?: string
}

export type NexonRawDifficulty = 'easy' | 'normal' | 'hard' | 'chaos' | 'extreme'
export type NexonRawBossCycle = 'bossDaily' | 'bossWeekly' | 'bossMonthly'

export interface NexonDailyContentWire {
  content_name: string
  type: 'contents' | 'quest'
  registration_flag: 'true' | 'false'
  now_count: number
  max_count: number
  quest_state: string | null
}

export interface NexonWeeklyContentWire {
  content_name: string
  type: 'contents' | 'quest'
  registration_flag: 'true' | 'false'
  now_count: number
  max_count: number
  quest_state: string | null
}

export interface NexonBossContentWire {
  content_name: string
  difficulty: NexonRawDifficulty
  cycle: NexonRawBossCycle
  registration_flag: 'true' | 'false'
  complete_flag: 'true' | 'false'
}

export interface NexonSchedulerCharacterStateWire {
  date: string
  character_name: string
  world_name: string
  character_level: number
  character_class: string
  // ADR-030: 공식 문서 확인 — 캐릭터가 해당 기준일에 접속하지 않으면 응답 결과가 없을 수 있다.
  // 세 필드 모두 누락되거나(undefined) 빈 배열로 올 수 있어 옵셔널로 둔다.
  daily_contents?: NexonDailyContentWire[]
  weekly_contents?: NexonWeeklyContentWire[]
  boss_contents?: NexonBossContentWire[]
  weekly_boss_clear_count: number
  weekly_boss_clear_limit_count: number
}

// ── 메소 획득량을 읽는 다섯 ([[ADR-177]]) ─────────────────────────────────────────────
//
// **읽는 필드만 적는다.** 응답은 훨씬 넓지만(장비 하나에만 30여 칸) 여기 없는 칸은 파서가 안 보므로
// 적어 두면 «쓰는 것» 과 «오는 것» 이 뒤섞인다. 전부 옵셔널인 이유는 **미접속 캐릭터의 응답이
// 축약되기 때문**이다(이 문서의 「미접속 캐릭터의 응답 축약」 절) — 없는 칸을 필수로 두면 파싱이
// 아니라 타입이 먼저 거짓말을 한다.

/** 장비 하나. 잠재·에디셔널은 **각각 세 줄이 상한**이라 넷째 칸은 존재하지 않는다. */
export interface NexonItemEquipmentItem {
  potential_option_1?: string | null
  potential_option_2?: string | null
  potential_option_3?: string | null
  additional_potential_option_1?: string | null
  additional_potential_option_2?: string | null
  additional_potential_option_3?: string | null
}

/**
 * 장비 응답. **현재 적용본(`item_equipment`)과 프리셋 셋이 같이 온다** — 전부 훑으면 값이
 * 부풀려지므로 파서는 넷을 각각 세서 최댓값을 고른다([[ADR-177]] 결정 5 ③).
 */
export interface NexonItemEquipmentResponse {
  item_equipment?: NexonItemEquipmentItem[] | null
  item_equipment_preset_1?: NexonItemEquipmentItem[] | null
  item_equipment_preset_2?: NexonItemEquipmentItem[] | null
  item_equipment_preset_3?: NexonItemEquipmentItem[] | null
}

export interface NexonAbilityLine {
  ability_value?: string | null
}

export interface NexonAbilityPreset {
  ability_info?: NexonAbilityLine[] | null
}

export interface NexonAbilityResponse {
  ability_info?: NexonAbilityLine[] | null
  ability_preset_1?: NexonAbilityPreset | null
  ability_preset_2?: NexonAbilityPreset | null
  ability_preset_3?: NexonAbilityPreset | null
}

/**
 * 심볼 하나. **메획이 문자열이 아니라 전용 칸**(`"13%"`)으로 온다 — 다섯 중 유일하게 파싱이
 * 필요 없다. 값이 붙는 것은 그랜드 어센틱심볼뿐이고 나머지는 `"0%"` 라 전부 더해도 안전하다.
 */
export interface NexonSymbol {
  symbol_meso_rate?: string | null
}

export interface NexonSymbolEquipmentResponse {
  symbol?: NexonSymbol[] | null
}

export interface NexonUnionRaiderPreset {
  union_raider_stat?: string[] | null
  union_occupied_stat?: string[] | null
}

export interface NexonUnionStateStatPreset {
  union_state_stat?: string[] | null
}

/**
 * 유니온 공격대. **`union_raider_preset_1~5` 는 전 계정 `null` 인 죽은 필드**이고
 * (`union_block`·`union_occupied_stat` 도 빈 배열) 파서는 현재 적용본으로 폴백한다.
 * 타입에 남겨 두는 이유는 되살아났을 때 **코드가 자동으로 잡게** 하기 위함이다([[ADR-177]] 결정 5 ①).
 */
export interface NexonUnionRaiderResponse {
  union_raider_stat?: string[] | null
  union_occupied_stat?: string[] | null
  union_state_stat?: string[] | null
  union_state_stat_preset?: NexonUnionStateStatPreset[] | null
  union_raider_preset_1?: NexonUnionRaiderPreset | null
  union_raider_preset_2?: NexonUnionRaiderPreset | null
  union_raider_preset_3?: NexonUnionRaiderPreset | null
  union_raider_preset_4?: NexonUnionRaiderPreset | null
  union_raider_preset_5?: NexonUnionRaiderPreset | null
}

/** 아티팩트 크리스탈. **옵션명에 수치가 없고**(`"메소 획득량 증가"`) 값은 `effect` 에 접혀 있다. */
export interface NexonUnionArtifactCrystal {
  crystal_option_name_1?: string | null
  crystal_option_name_2?: string | null
  crystal_option_name_3?: string | null
}

export interface NexonUnionArtifactEffect {
  name?: string | null
}

/**
 * 유니온 아티팩트. **`effect` 만 읽는다** — `crystal` 을 같이 더하면 이중 계산이다
 * (발록 lv5 + 자쿰 lv5 가 이미 `{name: "메소 획득량 12% 증가", level: 10}` 으로 접혀 있다).
 * `crystal` 을 타입에 남긴 것은 **더하지 말라는 사실을 코드에서 보이게** 하기 위함이다.
 */
export interface NexonUnionArtifactResponse {
  union_artifact_effect?: NexonUnionArtifactEffect[] | null
  union_artifact_crystal?: NexonUnionArtifactCrystal[] | null
}

/**
 * 스킬 하나. **`skill_effect` 로는 못 가른다** — 챌린저스는 그 칸이 빈 문자열이고 레벨도 늘 1 이라
 * 설명문만이 티어를 말한다(사용자 확인 2026-09-01).
 */
export interface NexonCharacterSkill {
  skill_name?: string | null
  skill_description?: string | null
}

/**
 * 스킬 목록(`character/skill`). **차수를 지정해서 부른다** — 챌린저스는 0차에 있다
 * (사용자 확인 2026-09-01, [[ADR-006]]).
 *
 * 메획을 읽는 다섯과 달리 이 응답에서 보는 것은 **이름과 설명 두 칸**뿐이다.
 */
export interface NexonCharacterSkillResponse {
  character_skill?: NexonCharacterSkill[] | null
}
