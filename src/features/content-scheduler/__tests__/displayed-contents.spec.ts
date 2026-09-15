
import {
  displayedDailyContents,
  displayedWeeklyContents,
  type DisplayedContentsInput,
} from '../displayed-contents'
import { CONTENT_TEMPLATE, findContent } from '../../../lib/scheduler/contents'
import type { DailyContent, WeeklyContent } from '../../../types'

// `표시 대상 컨텐츠` 판정을 화면이 아니라 여기서 한다. 이 필터가 빠지면 **모든 캐릭터가 일퀘 18**
// (= 일간 카탈로그 길이)로 나온다. 아래 첫 테스트가 그 회귀를 잡는다.

/** 표에 있는 key 면 표의 API 이름을, 표에 없는 컨텐츠(`null`)면 넘긴 API 이름을 든다. */
function daily(
  contentKey: string | null,
  isRegistered: boolean,
  apiName = findContent(contentKey)!.content_name,
): DailyContent {
  return { contentKey, apiName, kind: 'contents', isRegistered, nowCount: 0, maxCount: 1, questState: null }
}

function weekly(
  contentKey: string | null,
  isRegistered: boolean,
  apiName = findContent(contentKey)!.content_name,
): WeeklyContent {
  return { contentKey, apiName, kind: 'contents', isRegistered, nowCount: 0, maxCount: 1, questState: null }
}

/** 실제 템플릿에서 빌린 key. 지어낸 key 는 템플릿 정렬을 타지 못해 판정이 흐려진다. */
const DAILY_KEYS = CONTENT_TEMPLATE.daily.map((entry) => entry.key)
const WEEKLY_KEYS = CONTENT_TEMPLATE.weekly.map((entry) => entry.key)

/** 주간 기간 키. 아우룸 레기스는 2026-09-17 주부터 선다. */
const 패치전주 = '2026-09-10'
const 패치주 = '2026-09-17'
const 아우룸 = 'epic_dungeon_aurum_regis'

function input(overrides: Partial<DisplayedContentsInput> = {}): DisplayedContentsInput {
  return { dailyContents: [], weeklyContents: [], manualItems: [], ...overrides }
}

describe('displayedDailyContents', () => {
  it('자동 모드는 **등록된 것만** 센다. 카탈로그 전체가 아니다', () => {
    const contents = DAILY_KEYS.map((key, index) => daily(key, index < 2))

    const result = displayedDailyContents(input({ dailyContents: contents }), 'auto', 패치주)

    expect(result).toHaveLength(2)
    expect(result.length).toBeLessThan(DAILY_KEYS.length)
  })

  it('등록이 하나도 없으면 빈 목록이다. 카탈로그 길이로 떨어지지 않는다', () => {
    const contents = DAILY_KEYS.map((key) => daily(key, false))

    expect(displayedDailyContents(input({ dailyContents: contents }), 'auto', 패치주)).toEqual([])
  })

  it('수동 모드는 등록 여부가 아니라 **멤버십**이 목록을 정한다', () => {
    const contents = DAILY_KEYS.map((key) => daily(key, false)) // 게임 등록은 전부 없음

    const result = displayedDailyContents(
      input({
        dailyContents: contents,
        manualItems: [{ contentKey: DAILY_KEYS[0], kind: 'daily' }],
      }),
      'manual',
      패치주,
    )

    expect(result.map((content) => content.contentKey)).toEqual([DAILY_KEYS[0]])
  })

  it('수동 모드는 주간 멤버십을 일간 목록에 섞지 않는다 (kind 로 가른다)', () => {
    const result = displayedDailyContents(
      input({
        dailyContents: DAILY_KEYS.map((key) => daily(key, false)),
        manualItems: [{ contentKey: WEEKLY_KEYS[0], kind: 'weekly' }],
      }),
      'manual',
      패치주,
    )

    expect(result).toEqual([])
  })

  it('자동 모드도 템플릿 순서로 정렬한다. 순서가 화면마다 다르면 같은 목록으로 안 보인다', () => {
    const picked = [DAILY_KEYS[3], DAILY_KEYS[1], DAILY_KEYS[0]]
    const contents = picked.map((key) => daily(key, true))

    const result = displayedDailyContents(input({ dailyContents: contents }), 'auto', 패치주)

    expect(result.map((content) => content.contentKey)).toEqual([
      DAILY_KEYS[0],
      DAILY_KEYS[1],
      DAILY_KEYS[3],
    ])
  })
})

