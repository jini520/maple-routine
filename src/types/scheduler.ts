export const BOSS_DIFFICULTIES = ['이지', '노멀', '하드', '카오스', '익스트림'] as const
export type BossDifficulty = (typeof BOSS_DIFFICULTIES)[number]

export const BOSS_CYCLES = ['weekly', 'monthly'] as const
export type BossCycle = (typeof BOSS_CYCLES)[number]

export interface DailyContent {
  name: string
  kind: 'contents' | 'quest'
  isRegistered: boolean
  nowCount: number
  maxCount: number
  questState: 0 | 1 | 2 | null
}

export interface WeeklyContent {
  name: string
  kind: 'contents' | 'quest'
  isRegistered: boolean
  nowCount: number
  maxCount: number
  questState: 0 | 1 | 2 | null
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
  // ADR-030: 캐릭터가 해당 리셋 주기 이후 게임에 접속하지 않으면 이 섹션이 통째로 비거나
  // 없는 채로 응답이 온다. wire의 daily_contents/weekly_contents가 비었거나 없었는지,
  // boss_contents에 그 cycle 항목이 하나도 없었는지를 그대로 보존해 병합 단계(lib/scheduler-merge)가
  // "지금 이 섹션을 신뢰할 수 있는지"를 판단하는 데 쓴다.
  isDailyStale: boolean
  isWeeklyStale: boolean
  isWeeklyBossStale: boolean
  isMonthlyBossStale: boolean
}

// ADR-030: 월드/계정 단위로 완료가 공유되는 콘텐츠(예: 몬스터파크, 에픽 던전)의 진행 상태 원장 항목.
// 캐릭터 개별 응답의 registration_flag는 "마지막 활성 캐릭터" API 오염으로 신뢰할 수 없어(ADR-030),
// 한 번이라도 활성(등록) 확인된 적 있는지를 이 원장에 별도로 누적해 그 값을 기준으로 삼는다.
export interface SharedProgressEntry {
  active: boolean
  kind: 'contents' | 'quest'
  nowCount: number
  maxCount: number
  questState: 0 | 1 | 2 | null
  lastUpdatedBucket: string // 리셋 경계 판단용(주간은 lib/boss-profit-period의 periodKey, 일간은 lib/reset-clock의 getCurrentKstDateKey)
}
