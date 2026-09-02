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
  isComplete: boolean // 카드 완료 뱃지용 — 등록된 항목은 다른 난이도가 완료면 승격됨
  ownComplete: boolean // 이 난이도 자신의 원본 complete_flag(승격 없음) — 실제 처치 난이도 판정에 사용
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
  // 캐릭터가 해당 리셋 주기 이후 게임에 접속하지 않으면 이 섹션이 통째로 비거나
  // 없는 채로 응답이 온다. wire의 daily_contents/weekly_contents가 비었거나 없었는지,
  // boss_contents에 그 cycle 항목이 하나도 없었는지를 그대로 보존해 병합 단계(lib/scheduler/scheduler-merge)가
  // "지금 이 섹션을 신뢰할 수 있는지"를 판단하는 데 쓴다.
  isDailyStale: boolean
  isWeeklyStale: boolean
  isWeeklyBossStale: boolean
  isMonthlyBossStale: boolean
}

// 월드/계정 단위로 완료가 공유되는 콘텐츠(예: 몬스터파크, 에픽 던전)의 진행 상태 원장 항목.
// 캐릭터 개별 응답의 registration_flag는 "마지막 활성 캐릭터" API 오염으로 신뢰할 수 없어,
// 한 번이라도 활성(등록) 확인된 적 있는지를 이 원장에 별도로 누적해 그 값을 기준으로 삼는다.
export interface SharedProgressEntry {
  active: boolean
  kind: 'contents' | 'quest'
  nowCount: number
  maxCount: number
  questState: 0 | 1 | 2 | null
  lastUpdatedBucket: string // 리셋 경계 판단용(주간은 lib/boss/boss-profit-period 의 periodKey, 일간은 lib/scheduler/reset-clock 의 getCurrentKstDateKey)
}

// 멤버십(+사용자 입력 max_count)만 저장한다. nowCount/questState/isComplete 같은
// 동기화 유래 값은 절대 여기 두지 않고, 표시 시점에 schedulerCache에서 조회한다(단일 진실 공급원).
// 컨텐츠는 일간/주간 탭 표시 구분을 저장 시점에 확정하기 위해 kind를
// 'daily' | 'weekly'로 세분한다(표시 시점 추론 없음).
//
// 선언이 `storage/manual-tracked-content` 가 아니라 여기 있는 이유: 그 값을 병합하는 순수 함수
// (`lib/boss/manual-boss-merge`·`lib/scheduler/manual-content-merge`·`lib/boss/boss-matching`)가 core 로 오면서
// core → app 방향 참조가 생기기 때문이다. 저장 모듈은 이 타입을 그대로
// 재-export 하므로 기존 import 경로는 전부 그대로 쓴다.
export interface ManualTrackedItem {
  contentName: string
  kind: 'daily' | 'weekly' | 'boss'
  difficulty?: string // kind: 'boss'일 때만 사용(보스명만으로는 유일하지 않음)
  maxCount?: number // 컨텐츠이고 카운트형일 때만. 템플릿(scheduler-content-template.json)의 확정값을 복사해 저장
}
