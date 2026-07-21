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

// bossDaily 항목(힐라 하드·핑크빈 카오스 등 일간으로 격하된 보스)은 이 앱이 다루지 않는 대상이라 걸러낸다 (ADR-007)
function normalizeBossContent(wire: NexonBossContentWire): BossContent | null {
  if (wire.cycle === 'bossDaily') {
    return null
  }

  return {
    name: wire.content_name,
    difficulty: DIFFICULTY_MAP[wire.difficulty],
    cycle: wire.cycle === 'bossWeekly' ? 'weekly' : 'monthly',
    isRegistered: wire.registration_flag === 'true',
    isComplete: wire.complete_flag === 'true',
  }
}

export function normalizeSchedulerCharacterState(
  wire: NexonSchedulerCharacterStateWire,
): SchedulerCharacterState {
  // ADR-030: 캐릭터가 해당 리셋 주기 이후 접속하지 않으면 이 필드들이 비거나(빈 배열) 아예
  // 없이(undefined) 온다. 두 경우를 동일하게 "이 섹션은 지금 신뢰할 수 없음"으로 취급한다.
  const dailyContentsWire = wire.daily_contents ?? []
  const weeklyContentsWire = wire.weekly_contents ?? []
  const bossContentsWire = wire.boss_contents ?? []

  return {
    asOf: wire.date,
    characterName: wire.character_name,
    world: wire.world_name,
    level: wire.character_level,
    jobClass: wire.character_class,
    dailyContents: dailyContentsWire.map(normalizeDailyContent),
    weeklyContents: weeklyContentsWire.map(normalizeWeeklyContent),
    bossContents: bossContentsWire
      .map(normalizeBossContent)
      .filter((content): content is BossContent => content !== null),
    weeklyBossClearCount: wire.weekly_boss_clear_count,
    weeklyBossClearLimitCount: wire.weekly_boss_clear_limit_count,
    isDailyStale: dailyContentsWire.length === 0,
    isWeeklyStale: weeklyContentsWire.length === 0,
    isWeeklyBossStale: !bossContentsWire.some((boss) => boss.cycle === 'bossWeekly'),
    isMonthlyBossStale: !bossContentsWire.some((boss) => boss.cycle === 'bossMonthly'),
  }
}
