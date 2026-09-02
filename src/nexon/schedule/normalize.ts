import type {
  BossContent,
  DailyContent,
  NexonBossContentWire,
  NexonDailyContentWire,
  NexonRawDifficulty,
  NexonSchedulerCharacterStateWire,
  NexonWeeklyContentWire,
  SchedulerCharacterState,
  WeeklyContent,
} from '../../types'

const DIFFICULTY_MAP: Record<NexonRawDifficulty, BossContent['difficulty']> = {
  easy: '이지',
  normal: '노멀',
  hard: '하드',
  chaos: '카오스',
  extreme: '익스트림',
}

function normalizeDailyContent(wire: NexonDailyContentWire): DailyContent {
  return {
    name: wire.content_name,
    kind: wire.type,
    isRegistered: wire.registration_flag === 'true',
    nowCount: wire.now_count,
    maxCount: wire.max_count,
    questState: wire.quest_state === null ? null : (Number(wire.quest_state) as 0 | 1 | 2),
  }
}

function normalizeWeeklyContent(wire: NexonWeeklyContentWire): WeeklyContent {
  return {
    name: wire.content_name,
    kind: wire.type,
    isRegistered: wire.registration_flag === 'true',
    nowCount: wire.now_count,
    maxCount: wire.max_count,
    questState: wire.quest_state === null ? null : (Number(wire.quest_state) as 0 | 1 | 2),
  }
}

// bossDaily 항목(힐라 하드·핑크빈 카오스 등 일간으로 격하된 보스)은 이 앱이 다루지 않는 대상이라 걸러낸다
//
// 등록한 난이도와 실제로 처치한 난이도가 다를 수 있어, 등록된 항목은 자기 자신의
// complete_flag가 false여도 같은 content_name의 다른 난이도가 complete_flag: true면 완료로
// 승격시킨다(isComplete, 카드 뱃지 표시용). 이 승격은 등록된 항목에만 적용하고, 미등록 항목끼리는
// 서로 전파하지 않는다. 미등록 완료 항목은 원본 complete_flag 그대로 lib/boss-matching의 카드
// 선택 로직에서 쓰인다. ownComplete는 승격 없이 이 항목 자신의 원본 complete_flag를 그대로
// 보존한다. 보스 수익 계산기가 "실제로 어느 난이도를 처치했는지" 판정할 때 isComplete만으론
// 승격된 건지 진짜 완료인지 구분할 수 없어서 별도로 필요하다.
function normalizeBossContent(wire: NexonBossContentWire, completedNames: Set<string>): BossContent | null {
  if (wire.cycle === 'bossDaily') {
    return null
  }

  const isRegistered = wire.registration_flag === 'true'
  const ownComplete = wire.complete_flag === 'true'

  return {
    name: wire.content_name,
    difficulty: DIFFICULTY_MAP[wire.difficulty],
    cycle: wire.cycle === 'bossWeekly' ? 'weekly' : 'monthly',
    isRegistered,
    isComplete: ownComplete || (isRegistered && completedNames.has(wire.content_name)),
    ownComplete,
  }
}

export function normalizeSchedulerCharacterState(
  wire: NexonSchedulerCharacterStateWire,
): SchedulerCharacterState {
  // 캐릭터가 해당 리셋 주기 이후 접속하지 않으면 이 필드들이 비거나(빈 배열) 아예
  // 없이(undefined) 온다. 두 경우를 동일하게 "이 섹션은 지금 신뢰할 수 없음"으로 취급한다.
  const dailyContentsWire = wire.daily_contents ?? []
  const weeklyContentsWire = wire.weekly_contents ?? []
  const bossContentsWire = wire.boss_contents ?? []
  // bossDaily는 이 앱이 다루지 않는 대상이라 완료 승격 판정에서도 제외해야 한다 —
  // 그렇지 않으면 같은 content_name이 bossDaily·bossWeekly에 함께 오는 보스(힐라 하드·핑크빈
  // 카오스 등)에서, 전혀 무관한 bossDaily 완료가 등록된 bossWeekly 항목을 잘못 완료로
  // 승격시킨다(사용자 재현 확인, 2026-07-22).
  const completedBossNames = new Set(
    bossContentsWire
      .filter((boss) => boss.cycle !== 'bossDaily' && boss.complete_flag === 'true')
      .map((boss) => boss.content_name),
  )

  const hasWeeklyBoss = bossContentsWire.some((boss) => boss.cycle === 'bossWeekly')

  return {
    asOf: wire.date,
    characterName: wire.character_name,
    world: wire.world_name,
    level: wire.character_level,
    jobClass: wire.character_class,
    dailyContents: dailyContentsWire.map(normalizeDailyContent),
    weeklyContents: weeklyContentsWire.map(normalizeWeeklyContent),
    bossContents: bossContentsWire
      .map((boss) => normalizeBossContent(boss, completedBossNames))
      .filter((content): content is BossContent => content !== null),
    isDailyStale: dailyContentsWire.length === 0,
    isWeeklyStale: weeklyContentsWire.length === 0,
    isWeeklyBossStale: !hasWeeklyBoss,
    // "그 cycle 항목이 있는가"만 보면 **축약 응답을 신선한 데이터로 신뢰**한다.
    // 실측(2026-07-31): 미접속 캐릭터의 당일 응답은 단계적으로 줄어들어 결국 bossMonthly 2건
    // (검은마법사 하드·익스트림, 둘 다 reg=false·comp=false)만 남는다. 그 응답을 신뢰하면 그 달에
    // 처치한 월간 보스의 완료가 "신선한 false"로 덮어써져 사라진다(재현: 6.65억 기록 보유
    // 상태에서 "이번 달 총 수익 0메소").
    //
    // 축약은 **weekly 보스부터** 사라지므로, bossWeekly가 하나도 없는 응답은 boss_contents 전체를
    // 신뢰할 수 없다고 본다. 남은 bossMonthly는 "이번 달 안 잡았다"는 사실이 아니라 결여의 잔재다.
    // (보스를 아예 할 수 없는 저레벨·특수 월드 캐릭터도 이 조건에 걸리지만, 그 경우 복원할 previous
    // 자체가 없어 결과가 같다. 잘못된 false를 덮어쓰지 않는 쪽이 안전하다.)
    isMonthlyBossStale: !bossContentsWire.some((boss) => boss.cycle === 'bossMonthly') || !hasWeeklyBoss,
  }
}
