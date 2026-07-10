import type {
  BossContent,
  DailyContent,
  MapleAccount,
  NexonBossContentWire,
  NexonCharacterListResponse,
  NexonDailyContentWire,
  NexonRawDifficulty,
  NexonSchedulerCharacterStateWire,
  NexonWeeklyContentWire,
  SchedulerCharacterState,
  WeeklyContent,
} from '../types'

const DIFFICULTY_MAP: Record<NexonRawDifficulty, BossContent['difficulty']> = {
  easy: '이지',
  normal: '노멀',
  hard: '하드',
  chaos: '카오스',
  extreme: '익스트림',
}

export function normalizeCharacterList(wire: NexonCharacterListResponse): MapleAccount[] {
  return wire.account_list.map((account) => ({
    accountId: account.account_id,
    characters: account.character_list.map((character) => ({
      ocid: character.ocid,
      name: character.character_name,
      world: character.world_name,
      jobClass: character.character_class,
      level: character.character_level,
    })),
  }))
}

function normalizeDailyContent(wire: NexonDailyContentWire): DailyContent {
  return {
    name: wire.content_name,
    isRegistered: wire.registration_flag === 'true',
    nowCount: wire.now_count,
    maxCount: wire.max_count,
  }
}

function normalizeWeeklyContent(wire: NexonWeeklyContentWire): WeeklyContent {
  return {
    name: wire.content_name,
    kind: wire.type,
    isRegistered: wire.registration_flag === 'true',
    nowCount: wire.now_count,
    maxCount: wire.max_count,
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
  return {
    asOf: wire.date,
    characterName: wire.character_name,
    world: wire.world_name,
    level: wire.character_level,
    jobClass: wire.character_class,
    dailyContents: wire.daily_contents.map(normalizeDailyContent),
    weeklyContents: wire.weekly_contents.map(normalizeWeeklyContent),
    bossContents: wire.boss_contents
      .map(normalizeBossContent)
      .filter((content): content is BossContent => content !== null),
    weeklyBossClearCount: wire.weekly_boss_clear_count,
    weeklyBossClearLimitCount: wire.weekly_boss_clear_limit_count,
  }
}
