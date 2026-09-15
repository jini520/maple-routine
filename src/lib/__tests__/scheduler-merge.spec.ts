import type { SchedulerCharacterState, SharedProgressEntry } from '../../types'
import { mergeSchedulerState } from '../scheduler/scheduler-merge'

function baseState(overrides: Partial<SchedulerCharacterState> = {}): SchedulerCharacterState {
  return {
    asOf: '2026-07-21T00:00+09:00',
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
    ...overrides,
  }
}

// 2026-07-21은 화요일. 가장 최근 주간 리셋은 2026-07-16(목), 오늘 날짜(KST)는 2026-07-21
const NOW = new Date('2026-07-21T10:00:00+09:00')

describe('mergeSchedulerState: character 범위', () => {
  it('fresh 섹션의 character 범위 항목은 그대로 통과한다', () => {
    const item = {
      contentKey: 'daily_quest_lacheln', apiName: '[일일 퀘스트] 레헬른의 평온한 밤',
      kind: 'quest' as const,
      isRegistered: true,
      nowCount: 0,
      maxCount: 0,
      questState: 1 as const,
    }
    const fresh = baseState({ dailyContents: [item] })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toEqual([item])
    expect(result.worldLedgerUpdates).toEqual({})
    expect(result.accountLedgerUpdates).toEqual({})
  })

  it('daily가 stale이면 이전 캐시의 character 항목 이름/등록은 유지하고 진행값만 리셋한다', () => {
    const previous = baseState({
      dailyContents: [
        {
          contentKey: 'daily_quest_lacheln', apiName: '[일일 퀘스트] 레헬른의 평온한 밤',
          kind: 'quest',
          isRegistered: true,
          nowCount: 0,
          maxCount: 0,
          questState: 2,
        },
      ],
    })
    const fresh = baseState({ dailyContents: [], isDailyStale: true })

    const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toEqual([
      {
        contentKey: 'daily_quest_lacheln', apiName: '[일일 퀘스트] 레헬른의 평온한 밤',
        kind: 'quest',
        isRegistered: true,
        nowCount: 0,
        maxCount: 0,
        questState: 0,
      },
    ])
  })

  it('contents kind 항목의 questState(null)는 리셋 후에도 null로 유지된다', () => {
    const previous = baseState({
      weeklyContents: [
        { contentKey: 'mu_lung_dojo', apiName: '무릉도장', kind: 'contents', isRegistered: true, nowCount: 5, maxCount: 0, questState: null },
      ],
    })
    const fresh = baseState({ weeklyContents: [], isWeeklyStale: true })

    const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.weeklyContents).toEqual([
      { contentKey: 'mu_lung_dojo', apiName: '무릉도장', kind: 'contents', isRegistered: true, nowCount: 0, maxCount: 0, questState: null },
    ])
  })

  it('previous가 null이고 stale이어도 크래시 없이 빈 배열을 반환한다 (캐릭터 첫 동기화)', () => {
    const fresh = baseState({ dailyContents: [], isDailyStale: true })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toEqual([])
  })

  describe(' 정정. stale이 아니어도 항목 단위로 previous의 누락 항목을 복원한다', () => {
    it('daily가 stale이 아니고(빈 배열 아님) 일부 항목만 왔어도, previous에만 있던 항목은 진행값이 리셋된 채 복원된다', () => {
      const previous = baseState({
        dailyContents: [
          { contentKey: 'daily_quest_road_of_vanishing', apiName: '[일일 퀘스트] 소멸의 여로 조사', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 1 },
          { contentKey: 'daily_quest_lacheln', apiName: '[일일 퀘스트] 레헬른의 평온한 밤', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 2 },
        ],
      })
      const fresh = baseState({
        dailyContents: [
          { contentKey: 'daily_quest_road_of_vanishing', apiName: '[일일 퀘스트] 소멸의 여로 조사', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 0 },
        ],
        isDailyStale: false,
      })

      const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

      expect(result.characterState.dailyContents).toEqual([
        { contentKey: 'daily_quest_road_of_vanishing', apiName: '[일일 퀘스트] 소멸의 여로 조사', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 0 },
        {
          contentKey: 'daily_quest_lacheln', apiName: '[일일 퀘스트] 레헬른의 평온한 밤',
          kind: 'quest',
          isRegistered: true,
          nowCount: 0,
          maxCount: 0,
          questState: 0,
        },
      ])
    })

    it('fresh에 이미 있는 항목은 previous로 덮어쓰지 않는다(fresh가 우선)', () => {
      const previous = baseState({
        dailyContents: [
          { contentKey: 'daily_quest_road_of_vanishing', apiName: '[일일 퀘스트] 소멸의 여로 조사', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 2 },
        ],
      })
      const fresh = baseState({
        dailyContents: [
          { contentKey: 'daily_quest_road_of_vanishing', apiName: '[일일 퀘스트] 소멸의 여로 조사', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 1 },
        ],
        isDailyStale: false,
      })

      const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

      expect(result.characterState.dailyContents).toEqual([
        { contentKey: 'daily_quest_road_of_vanishing', apiName: '[일일 퀘스트] 소멸의 여로 조사', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 1 },
      ])
    })
  })
})

