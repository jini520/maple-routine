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