describe('displayedWeeklyContents', () => {
  it('자동 모드는 등록된 것만 센다', () => {
    const contents = WEEKLY_KEYS.map((key, index) => weekly(key, index === 0))

    const result = displayedWeeklyContents(input({ weeklyContents: contents }), 'auto', 패치주)

    expect(result.map((content) => content.contentKey)).toEqual([WEEKLY_KEYS[0]])
  })

  it('수동 모드는 멤버십이 목록을 정하고 일간 항목을 섞지 않는다', () => {
    const result = displayedWeeklyContents(
      input({
        weeklyContents: WEEKLY_KEYS.map((key) => weekly(key, false)),
        manualItems: [
          { contentKey: WEEKLY_KEYS[1], kind: 'weekly' },
          { contentKey: DAILY_KEYS[0], kind: 'daily' },
        ],
      }),
      'manual',
      패치주,
    )

    expect(result.map((content) => content.contentKey)).toEqual([WEEKLY_KEYS[1]])
  })
})

// 표에 없는 컨텐츠(key 가 없다)는 게임이 등록을 알려 주는 자동 모드에서만 API 이름으로 선다. 수동 모드는
// 추적 목록이 key 로 고르므로 고를 수 없다.
describe('표에 없는 컨텐츠', () => {
  const 새컨텐츠 = weekly(null, true, '[주간 퀘스트] 새 지역 주간 임무')

  it('자동 모드는 등록돼 있으면 템플릿 줄 뒤에 API 이름 그대로 세운다', () => {
    const result = displayedWeeklyContents(
      input({ weeklyContents: [새컨텐츠, weekly(WEEKLY_KEYS[0], true)] }),
      'auto',
      패치주,
    )

    expect(result.map((content) => [content.contentKey, content.apiName])).toEqual([
      [WEEKLY_KEYS[0], findContent(WEEKLY_KEYS[0])!.content_name],
      [null, '[주간 퀘스트] 새 지역 주간 임무'],
    ])
  })

  it('수동 모드는 응답에 있어도 안 세운다', () => {
    const result = displayedWeeklyContents(
      input({
        weeklyContents: [새컨텐츠, weekly(WEEKLY_KEYS[0], false)],
        manualItems: [{ contentKey: WEEKLY_KEYS[0], kind: 'weekly' }],
      }),
      'manual',
      패치주,
    )

    expect(result.map((content) => content.contentKey)).toEqual([WEEKLY_KEYS[0]])
  })
})

// 출시 전인 컨텐츠를 지금 할 수 있는 일로 그리지 않는다. 그런데 1.0.8 사용자가 09-17 전에 이미
// 골랐을 수 있어서, 추적 목록은 그대로 두고 그리기만 거른다.
describe('수동 모드: 시작 기간 전인 추적 항목', () => {
  const manualItems = [
    { contentKey: 아우룸, kind: 'weekly' as const },
    { contentKey: WEEKLY_KEYS[0], kind: 'weekly' as const },
  ]

  it('2026-09-10 주에는 안 그린다', () => {
    const result = displayedWeeklyContents(input({ manualItems }), 'manual', 패치전주)

    expect(result.map((content) => content.contentKey)).toEqual([WEEKLY_KEYS[0]])
  })

  it('2026-09-17 주부터 그린다', () => {
    const result = displayedWeeklyContents(input({ manualItems }), 'manual', 패치주)

    expect(result.map((content) => content.contentKey)).toContain(아우룸)
  })

  it('추적 목록은 건드리지 않는다. 09-17 뒤에 다시 고르지 않아도 돌아온다', () => {
    const tracked = input({ manualItems })

    displayedWeeklyContents(tracked, 'manual', 패치전주)

    expect(tracked.manualItems).toEqual(manualItems)
  })

  // 자동 모드는 응답에 있고 등록된 것만 그린다. 출시 전에는 응답에 없으므로 거를 것이 없고,
  // 응답에 있으면 게임에 있는 것이다.
  it('자동 모드는 기간을 안 본다', () => {
    const result = displayedWeeklyContents(
      input({ weeklyContents: [weekly(아우룸, true)] }),
      'auto',
      패치전주,
    )

    expect(result.map((content) => content.contentKey)).toEqual([아우룸])
  })
})
