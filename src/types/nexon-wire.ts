export interface NexonCharacterSummary {
  ocid: string
  characterName: string
  worldName: string
  characterClass: string
  characterLevel: number
}

export interface NexonAccountSummary {
  accountId: string
  characterList: NexonCharacterSummary[]
}

export interface NexonCharacterListResponse {
  accountList: NexonAccountSummary[]
}

export type NexonRawDifficulty = 'easy' | 'normal' | 'hard' | 'chaos' | 'extreme'
export type NexonRawBossCycle = 'bossDaily' | 'bossWeekly' | 'bossMonthly'

export interface NexonDailyContentWire {
  content_name: string
  type: string
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
  daily_contents: NexonDailyContentWire[]
  weekly_contents: NexonWeeklyContentWire[]
  boss_contents: NexonBossContentWire[]
  weekly_boss_clear_count: number
  weekly_boss_clear_limit_count: number
}