describe('mergeSchedulerState: world 범위 (몬스터파크)', () => {
  it('처음 fresh로 registration_flag: true가 오면 원장이 active: true로 갱신되고 결과에 노출된다', () => {
    const fresh = baseState({
      dailyContents: [
        { contentKey: 'monster_park', apiName: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null },
      ],
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.worldLedgerUpdates).toEqual({
      monster_park: { active: true, kind: 'contents', nowCount: 7, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-21' },
    })
    expect(result.characterState.dailyContents).toEqual([
      { contentKey: 'monster_park', apiName: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null },
    ])
  })

  it('registration_flag: false이고 아직 active가 아니어도 now_count는 실효 상태에 담기되 isRegistered: false로 표시된다', () => {
    const fresh = baseState({
      dailyContents: [
        { contentKey: 'monster_park', apiName: '몬스터파크', kind: 'contents', isRegistered: false, nowCount: 7, maxCount: 14, questState: null },
      ],
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    // auto 모드는 isRegistered로 노출을 거르므로 여전히 숨겨지지만(설계 유지), 수동 모드가 참조할 수
    // 있게 값(now_count) 자체는 버리지 않고 실효 상태에 담는다.
    expect(result.characterState.dailyContents).toEqual([
      { contentKey: 'monster_park', apiName: '몬스터파크', kind: 'contents', isRegistered: false, nowCount: 7, maxCount: 14, questState: null },
    ])
    expect(result.worldLedgerUpdates.monster_park.active).toBe(false)
    expect(result.worldLedgerUpdates.monster_park.nowCount).toBe(7)
  })

  it('이미 active인 항목이 이번 응답에 registration_flag: false로 와도 여전히 노출되고 값은 갱신된다', () => {
    const worldLedger: Record<string, SharedProgressEntry> = {
      monster_park: { active: true, kind: 'contents', nowCount: 5, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-21' },
    }
    const fresh = baseState({
      dailyContents: [
        { contentKey: 'monster_park', apiName: '몬스터파크', kind: 'contents', isRegistered: false, nowCount: 7, maxCount: 14, questState: null },
      ],
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toEqual([
      { contentKey: 'monster_park', apiName: '몬스터파크', kind: 'contents', isRegistered: true, nowCount: 7, maxCount: 14, questState: null },
    ])
    expect(result.worldLedgerUpdates.monster_park.active).toBe(true)
  })

  it('이미 active인 항목이 이번 응답에 아예 없어도(누락) 원장 값으로 계속 노출되고 원장은 갱신하지 않는다', () => {
    const worldLedger: Record<string, SharedProgressEntry> = {
      monster_park: { active: true, kind: 'contents', nowCount: 5, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-21' },
    }
    // 이 캐릭터 자신의 daily 섹션은 정상(다른 항목은 있음)이지만 몬스터파크만 빠진 상황
    const fresh = baseState({
      dailyContents: [
        { contentKey: 'daily_quest_lacheln', apiName: '[일일 퀘스트] 레헬른의 평온한 밤', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 1 },
      ],
      isDailyStale: false,
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toContainEqual({
      contentKey: 'monster_park', apiName: '몬스터파크',
      kind: 'contents',
      isRegistered: true,
      nowCount: 5,
      maxCount: 14,
      questState: null,
    })
    expect(result.worldLedgerUpdates).toEqual({})
  })

  it('원장이 리셋 경계(오늘 날짜)를 넘겼는데 아무도 안 갱신했으면 진행값만 리셋되고 active는 유지된다', () => {
    const worldLedger: Record<string, SharedProgressEntry> = {
      monster_park: { active: true, kind: 'contents', nowCount: 12, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-20' },
    }
    const fresh = baseState({
      dailyContents: [
        { contentKey: 'daily_quest_lacheln', apiName: '[일일 퀘스트] 레헬른의 평온한 밤', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 1 },
      ],
      isDailyStale: false,
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toContainEqual({
      contentKey: 'monster_park', apiName: '몬스터파크',
      kind: 'contents',
      isRegistered: true,
      nowCount: 0,
      maxCount: 14,
      questState: null,
    })
  })
})

describe('mergeSchedulerState: account 범위 (에픽 던전)', () => {
  it('처음 fresh로 registration_flag: true가 오면 accountLedgerUpdates가 갱신된다', () => {
    const fresh = baseState({
      weeklyContents: [
        { contentKey: 'epic_dungeon_nightmare_paradise', apiName: '에픽 던전 : 악몽선경', kind: 'contents', isRegistered: true, nowCount: 1, maxCount: 0, questState: null },
      ],
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.accountLedgerUpdates).toEqual({
      epic_dungeon_nightmare_paradise: { active: true, kind: 'contents', nowCount: 1, maxCount: 0, questState: null, lastUpdatedBucket: '2026-07-16' },
    })
    expect(result.worldLedgerUpdates).toEqual({})
  })
})

// 공유 항목의 등록은 원장의 active 가 한 번 참이면 계속 참이다. 유니온 두 항목만 그 규칙에서 빠져
// 이번 응답의 registration_flag 를 그대로 쓴다. 아무도 등록 안 한 줄이 굳은 원장 한 칸 때문에 섰다.
describe('mergeSchedulerState: 유니온 두 항목은 응답의 등록 값을 그대로 쓴다', () => {
  const UNION_PC = 'maple_union_pc_cafe_weekly_dragon'
  const UNION_WEEKLY = 'maple_union_weekly_dragon'
  const EPIC = 'epic_dungeon_high_mountain'
  const WEEK = '2026-07-16'
  const API_NAMES: Record<string, string> = {
    [UNION_PC]: '[메이플 유니온] PC방 주간 드래곤 퇴치',
    [UNION_WEEKLY]: '[메이플 유니온] 주간 드래곤 퇴치',
  }
  const questItem = (contentKey: string, isRegistered: boolean) => ({
    contentKey,
    apiName: API_NAMES[contentKey],
    kind: 'quest' as const,
    isRegistered,
    nowCount: 0,
    maxCount: 0,
    questState: 0 as const,
  })
  const ledgerEntry = (active: boolean): SharedProgressEntry => ({
    active,
    kind: 'quest',
    nowCount: 0,
    maxCount: 0,
    questState: 0,
    lastUpdatedBucket: WEEK,
  })

  it('원장이 active: true 여도 응답이 false 면 등록 안 한 것이고, 원장도 false 로 쓴다', () => {
    const fresh = baseState({ weeklyContents: [questItem(UNION_PC, false)] })

    const result = mergeSchedulerState({
      previous: null,
      fresh,
      worldLedger: {},
      accountLedger: { [UNION_PC]: ledgerEntry(true) },
      now: NOW,
    })

    expect(result.characterState.weeklyContents).toEqual([questItem(UNION_PC, false)])
    expect(result.accountLedgerUpdates[UNION_PC].active).toBe(false)
  })

  it('월드 공유인 주간 드래곤 퇴치도 같다', () => {
    const fresh = baseState({ weeklyContents: [questItem(UNION_WEEKLY, false)] })

    const result = mergeSchedulerState({
      previous: null,
      fresh,
      worldLedger: { [UNION_WEEKLY]: ledgerEntry(true) },
      accountLedger: {},
      now: NOW,
    })

    expect(result.characterState.weeklyContents).toEqual([questItem(UNION_WEEKLY, false)])
    expect(result.worldLedgerUpdates[UNION_WEEKLY].active).toBe(false)
  })

  it('원장이 없고 응답이 true 면 등록한 것이다', () => {
    const fresh = baseState({ weeklyContents: [questItem(UNION_PC, true)] })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.weeklyContents).toEqual([questItem(UNION_PC, true)])
    expect(result.accountLedgerUpdates[UNION_PC].active).toBe(true)
  })

  it('에픽 던전은 지금처럼 원장이 active: true 면 응답이 false 여도 계속 노출된다', () => {
    const fresh = baseState({
      weeklyContents: [
        { contentKey: EPIC, apiName: '에픽 던전 : 하이마운틴', kind: 'contents', isRegistered: false, nowCount: 1, maxCount: 0, questState: null },
      ],
    })

    const result = mergeSchedulerState({
      previous: null,
      fresh,
      worldLedger: {},
      accountLedger: { [EPIC]: { ...ledgerEntry(true), kind: 'contents', questState: null } },
      now: NOW,
    })

    expect(result.characterState.weeklyContents[0]?.isRegistered).toBe(true)
    expect(result.accountLedgerUpdates[EPIC].active).toBe(true)
  })

  it('섹션이 빈 캐릭터(미접속)는 원장의 마지막 값으로 복원된다', () => {
    const stale = baseState({ weeklyContents: [], isWeeklyStale: true })

    const registered = mergeSchedulerState({
      previous: null,
      fresh: stale,
      worldLedger: {},
      accountLedger: { [UNION_PC]: ledgerEntry(true) },
      now: NOW,
    })
    const unregistered = mergeSchedulerState({
      previous: null,
      fresh: stale,
      worldLedger: {},
      accountLedger: { [UNION_PC]: ledgerEntry(false) },
      now: NOW,
    })

    const find = (items: { contentKey: string | null; isRegistered: boolean }[]) =>
      items.find((item) => item.contentKey === UNION_PC)
    expect(find(registered.characterState.weeklyContents)?.isRegistered).toBe(true)
    expect(find(unregistered.characterState.weeklyContents)?.isRegistered ?? false).toBe(false)
  })
})

// 원장 복원은 원장에 있는 칸 전부를 채운다. 등록 여부는 원장의 active 그대로다. active 가 거짓인 칸을
// 건너뛰면, 과거 날짜로 다시 병합할 때 아무도 등록하지 않은 에픽 던전이 목록에서 빠져 주 3회 한도가
// 그 완료를 못 센다.
describe('mergeSchedulerState: 원장 복원은 active 와 무관하게 칸을 채운다', () => {
  const EPIC = 'epic_dungeon_high_mountain'
  const WEEK = '2026-07-16'
  const inactive: SharedProgressEntry = {
    active: false,
    kind: 'contents',
    nowCount: 1,
    maxCount: 0,
    questState: null,
    lastUpdatedBucket: WEEK,
  }

  it('active: false 인 칸은 isRegistered: false 와 원장 진행값으로 채운다', () => {
    const fresh = baseState({ weeklyContents: [], isWeeklyStale: true })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: { [EPIC]: inactive }, now: NOW })

    expect(result.characterState.weeklyContents).toContainEqual({
      contentKey: EPIC,
      apiName: '에픽 던전 : 하이마운틴',
      kind: 'contents',
      isRegistered: false,
      nowCount: 1,
      maxCount: 0,
      questState: null,
    })
  })

  it('원장에 칸이 없으면 채우지 않는다', () => {
    const fresh = baseState({ weeklyContents: [], isWeeklyStale: true })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.weeklyContents.map((item) => item.contentKey)).not.toContain(EPIC)
  })

  // `fillMissingSections` 가 하는 일을 그대로 한 번 더 태운다. 네 섹션을 낡은 것으로 두고 과거 날짜
  // 응답을 previous 로 삼는다.
  it('과거 날짜로 다시 병합해도 등록 안 한 에픽 던전과 그 진행이 남는다', () => {
    const stage1 = mergeSchedulerState({
      previous: null,
      fresh: baseState({
        isDailyStale: true,
        weeklyContents: [
          { contentKey: EPIC, apiName: '에픽 던전 : 하이마운틴', kind: 'contents', isRegistered: false, nowCount: 1, maxCount: 0, questState: null },
          { contentKey: 'erda_spectrum', apiName: '에르다 스펙트럼', kind: 'contents', isRegistered: true, nowCount: 1, maxCount: 3, questState: null },
        ],
      }),
      worldLedger: {},
      accountLedger: {},
      now: NOW,
    })

    const folded = mergeSchedulerState({
      previous: baseState(),
      fresh: {
        ...stage1.characterState,
        isDailyStale: true,
        isWeeklyStale: true,
        isWeeklyBossStale: true,
        isMonthlyBossStale: true,
      },
      worldLedger: {},
      accountLedger: stage1.accountLedgerUpdates,
      now: NOW,
    })

    expect(folded.characterState.weeklyContents.find((item) => item.contentKey === EPIC)).toMatchObject({
      isRegistered: false,
      nowCount: 1,
    })
  })
})

// 병합은 컨텐츠 key 로 항목을 가리고 원장도 key 로 쓴다. 공유 범위를 묻는 key 와 원장 열쇠가 같아야 한다.
describe('mergeSchedulerState: 컨텐츠 key', () => {
  const monsterPark = (apiName: string, nowCount: number) => ({
    contentKey: 'monster_park',
    apiName,
    kind: 'contents' as const,
    isRegistered: true,
    nowCount,
    maxCount: 14,
    questState: null,
  })

  it('공유 원장은 API 이름이 아니라 컨텐츠 key 로 쓴다', () => {
    const fresh = baseState({ dailyContents: [monsterPark('몬스터파크', 7)] })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(Object.keys(result.worldLedgerUpdates)).toEqual(['monster_park'])
  })

  // 옛 병합은 공유 범위를 공백을 지운 이름으로 묻고 원장은 받은 이름 그대로 썼다. 공백이 다른 이름이 오면
  // 원장에 칸이 둘 생기고, 원장 복원이 같은 컨텐츠를 한 줄 더 세웠다.
  it('API 이름의 공백이 달라도 공유 범위를 묻는 key 와 원장 열쇠가 같아 한 칸 · 한 줄이다', () => {
    const worldLedger: Record<string, SharedProgressEntry> = {
      monster_park: { active: true, kind: 'contents', nowCount: 3, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-21' },
    }
    const fresh = baseState({ dailyContents: [monsterPark('몬스터 파크', 7)] })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger, accountLedger: {}, now: NOW })

    expect(result.worldLedgerUpdates).toEqual({
      monster_park: { active: true, kind: 'contents', nowCount: 7, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-21' },
    })
    expect(result.characterState.dailyContents).toEqual([monsterPark('몬스터 파크', 7)])
  })

  it('원장에서 되살린 줄의 API 이름은 컨텐츠 표의 content_name 이다', () => {
    const worldLedger: Record<string, SharedProgressEntry> = {
      monster_park: { active: true, kind: 'contents', nowCount: 5, maxCount: 14, questState: null, lastUpdatedBucket: '2026-07-21' },
    }
    const fresh = baseState({ dailyContents: [], isDailyStale: true })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger, accountLedger: {}, now: NOW })

    expect(result.characterState.dailyContents).toEqual([monsterPark('몬스터파크', 5)])
  })

  // 컨텐츠 표에 없는 컨텐츠는 공유라고 확인된 적 없다. 원장에 쓰면 key 가 없어 되살릴 수도 없다.
  describe('컨텐츠 key 가 없는 항목(표에 없는 컨텐츠)', () => {
    const unknown = (questState: 0 | 1 | 2) => ({
      contentKey: null,
      apiName: '[일일 퀘스트] 새 지역 조사',
      kind: 'quest' as const,
      isRegistered: true,
      nowCount: 0,
      maxCount: 0,
      questState,
    })

    it('캐릭터 범위로 그대로 통과하고 원장에 쓰지 않는다', () => {
      const fresh = baseState({ dailyContents: [unknown(1)] })

      const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

      expect(result.characterState.dailyContents).toEqual([unknown(1)])
      expect(result.worldLedgerUpdates).toEqual({})
      expect(result.accountLedgerUpdates).toEqual({})
    })

    // 공유 컨텐츠와 API 이름이 같아도 key 를 못 얻었으면 공유로 다루지 않는다. 범위는 key 만 말한다.
    it('API 이름이 공유 컨텐츠와 같아도 key 가 없으면 원장에 쓰지 않는다', () => {
      const item = { ...monsterPark('몬스터파크', 7), contentKey: null }
      const fresh = baseState({ dailyContents: [item] })

      const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

      expect(result.characterState.dailyContents).toEqual([item])
      expect(result.worldLedgerUpdates).toEqual({})
    })

    it('fresh 에서 빠지면 API 이름으로 previous 의 줄을 찾아 진행값만 리셋해 복원한다', () => {
      const previous = baseState({ dailyContents: [unknown(2)] })
      const fresh = baseState({ dailyContents: [], isDailyStale: true })

      const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

      expect(result.characterState.dailyContents).toEqual([unknown(0)])
    })

    it('key 가 있는 항목과 API 이름이 같아도 다른 항목이다. 서로를 가리지 않는다', () => {
      const keyed = { ...unknown(1), contentKey: 'daily_quest_lacheln', apiName: '[일일 퀘스트] 레헬른의 평온한 밤' }
      const unkeyed = { ...unknown(2), apiName: '[일일 퀘스트] 레헬른의 평온한 밤' }
      const previous = baseState({ dailyContents: [unkeyed] })
      const fresh = baseState({ dailyContents: [keyed] })

      const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

      expect(result.characterState.dailyContents).toEqual([keyed, { ...unkeyed, questState: 0 }])
    })
  })
})

describe('mergeSchedulerState: maxCountOverride', () => {
  it('오버라이드가 등록된 항목은 API 응답의 max_count 대신 오버라이드 값을 쓴다', () => {
    const fresh = baseState({
      weeklyContents: [
        { contentKey: 'guild_weekly_mission_points', apiName: '[길드] 주간 미션 포인트', kind: 'contents', isRegistered: true, nowCount: 3, maxCount: 0, questState: null },
      ],
    })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.weeklyContents[0].maxCount).toBe(10)
  })

  it('stale 폴백 경로에서도 오버라이드가 적용된다', () => {
    const previous = baseState({
      weeklyContents: [
        { contentKey: 'guild_weekly_mission_points', apiName: '[길드] 주간 미션 포인트', kind: 'contents', isRegistered: true, nowCount: 3, maxCount: 0, questState: null },
      ],
    })
    const fresh = baseState({ weeklyContents: [], isWeeklyStale: true })

    const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.weeklyContents[0].maxCount).toBe(10)
  })
})

describe('mergeSchedulerState: 보스 (cycle별 독립 stale)', () => {
  it('주간 보스만 stale이면 주간 보스만 리셋되고 월간 보스는 그대로 유지된다', () => {
    const previous = baseState({
      bossContents: [
        { bossKey: 'lotus', apiName: '스우', difficulty: 'hard', cycle: 'weekly', isRegistered: true, isComplete: true, ownComplete: true },
        {
          bossKey: 'black_mage', apiName: '검은 마법사',
          difficulty: 'extreme',
          cycle: 'monthly',
          isRegistered: true,
          isComplete: true,
          ownComplete: true,
        },
      ],
    })
    const fresh = baseState({
      bossContents: [
        {
          bossKey: 'black_mage', apiName: '검은 마법사',
          difficulty: 'extreme',
          cycle: 'monthly',
          isRegistered: true,
          isComplete: true,
          ownComplete: true,
        },
      ],
      isWeeklyBossStale: true,
      isMonthlyBossStale: false,
    })

    const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.bossContents).toEqual([
      { bossKey: 'lotus', apiName: '스우', difficulty: 'hard', cycle: 'weekly', isRegistered: true, isComplete: false, ownComplete: false },
      {
        bossKey: 'black_mage', apiName: '검은 마법사',
        difficulty: 'extreme',
        cycle: 'monthly',
        isRegistered: true,
        isComplete: true,
        ownComplete: true,
      },
    ])
  })

  it('stale로 리셋될 때 ownComplete도 isComplete와 함께 false로 리셋된다. 안 그러면 지난 리셋의 완료 여부가 새 주에 그대로 남는다', () => {
    const previous = baseState({
      bossContents: [
        { bossKey: 'lotus', apiName: '스우', difficulty: 'hard', cycle: 'weekly', isRegistered: true, isComplete: true, ownComplete: true },
      ],
    })
    const fresh = baseState({ bossContents: [], isWeeklyBossStale: true, isMonthlyBossStale: true })

    const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.bossContents[0].isComplete).toBe(false)
    expect(result.characterState.bossContents[0].ownComplete).toBe(false)
  })

  it(' 정정. 주간 보스가 stale이 아니어도(일부 항목만 왔어도) previous에만 있던 난이도는 항목 단위로 복원된다', () => {
    const previous = baseState({
      bossContents: [
        { bossKey: 'lotus', apiName: '스우', difficulty: 'hard', cycle: 'weekly', isRegistered: true, isComplete: true, ownComplete: true },
        { bossKey: 'lucid', apiName: '루시드', difficulty: 'hard', cycle: 'weekly', isRegistered: true, isComplete: true, ownComplete: true },
      ],
    })
    const fresh = baseState({
      bossContents: [{ bossKey: 'lotus', apiName: '스우', difficulty: 'hard', cycle: 'weekly', isRegistered: true, isComplete: false, ownComplete: false }],
      isWeeklyBossStale: false,
    })

    const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.bossContents).toEqual([
      { bossKey: 'lotus', apiName: '스우', difficulty: 'hard', cycle: 'weekly', isRegistered: true, isComplete: false, ownComplete: false },
      { bossKey: 'lucid', apiName: '루시드', difficulty: 'hard', cycle: 'weekly', isRegistered: true, isComplete: false, ownComplete: false },
    ])
  })

  it(' 정정. 같은 보스라도 난이도가 다르면 별개 항목으로 취급해 fresh에 없는 난이도만 복원한다', () => {
    const previous = baseState({
      bossContents: [
        { bossKey: 'kaling', apiName: '카링', difficulty: 'easy', cycle: 'weekly', isRegistered: true, isComplete: true, ownComplete: true },
        { bossKey: 'kaling', apiName: '카링', difficulty: 'hard', cycle: 'weekly', isRegistered: false, isComplete: false, ownComplete: false },
      ],
    })
    const fresh = baseState({
      bossContents: [{ bossKey: 'kaling', apiName: '카링', difficulty: 'easy', cycle: 'weekly', isRegistered: true, isComplete: true, ownComplete: true }],
      isWeeklyBossStale: false,
    })

    const result = mergeSchedulerState({ previous, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.bossContents).toEqual([
      { bossKey: 'kaling', apiName: '카링', difficulty: 'easy', cycle: 'weekly', isRegistered: true, isComplete: true, ownComplete: true },
      { bossKey: 'kaling', apiName: '카링', difficulty: 'hard', cycle: 'weekly', isRegistered: false, isComplete: false, ownComplete: false },
    ])
  })
})

describe('mergeSchedulerState: 그 외 필드', () => {
  it('asOf/characterName/world/level/jobClass는 fresh 값을 그대로 반영한다', () => {
    const fresh = baseState({ characterName: '테스트캐릭', level: 100 })

    const result = mergeSchedulerState({ previous: null, fresh, worldLedger: {}, accountLedger: {}, now: NOW })

    expect(result.characterState.characterName).toBe('테스트캐릭')
    expect(result.characterState.level).toBe(100)
  })
})
