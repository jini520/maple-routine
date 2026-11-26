
import {
  displayedDailyContents,
  displayedWeeklyContents,
  type DisplayedContentsInput,
} from '../displayed-contents'
import { contentTemplate, findContent } from '../../../lib/scheduler/contents'
import { getShareScope } from '../../../lib/scheduler/scheduler-content-scope'
import type { DailyContent, WeeklyContent } from '../../../types'

// `표시 대상 컨텐츠` 판정을 화면이 아니라 여기서 한다. 이 필터가 빠지면 **모든 캐릭터가 일퀘 18**
// (= 일일 카탈로그 길이)로 나온다. 아래 첫 테스트가 그 회귀를 잡는다.

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
const ALL_DAILY_KEYS = contentTemplate().daily.map((entry) => entry.key)
const ALL_WEEKLY_KEYS = contentTemplate().weekly.map((entry) => entry.key)
/** 캐릭터 범위인 key. 공유 범위인 key 는 이 목록에 들지 않아 아래 판정을 흐린다. */
const DAILY_KEYS = ALL_DAILY_KEYS.filter((key) => getShareScope(key) === 'character')
const WEEKLY_KEYS = ALL_WEEKLY_KEYS.filter((key) => getShareScope(key) === 'character')

/** 주간 기간 키. 시작 기간이 있는 줄(아우룸 레기스)은 공유 범위라 이 목록에 들지 않고, 그 판정은 `shared-contents` 가 본다. */
const 패치주 = '2026-09-17'

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

  it('수동 모드는 주간 멤버십을 일일 목록에 섞지 않는다 (kind 로 가른다)', () => {
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

  it('수동 모드는 멤버십이 목록을 정하고 일일 항목을 섞지 않는다', () => {
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

describe('공유 범위가 캐릭터가 아닌 컨텐츠', () => {
  const SHARED_DAILY = ALL_DAILY_KEYS.filter((key) => getShareScope(key) !== 'character')
  const SHARED_WEEKLY = ALL_WEEKLY_KEYS.filter((key) => getShareScope(key) !== 'character')

  it('표에 그런 컨텐츠가 있다(아래 판정이 빈 집합을 보는 것이 아니다)', () => {
    expect(SHARED_DAILY.length).toBeGreaterThan(0)
    expect(SHARED_WEEKLY.length).toBeGreaterThan(0)
  })

  it('자동 모드는 등록돼 있어도 일일 · 주간 목록에 넣지 않는다', () => {
    const value = input({
      dailyContents: ALL_DAILY_KEYS.map((key) => daily(key, true)),
      weeklyContents: ALL_WEEKLY_KEYS.map((key) => weekly(key, true)),
    })

    const shown = [
      ...displayedDailyContents(value, 'auto', 패치주),
      ...displayedWeeklyContents(value, 'auto', 패치주),
    ]

    expect(shown.length).toBeGreaterThan(0)
    expect(shown.every((content) => getShareScope(content.contentKey) === 'character')).toBe(true)
  })

  it('수동 모드는 추적 목록에 있어도 일일 · 주간 목록에 넣지 않는다', () => {
    const value = input({
      manualItems: [
        ...ALL_DAILY_KEYS.map((contentKey) => ({ contentKey, kind: 'daily' as const })),
        ...ALL_WEEKLY_KEYS.map((contentKey) => ({ contentKey, kind: 'weekly' as const })),
      ],
    })

    const shown = [
      ...displayedDailyContents(value, 'manual', 패치주),
      ...displayedWeeklyContents(value, 'manual', 패치주),
    ]

    expect(shown.length).toBeGreaterThan(0)
    expect(shown.every((content) => getShareScope(content.contentKey) === 'character')).toBe(true)
  })
})
