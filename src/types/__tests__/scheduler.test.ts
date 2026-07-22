import { describe, expect, it } from 'vitest'
import { BOSS_CYCLES, BOSS_DIFFICULTIES } from '../scheduler'
import type {
  BossContent,
  DailyContent,
  SchedulerCharacterState,
  SharedProgressEntry,
  WeeklyContent,
} from '../scheduler'
import type { MapleAccount, MapleCharacter } from '../character'
import type { NexonAuthConfig } from '../auth'
import type {
  NexonAccountSummary,
  NexonBossContentWire,
  NexonCharacterListResponse,
  NexonCharacterSummary,
  NexonDailyContentWire,
  NexonSchedulerCharacterStateWire,
  NexonWeeklyContentWire,
} from '../nexon-wire'

describe('BOSS_DIFFICULTIES / BOSS_CYCLES 상수', () => {
  it('BOSS_DIFFICULTIES는 정확히 5개 한글 난이도 값을 순서대로 갖는다', () => {
    expect(BOSS_DIFFICULTIES).toEqual(['이지', '노멀', '하드', '카오스', '익스트림'])
  })

  it('BOSS_CYCLES는 정확히 weekly/monthly 2개만 갖는다 (bossDaily 대응 값 없음)', () => {
    expect(BOSS_CYCLES).toEqual(['weekly', 'monthly'])
  })
})

describe('domain 타입 샘플 객체', () => {
  it('DailyContent 샘플이 필드를 모두 채워 구성된다', () => {
    const sample: DailyContent = {
      name: '몬스터파크',
      kind: 'contents',
      isRegistered: true,
      nowCount: 7,
      maxCount: 14,
      questState: null,
    }
    expect(sample.name).toBe('몬스터파크')
  })

  it('WeeklyContent 샘플이 kind 유니온을 포함해 구성된다', () => {
    const sample: WeeklyContent = {
      name: '에픽 던전 : 악몽선경',
      kind: 'contents',
      isRegistered: true,
      nowCount: 5,
      maxCount: 0,
      questState: null,
    }
    expect(sample.kind).toBe('contents')
  })

  it('BossContent 샘플이 한글 난이도·weekly/monthly cycle로 구성된다', () => {
    const sample: BossContent = {
      name: '검은 마법사',
      difficulty: '익스트림',
      cycle: 'monthly',
      isRegistered: true,
      isComplete: true,
      ownComplete: true,
    }
    expect(BOSS_DIFFICULTIES).toContain(sample.difficulty)
    expect(BOSS_CYCLES).toContain(sample.cycle)
  })

  it('SchedulerCharacterState 샘플이 daily/weekly/boss 배열을 포함한다', () => {
    const sample: SchedulerCharacterState = {
      asOf: '2026-07-09T00:00+09:00',
      characterName: '낟낟',
      world: '엘리시움',
      level: 293,
      jobClass: '렌',
      dailyContents: [],
      weeklyContents: [],
      bossContents: [],
      isDailyStale: false,
      isWeeklyStale: false,
      isWeeklyBossStale: false,
      isMonthlyBossStale: false,
    }
    expect(sample.characterName).toBe('낟낟')
  })

  it('SharedProgressEntry 샘플이 월드/계정 공유 원장 항목 형태를 반영한다', () => {
    const sample: SharedProgressEntry = {
      active: true,
      kind: 'contents',
      nowCount: 7,
      maxCount: 14,
      questState: null,
      lastUpdatedBucket: '2026-07-21',
    }
    expect(sample.active).toBe(true)
  })

  it('MapleCharacter/MapleAccount 샘플이 구성된다', () => {
    const character: MapleCharacter = {
      ocid: '50119a0...',
      name: '내옆에최성일',
      world: '베라',
      jobClass: '아크메이지(썬,콜)',
      level: 211,
    }
    const account: MapleAccount = {
      accountId: 'da9b2f2...',
      characters: [character],
    }
    expect(account.characters).toHaveLength(1)
  })

  it('NexonAuthConfig 샘플이 미선택 상태(null)를 표현할 수 있다', () => {
    const config: NexonAuthConfig = {
      apiKey: 'test-key',
      selectedAccountId: null,
    }
    expect(config.selectedAccountId).toBeNull()
  })
})

describe('wire 타입 샘플 객체 (Nexon API 원본 응답 그대로)', () => {
  it('NexonCharacterListResponse 샘플이 snake_case account_list 구조를 반영한다', () => {
    const characterSummary: NexonCharacterSummary = {
      ocid: '50119a0...',
      character_name: '내옆에최성일',
      world_name: '베라',
      character_class: '아크메이지(썬,콜)',
      character_level: 211,
    }
    const accountSummary: NexonAccountSummary = {
      account_id: 'da9b2f2...',
      character_list: [characterSummary],
    }
    const response: NexonCharacterListResponse = {
      account_list: [accountSummary],
    }
    expect(response.account_list).toHaveLength(1)
  })

  it('NexonDailyContentWire 샘플이 registration_flag 문자열 리터럴을 갖는다', () => {
    const sample: NexonDailyContentWire = {
      content_name: '몬스터파크',
      type: 'contents',
      registration_flag: 'true',
      now_count: 7,
      max_count: 14,
      quest_state: null,
    }
    expect(sample.registration_flag).toBe('true')
  })

  it('NexonWeeklyContentWire 샘플이 quest_state 문자열 값을 가질 수 있다', () => {
    const sample: NexonWeeklyContentWire = {
      content_name: '[메이플 유니온] 주간 드래곤 퇴치',
      type: 'quest',
      registration_flag: 'false',
      now_count: 0,
      max_count: 0,
      quest_state: '0',
    }
    expect(sample.quest_state).toBe('0')
  })

  it('NexonBossContentWire 샘플이 영문 difficulty·bossMonthly cycle을 갖는다', () => {
    const sample: NexonBossContentWire = {
      content_name: '검은 마법사',
      difficulty: 'extreme',
      cycle: 'bossMonthly',
      registration_flag: 'true',
      complete_flag: 'true',
    }
    expect(sample.difficulty).toBe('extreme')
    expect(sample.cycle).toBe('bossMonthly')
  })

  it('NexonSchedulerCharacterStateWire 샘플이 전체 응답 구조를 반영한다', () => {
    const sample: NexonSchedulerCharacterStateWire = {
      date: '2026-07-09T00:00+09:00',
      character_name: '낟낟',
      world_name: '엘리시움',
      character_level: 293,
      character_class: '렌',
      daily_contents: [],
      weekly_contents: [],
      boss_contents: [],
      weekly_boss_clear_count: 0,
      weekly_boss_clear_limit_count: 0,
    }
    expect(sample.character_name).toBe('낟낟')
  })

  it('NexonSchedulerCharacterStateWire은 daily_contents/weekly_contents/boss_contents를 생략할 수 있다 (ADR-030: 미접속 시 응답에 없을 수 있음)', () => {
    const sample: NexonSchedulerCharacterStateWire = {
      date: '2026-07-21T00:00+09:00',
      character_name: '낟낟',
      world_name: '엘리시움',
      character_level: 293,
      character_class: '렌',
      weekly_boss_clear_count: 0,
      weekly_boss_clear_limit_count: 0,
    }
    expect(sample.daily_contents).toBeUndefined()
  })
})
