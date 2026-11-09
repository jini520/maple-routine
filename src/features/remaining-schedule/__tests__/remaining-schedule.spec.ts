// 캐릭터 하나의 남은 스케줄. today 의 남은 스케줄 타일과 미완료 스케줄 알림이 같은 함수를 부른다.
import type { MatchedBoss } from '../../../lib/boss/boss-matching'
import { findContent } from '../../../lib/scheduler/contents'
import type { BossCharacterView } from '../../boss-scheduler/store'
import type { ContentCharacterView } from '../../content-scheduler/store'
import type { DailyContent, WeeklyContent } from '../../../types'
import { remainingScheduleOf, type RemainingScheduleInput } from '../remaining-schedule'

// 2026-08-17(월) 12:00 KST. 주간 기간 키는 직전 목요일 2026-08-13 이다.
const NOW = new Date('2026-08-17T03:00:00.000Z')
const WEEK_KEY = '2026-08-13'

function content(contentKey: string): Pick<DailyContent, 'contentKey' | 'apiName'> {
  return { contentKey, apiName: findContent(contentKey)!.content_name }
}

/** 표에 없는 일일 퀘스트. 공유 범위와 요구 레벨이 끼지 않는다. */
function daily(overrides: Partial<DailyContent> = {}): DailyContent {
  return { contentKey: null, apiName: '일일 퀘스트', kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 0, ...overrides }
}

function weekly(overrides: Partial<WeeklyContent> = {}): WeeklyContent {
  return { ...content('weekly_quest_critias'), kind: 'quest', isRegistered: true, nowCount: 0, maxCount: 0, questState: 0, ...overrides }
}

function boss(overrides: Partial<MatchedBoss> = {}): MatchedBoss {
  return {
    bossKey: 'lotus',
    apiName: '스우',
    difficulty: 'normal',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    ownComplete: false,
    portraitAssetId: null,
    isSeasonBoss: false,
    ...overrides,
  }
}

function contentView(overrides: Partial<ContentCharacterView> = {}): ContentCharacterView {
  return { ocid: 'a', characterName: 'a', dailyContents: [], weeklyContents: [], isStale: false, syncedAt: NOW.toISOString(), error: null, ...overrides }
}

function bossView(overrides: Partial<BossCharacterView> = {}): BossCharacterView {
  return {
    ocid: 'a',
    characterName: 'a',
    weeklyBosses: [],
    monthlyBosses: [],
    weeklyBossClearCount: 0,
    weeklyBossClearLimitCount: 12,
    isStale: false,
    syncedAt: NOW.toISOString(),
    error: null,
    ...overrides,
  }
}

function input(overrides: Partial<RemainingScheduleInput> = {}): RemainingScheduleInput {
  return {
    content: undefined,
    boss: undefined,
    trackingMode: 'auto',
    manualContentItems: [],
    manualBossByOcid: null,
    manualCompletedByOcid: {},
    weeklyPeriodKey: WEEK_KEY,
    now: NOW,
    ...overrides,
  }
}

describe('remainingScheduleOf', () => {
  it('완료한 항목과 보스는 남은 것이 아니다', () => {
    const remaining = remainingScheduleOf(
      input({
        content: contentView({
          dailyContents: [daily({ apiName: 'd1', questState: 2 }), daily({ apiName: 'd2' })],
          weeklyContents: [weekly({ questState: 2 })],
        }),
        boss: bossView({ weeklyBosses: [boss({ isComplete: true }), boss({ bossKey: 'damien', apiName: '데미안' })] }),
      }),
    )

    expect(remaining.dailyNames).toEqual(['d2'])
    expect(remaining.weeklyNames).toEqual([])
    expect(remaining.weeklyBosses.map((item) => item.bossKey)).toEqual(['damien'])
  })

  // 진행이 월드 · 계정 단위라 캐릭터마다 세면 하루 한 번 할 일이 캐릭터 수만큼 부푼다.
  it('공유 컨텐츠는 세지 않는다', () => {
    const remaining = remainingScheduleOf(
      input({
        content: contentView({
          dailyContents: [daily({ ...content('monster_park'), kind: 'contents', nowCount: 0, maxCount: 7 }), daily({ apiName: 'd1' })],
        }),
      }),
    )

    expect(remaining.dailyNames).toEqual(['d1'])
  })

  // 게임이 등록을 허용해도 이 캐릭터로는 못 하므로 세면 그 수가 영원히 안 줄어든다.
  it('요구 레벨에 못 미치는 항목은 세지 않고, 레벨을 모르면 전부 센다', () => {
    const contents = [daily(content('daily_quest_road_of_vanishing')), daily({ apiName: 'd1' })]

    expect(remainingScheduleOf(input({ content: contentView({ level: 150, dailyContents: contents }) })).dailyNames).toEqual(['d1'])
    expect(remainingScheduleOf(input({ content: contentView({ level: null, dailyContents: contents }) })).dailyNames).toHaveLength(2)
  })

  it('수동 모드는 추적 목록에 든 항목만 센다', () => {
    const content = contentView({ weeklyContents: [weekly({ isRegistered: false })] })

    expect(remainingScheduleOf(input({ content })).weeklyNames).toEqual([])
    expect(
      remainingScheduleOf(
        input({ content, trackingMode: 'manual', manualContentItems: [{ kind: 'weekly', contentKey: 'weekly_quest_critias' }] }),
      ).weeklyNames,
    ).toEqual(['크리티아스 주간 임무'])
  })

  it('직접 적은 완료는 남은 보스에서 뺀다', () => {
    const remaining = remainingScheduleOf(
      input({
        boss: bossView({ weeklyBosses: [boss()] }),
        manualCompletedByOcid: { a: ['lotus|normal'] },
      }),
    )

    expect(remaining.weeklyBosses).toEqual([])
  })

  it('이름은 표의 짧은 이름이고 보스는 표의 이름이다', () => {
    const remaining = remainingScheduleOf(
      input({
        content: contentView({ dailyContents: [daily(content('daily_quest_lacheln'))] }),
        boss: bossView({ monthlyBosses: [boss({ bossKey: 'black_mage', apiName: '검은 마법사', cycle: 'monthly', difficulty: 'hard' })] }),
      }),
    )

    expect(remaining.dailyNames).toEqual(['레헬른'])
    expect(remaining.monthlyBosses).toEqual([{ bossKey: 'black_mage', name: '검은 마법사', difficulty: 'hard' }])
  })
})
