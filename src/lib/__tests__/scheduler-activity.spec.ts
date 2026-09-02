import type { BossContent, DailyContent, SchedulerCharacterState, WeeklyContent } from '../../types'
import { getSectionPresence, hasCharacterScopeCompletion } from '../scheduler/scheduler-activity'

function daily(overrides: Partial<DailyContent> = {}): DailyContent {
  return {
    name: '[일일 퀘스트] 레헬른의 평온한 밤',
    kind: 'quest',
    isRegistered: true,
    nowCount: 0,
    maxCount: 0,
    questState: 0,
    ...overrides,
  }
}

function weekly(overrides: Partial<WeeklyContent> = {}): WeeklyContent {
  return {
    name: '[메이플 유니온] 주간 보스 격파',
    kind: 'quest',
    isRegistered: true,
    nowCount: 0,
    maxCount: 0,
    questState: 0,
    ...overrides,
  }
}

function boss(overrides: Partial<BossContent> = {}): BossContent {
  return {
    name: '스우',
    difficulty: '하드',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    ownComplete: false,
    ...overrides,
  }
}

function state(overrides: Partial<SchedulerCharacterState> = {}): SchedulerCharacterState {
  return {
    asOf: '2026-08-03T00:00+09:00',
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

describe('hasCharacterScopeCompletion (ADR-086 결정 3)', () => {
  it('아무 항목도 없으면 활동 증거가 없다', () => {
    expect(hasCharacterScopeCompletion(state())).toBe(false)
  })

  it('일간 퀘스트가 완료(questState 2)면 활동 증거다', () => {
    expect(hasCharacterScopeCompletion(state({ dailyContents: [daily({ questState: 2 })] }))).toBe(true)
  })

  it('일간 콘텐츠의 카운트가 올랐으면 활동 증거다', () => {
    expect(
      hasCharacterScopeCompletion(
        state({ dailyContents: [daily({ name: '어봤어', kind: 'contents', nowCount: 3, maxCount: 5 })] }),
      ),
    ).toBe(true)
  })

  it('등록만 하고 완료하지 않았으면 활동 증거가 아니다', () => {
    expect(
      hasCharacterScopeCompletion(
        state({
          dailyContents: [daily({ isRegistered: true, questState: 0 })],
          weeklyContents: [weekly({ isRegistered: true, questState: 1 })],
        }),
      ),
    ).toBe(false)
  })

  it('주간 퀘스트 완료도 활동 증거다', () => {
    expect(hasCharacterScopeCompletion(state({ weeklyContents: [weekly({ questState: 2 })] }))).toBe(true)
  })

  it('보스는 ownComplete만 본다 — 승격된 isComplete는 다른 난이도의 완료다', () => {
    expect(
      hasCharacterScopeCompletion(state({ bossContents: [boss({ isComplete: true, ownComplete: false })] })),
    ).toBe(false)
    expect(
      hasCharacterScopeCompletion(state({ bossContents: [boss({ isComplete: true, ownComplete: true })] })),
    ).toBe(true)
  })

  describe('월드/계정 공유 항목은 제외한다 (ADR-030 오염)', () => {
    it('몬스터파크(월드 공유) 카운트만으로는 활동 증거가 아니다', () => {
      expect(
        hasCharacterScopeCompletion(
          state({
            dailyContents: [daily({ name: '몬스터파크', kind: 'contents', nowCount: 7, maxCount: 14 })],
          }),
        ),
      ).toBe(false)
    })

    it('에픽 던전(계정 공유) 카운트만으로는 활동 증거가 아니다', () => {
      expect(
        hasCharacterScopeCompletion(
          state({
            weeklyContents: [
              weekly({ name: '에픽 던전 : 악몽선경', kind: 'contents', nowCount: 5, maxCount: 5 }),
            ],
          }),
        ),
      ).toBe(false)
    })

    // ADR-086 정정 1 — 실기기 계측 재현(게터, 엘리시움 Lv.275, 2026-08-03).
    // 이 응답이 14일 중 11일에 걸쳐 quest=2 였고, 그것만으로 미접속 캐릭터가 후보 목록에
    // 남았다. 완료를 만든 것은 같은 월드의 **다른 캐릭터**다(ADR-030 "마지막 활성 캐릭터" 오염).
    it('[몬스터파크] 익스트림 몬스터파커 퀘스트 완료만으로는 활동 증거가 아니다', () => {
      expect(
        hasCharacterScopeCompletion(
          state({
            weeklyContents: [
              weekly({
                name: '[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?',
                nowCount: 0,
                maxCount: 0,
                questState: 2,
              }),
            ],
          }),
        ),
      ).toBe(false)
    })

    it('[메이플 유니온] PC방 주간 드래곤 퇴치 완료만으로는 활동 증거가 아니다', () => {
      expect(
        hasCharacterScopeCompletion(
          state({
            weeklyContents: [
              weekly({ name: '[메이플 유니온] PC방 주간 드래곤 퇴치', questState: 2 }),
            ],
          }),
        ),
      ).toBe(false)
    })

    it('공유 항목과 캐릭터 항목이 섞여 있으면 캐릭터 항목만으로 판정한다', () => {
      expect(
        hasCharacterScopeCompletion(
          state({
            dailyContents: [
              daily({ name: '몬스터파크', kind: 'contents', nowCount: 7, maxCount: 14 }),
              daily({ questState: 2 }),
            ],
          }),
        ),
      ).toBe(true)
    })
  })

  // ADR-086 정정 2 — 실기기 계측 재현(낟낟, 2026-08-03). 공유 여부와는 다른 축이다:
  // 이 항목은 캐릭터 개인 기록이 맞지만 now_count가 리셋을 넘어서도 줄지 않는다
  // (73635 → 75889 → 79579, 07-30 주간 리셋 통과). 그래서 "한 번이라도 해봤음"이 영원히
  // "최근 14일에 했음"으로 읽혔고, 그 콘텐츠를 해본 캐릭터 전원이 자격을 얻었다.
  describe('누적 점수 항목은 활동 증거가 아니다 (ADR-086 정정 2)', () => {
    it('[길드] 지하 수로의 누적 점수만으로는 자격을 주지 않는다', () => {
      expect(
        hasCharacterScopeCompletion(
          state({
            weeklyContents: [
              weekly({ name: '[길드] 지하 수로', kind: 'contents', nowCount: 79579, maxCount: 0 }),
            ],
          }),
        ),
      ).toBe(false)
    })

    it('같은 길드 항목이라도 주기마다 리셋되는 것은 그대로 활동 증거다', () => {
      expect(
        hasCharacterScopeCompletion(
          state({
            weeklyContents: [
              weekly({ name: '[길드] 주간 미션 포인트', kind: 'contents', nowCount: 5, maxCount: 10 }),
            ],
          }),
        ),
      ).toBe(true)
    })

    it('누적 항목과 실제 활동이 함께 있으면 실제 활동으로 통과한다', () => {
      expect(
        hasCharacterScopeCompletion(
          state({
            weeklyContents: [
              weekly({ name: '[길드] 지하 수로', kind: 'contents', nowCount: 79579, maxCount: 0 }),
            ],
            dailyContents: [daily({ questState: 2 })],
          }),
        ),
      ).toBe(true)
    })
  })
})

describe('getSectionPresence', () => {
  it('전부 신선하면 네 섹션이 모두 present다', () => {
    expect(
      getSectionPresence(state({ dailyContents: [daily()], weeklyContents: [weekly()] })),
    ).toEqual({ daily: true, weekly: true, weeklyBoss: true, monthlyBoss: true })
  })

  it('stale 플래그가 선 섹션은 present가 아니다', () => {
    expect(
      getSectionPresence(state({ isDailyStale: true, isMonthlyBossStale: true })),
    ).toMatchObject({ daily: false, weekly: true, weeklyBoss: true, monthlyBoss: false })
  })

  it('공유 항목만 남은 일간 섹션은 present가 아니다 (ADR-034 정정)', () => {
    expect(
      getSectionPresence(
        state({ dailyContents: [daily({ name: '몬스터파크', kind: 'contents', nowCount: 7 })] }),
      ),
    ).toMatchObject({ daily: false })
  })
})

// [[ADR-172]] 결정 5 — 조회 원장에 «그날 완료로 본 보스» 를 함께 남긴다. 그 목록이 처치 날짜를
// 캐는 원재료이므로, **기록에 쓰는 것과 같은 이름·같은 난이도**로 적혀야 한다.
describe('completedBossKeys ([[ADR-172]])', () => {
  it('ownComplete 인 보스만, 「이름|난이도」로 적는다', () => {
    const { completedBossKeys } = require('../scheduler/scheduler-activity') as typeof import('../scheduler/scheduler-activity')

    expect(
      completedBossKeys(
        state({
          bossContents: [
            boss({ name: '스우', difficulty: '하드', ownComplete: true, isComplete: true }),
            boss({ name: '데미안', difficulty: '하드', ownComplete: false }),
          ],
        }),
      ),
    ).toEqual(['스우|하드'])
  })

  it('승격된 isComplete 는 안 센다 — 다른 난이도의 완료가 옮겨 붙은 값이다 ([[ADR-032]])', () => {
    const { completedBossKeys } = require('../scheduler/scheduler-activity') as typeof import('../scheduler/scheduler-activity')

    expect(
      completedBossKeys(
        state({
          bossContents: [boss({ name: '스우', difficulty: '이지', isComplete: true, ownComplete: false })],
        }),
      ),
    ).toEqual([])
  })

  it('보스 섹션이 비면 빈 목록이다 — 접속하지 않은 날은 «미완료» 로 읽힌다 ([[ADR-030]])', () => {
    const { completedBossKeys } = require('../scheduler/scheduler-activity') as typeof import('../scheduler/scheduler-activity')

    expect(completedBossKeys(state({ bossContents: [] }))).toEqual([])
  })

  it('toProbeObservation 이 그 목록을 함께 낸다 — 원장이 관측 하나로 둘을 든다', () => {
    const { toProbeObservation } = require('../scheduler/scheduler-activity') as typeof import('../scheduler/scheduler-activity')

    const observation = toProbeObservation(
      state({ bossContents: [boss({ name: '스우', difficulty: '하드', ownComplete: true })] }),
    )

    expect(observation.bosses).toEqual(['스우|하드'])
    expect(observation.hasCompletion).toBe(true)
  })
})
