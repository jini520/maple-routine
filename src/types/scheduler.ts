export const BOSS_DIFFICULTIES = ['이지', '노멀', '하드', '카오스', '익스트림'] as const
export type BossDifficulty = (typeof BOSS_DIFFICULTIES)[number]

export const BOSS_CYCLES = ['weekly', 'monthly'] as const
export type BossCycle = (typeof BOSS_CYCLES)[number]

export interface DailyContent {
  name: string
  isRegistered: boolean
  nowCount: number
  maxCount: number
}

export interface WeeklyContent {
  name: string
  kind: 'contents' | 'quest'
  isRegistered: boolean
  nowCount: number
  maxCount: number
}

export interface BossContent {
  name: string
  difficulty: BossDifficulty
  cycle: BossCycle
  isRegistered: boolean
  isComplete: boolean
}

export interface SchedulerCharacterState {
  asOf: string // ISO 문자열, wire의 date 그대로 보존
  characterName: string
  world: string
  level: number
  jobClass: string
  dailyContents: DailyContent[]
  weeklyContents: WeeklyContent[]
  bossContents: BossContent[]
  weeklyBossClearCount: number
  weeklyBossClearLimitCount: number
}
