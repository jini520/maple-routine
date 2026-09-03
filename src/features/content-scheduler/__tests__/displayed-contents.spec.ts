
import {
  displayedDailyContents,
  displayedWeeklyContents,
  type DisplayedContentsInput,
} from '../displayed-contents'
import { CONTENT_TEMPLATE } from '../../../lib/scheduler/scheduler-content-template'
import type { DailyContent, WeeklyContent } from '../../../types'

// `표시 대상 컨텐츠` 판정을 화면이 아니라 여기서 한다. 이 필터가 빠지면 **모든 캐릭터가 일퀘 18**
// (= 일간 카탈로그 길이)로 나온다. 아래 첫 테스트가 그 회귀를 잡는다.

function daily(name: string, isRegistered: boolean): DailyContent {
  return { name, kind: 'contents', isRegistered, nowCount: 0, maxCount: 1, questState: null }
}

function weekly(name: string, isRegistered: boolean): WeeklyContent {
  return { name, kind: 'contents', isRegistered, nowCount: 0, maxCount: 1, questState: null }
}

/** 실제 템플릿에서 빌린 이름. 지어낸 이름은 템플릿 정렬을 타지 못해 판정이 흐려진다. */
const DAILY_NAMES = CONTENT_TEMPLATE.daily.map((entry) => entry.content_name)
const WEEKLY_NAMES = CONTENT_TEMPLATE.weekly.map((entry) => entry.content_name)

function input(overrides: Partial<DisplayedContentsInput> = {}): DisplayedContentsInput {
  return { dailyContents: [], weeklyContents: [], manualItems: [], ...overrides }
}

describe('displayedDailyContents', () => {
  it('자동 모드는 **등록된 것만** 센다. 카탈로그 전체가 아니다', () => {
    const contents = DAILY_NAMES.map((name, index) => daily(name, index < 2))

    const result = displayedDailyContents(input({ dailyContents: contents }), 'auto')

    expect(result).toHaveLength(2)
    expect(result.length).toBeLessThan(DAILY_NAMES.length)
  })

  it('등록이 하나도 없으면 빈 목록이다. 카탈로그 길이로 떨어지지 않는다', () => {
    const contents = DAILY_NAMES.map((name) => daily(name, false))

    expect(displayedDailyContents(input({ dailyContents: contents }), 'auto')).toEqual([])
  })

  it('수동 모드는 등록 여부가 아니라 **멤버십**이 목록을 정한다', () => {
    const contents = DAILY_NAMES.map((name) => daily(name, false)) // 게임 등록은 전부 없음

    const result = displayedDailyContents(
      input({
        dailyContents: contents,
        manualItems: [{ contentName: DAILY_NAMES[0], kind: 'daily' }],
      }),
      'manual',
    )

    expect(result.map((content) => content.name)).toEqual([DAILY_NAMES[0]])
  })

  it('수동 모드는 주간 멤버십을 일간 목록에 섞지 않는다 (kind 로 가른다)', () => {
    const result = displayedDailyContents(
      input({
        dailyContents: DAILY_NAMES.map((name) => daily(name, false)),
        manualItems: [{ contentName: WEEKLY_NAMES[0], kind: 'weekly' }],
      }),
      'manual',
    )

    expect(result).toEqual([])
  })

  it('자동 모드도 템플릿 순서로 정렬한다. 순서가 화면마다 다르면 같은 목록으로 안 보인다', () => {
    const picked = [DAILY_NAMES[3], DAILY_NAMES[1], DAILY_NAMES[0]]
    const contents = picked.map((name) => daily(name, true))

    const result = displayedDailyContents(input({ dailyContents: contents }), 'auto')

    expect(result.map((content) => content.name)).toEqual([
      DAILY_NAMES[0],
      DAILY_NAMES[1],
      DAILY_NAMES[3],
    ])
  })
})

describe('displayedWeeklyContents', () => {
  it('자동 모드는 등록된 것만 센다', () => {
    const contents = WEEKLY_NAMES.map((name, index) => weekly(name, index === 0))

    const result = displayedWeeklyContents(input({ weeklyContents: contents }), 'auto')

    expect(result.map((content) => content.name)).toEqual([WEEKLY_NAMES[0]])
  })

  it('수동 모드는 멤버십이 목록을 정하고 일간 항목을 섞지 않는다', () => {
    const result = displayedWeeklyContents(
      input({
        weeklyContents: WEEKLY_NAMES.map((name) => weekly(name, false)),
        manualItems: [
          { contentName: WEEKLY_NAMES[1], kind: 'weekly' },
          { contentName: DAILY_NAMES[0], kind: 'daily' },
        ],
      }),
      'manual',
    )

    expect(result.map((content) => content.name)).toEqual([WEEKLY_NAMES[1]])
  })
})
