import weeklyBossesData from '../../../data/weekly-bosses.json'
import { WEEKLY_BOSS_CLEAR_LIMIT } from '../../../lib/boss/boss-matching'
import { bossKeyOfApiName } from '../../../lib/boss/bosses'
// today 뷰모델의 **조립 규칙**. 위젯이 스토어를 모르므로 화면이 값을 한
// 번 모으는데, 그 조립을 순수 함수로 두면 **위젯이 한 줄도 없는 지금 로직 전부를 검증할 수 있다.**
//
// 여기서 지키는 것의 대부분은 **다시 구현하지 않았는가** 다. 남은 개수는 `content-completion`·
// `displayedBosses` 가, 수익은 `groupTotalMeso` 가, 한도 분모는 `WEEKLY_CRYSTAL_SALE_LIMIT` 가
// 판정한다. 판정이 두 벌이 되면 today 와 원래 화면이 **다른 수를 말한다.**

import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../../lib/boss/boss-matching'
import type { MatchedBoss } from '../../../lib/boss/boss-matching'
import type { DropHistoryPeriodGroup, DropHistoryRecord } from '../../../lib/drop/drop-history'
import type { BossProfitRow } from '../../../features/boss-profit/store'
import type { ContentCharacterView } from '../../../features/content-scheduler/store'
import type { BossCharacterView } from '../../../features/boss-scheduler/store'
import type { CharacterBasicProfile, DailyContent, WeeklyContent } from '../../../types'
import { findContent } from '../../../lib/scheduler/contents'

import { buildTodayViewModel, type TodayViewModelInput } from '../view-model'

// 2026-08-17(월) 12:00 KST. 이 시점의 주간 기간 키는 직전 목요일인 2026-08-13 이다.
const NOW = new Date('2026-08-17T03:00:00.000Z')
const WEEK_KEY = '2026-08-13'
const HOUR_MS = 60 * 60 * 1000

/** 표에 있는 컨텐츠의 신원 둘. API 이름은 표의 `content_name` 이다. */
function content(contentKey: string): Pick<DailyContent, 'contentKey' | 'apiName'> {
  return { contentKey, apiName: findContent(contentKey)!.content_name }
}

/** 기본값은 표에 없는 일일 퀘스트다. 공유 범위와 요구 레벨이 끼지 않는다. */
function daily(overrides: Partial<DailyContent> = {}): DailyContent {
  return {
    contentKey: null,
    apiName: '일일 퀘스트',
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
    ...content('weekly_quest_critias'),
    kind: 'quest',
    isRegistered: true,
    nowCount: 0,
    maxCount: 0,
    questState: 0,
    ...overrides,
  }
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
    portraitSlug: null,
    isSeasonBoss: false,
    ...overrides,
  }
}

function contentView(ocid: string, overrides: Partial<ContentCharacterView> = {}): ContentCharacterView {
  return {
    ocid,
    characterName: ocid,
    dailyContents: [],
    weeklyContents: [],
    isStale: false,
    syncedAt: NOW.toISOString(),
    error: null,
    ...overrides,
  }
}

function bossView(ocid: string, overrides: Partial<BossCharacterView> = {}): BossCharacterView {
  return {
    ocid,
    characterName: ocid,
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

function profitRow(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'a',
    characterName: 'a',
    imageUrl: null,
    world: '스카니아',
    worldKey: 'scania',
    bossKey: 'lotus',
    bossName: '스우',
    difficulty: 'normal',
    cycle: 'weekly',
    periodKey: WEEK_KEY,
    periodLabel: '이번 주',
    priceMeso: 100,
    maxPartySize: 6,
    partySize: 1,
    payoutMeso: 100,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    isComplete: true,
    defeatedOn: null,
    source: 'auto',
    ...overrides,
  }
}

function dropRecord(overrides: Partial<DropHistoryRecord> = {}): DropHistoryRecord {
  return {
    ocid: 'a',
    bossKey: 'lotus',
    boss: '스우',
    difficulty: 'normal',
    periodKey: WEEK_KEY,
    category: 'equipment',
    // key 가 없는 기록이 기본이다. 그래야 이름을 덮는 케이스가 적어 둔 이름을 그대로 읽는다.
    itemKey: null,
    itemName: '가디언 엔젤링',
    quantity: 1,
    ...overrides,
  }
}

function dropGroup(records: DropHistoryRecord[], periodKey = WEEK_KEY): DropHistoryPeriodGroup {
  return { periodKey, cycle: periodKey.split('-').length === 3 ? 'weekly' : 'monthly', records }
}

function profile(overrides: Partial<CharacterBasicProfile> = {}): CharacterBasicProfile {
  return {
    name: '단풍루틴',
    level: 291,
    imageUrl: 'https://example.test/a.png',
    accessFlag: true,
    ...overrides,
  }
}

function input(overrides: Partial<TodayViewModelInput> = {}): TodayViewModelInput {
  return {
    now: NOW,
    orderedOcids: [],
    representativeOcid: null,
    profilesByOcid: {},
    contentCharacters: [],
    manualCompletedByOcid: {},
    bossCharacters: [],
    trackingMode: 'auto',
    manualContentByOcid: null,
    manualBossByOcid: null,
    characterIssues: {},
    profitRows: [],
    profitDropsByRowKey: {},
    dropGroups: [],
    drought: null,
    ...overrides,
  }
}

// 머리 버튼이 돌리는 얼굴 목록. **대표를 앞에 두는 것과 셋으로 자르는 것이 판정**이라 화면이
// 아니라 여기가 낸다(`TodayScreen` 에는 판정이 한 줄도 없다).
describe('머리 버튼의 얼굴 목록', () => {
  it('대표가 첫 칸이고 그 뒤는 캐릭터 관리 순서다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b', 'c'],
        representativeOcid: 'b',
        profilesByOcid: {
          a: profile({ name: 'A' }),
          b: profile({ name: 'B' }),
          c: profile({ name: 'C' }),
        },
      }),
    )

    expect(model.headerPortraits.map((p) => p.name)).toEqual(['B', 'A', 'C'])
  })

  // 미지정이면 목록의 첫 번째가 대표 자리에 선다(`resolveDisplayRepresentative`). 그 규칙을 여기서
  // 다시 쓰면 대표 카드와 이 버튼이 다른 캐릭터를 가리킬 수 있다.
  it('대표를 안 골랐으면 목록 순서 그대로다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b'],
        representativeOcid: null,
        profilesByOcid: { a: profile({ name: 'A' }), b: profile({ name: 'B' }) },
      }),
    )

    expect(model.headerPortraits.map((p) => p.name)).toEqual(['A', 'B'])
  })

  // 추적은 45명까지 간다. 전원을 돌리면 한 바퀴가 90초이고 얼굴 45장이 다 마운트된다.
  it('셋까지만 돈다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b', 'c', 'd', 'e'],
        profilesByOcid: {
          a: profile({ name: 'A' }),
          b: profile({ name: 'B' }),
          c: profile({ name: 'C' }),
          d: profile({ name: 'D' }),
          e: profile({ name: 'E' }),
        },
      }),
    )

    expect(model.headerPortraits.map((p) => p.name)).toEqual(['A', 'B', 'C'])
  })

  // 이름 없이 얼굴을 그릴 수 없고 ocid 는 사용자에게 뜻이 없는 값이다(대표 카드·드롭 위젯과 같은
  // 규칙). 그래서 추적이 넷이어도 도는 얼굴은 셋보다 적을 수 있다.
  it('프로필을 모르는 ocid 는 빠진다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b', 'c'],
        profilesByOcid: { b: profile({ name: 'B' }) },
      }),
    )

    expect(model.headerPortraits.map((p) => p.name)).toEqual(['B'])
  })

  it('추적이 없으면 빈 목록이다. 버튼이 사람 아이콘을 그린다', () => {
    expect(buildTodayViewModel(input()).headerPortraits).toEqual([])
  })

  it('얼굴 그림은 프로필이 든 것을 그대로 나른다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        profilesByOcid: { a: profile({ imageUrl: 'https://example.test/face.png' }) },
      }),
    )

    expect(model.headerPortraits[0].imageUrl).toBe('https://example.test/face.png')
    expect(model.headerPortraits[0].ocid).toBe('a')
  })
})

describe('남은 스케줄. 분류 넷', () => {
  it('일퀘·주간퀘는 content-completion 의 미완료 수다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          contentView('a', {
            dailyContents: [daily({ apiName: 'd1', questState: 2 }), daily({ apiName: 'd2' }), daily({ apiName: 'd3' })],
            weeklyContents: [weekly({ questState: 2 }), weekly({ ...content('erda_spectrum'), kind: 'contents', nowCount: 0, maxCount: 1 })],
          }),
        ],
      }),
    )

    expect(model.schedule[0].dailyNames).toHaveLength(2)
    expect(model.schedule[0].weeklyNames).toHaveLength(1)
  })

  // 무릉도장은 **다 했다** 가 정의되지 않는다. 세면 링도 위젯도 영원히 안 찬다.
  it('끝이 없는 항목(무릉도장)은 남은 개수에 들지 않는다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          contentView('a', {
            weeklyContents: [weekly({ ...content('mu_lung_dojo'), nowCount: 0, maxCount: 0 })],
          }),
        ],
      }),
    )

    expect(model.schedule[0].weeklyNames).toHaveLength(0)
  })

  // 좁은 자리라 표의 짧은 이름을 쓴다. 표에 없는 컨텐츠는 짧은 이름이 없어 API 이름 그대로다.
  it('표에 있는 항목은 짧은 이름으로, 표에 없는 항목은 API 이름으로 선다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          contentView('a', {
            dailyContents: [
              daily(content('daily_quest_lacheln')),
              daily({ contentKey: null, apiName: '[일일 퀘스트] 새 지역 조사' }),
            ],
            weeklyContents: [weekly()],
          }),
        ],
      }),
    )

    expect(model.schedule[0].dailyNames).toEqual(['레헬른', '[일일 퀘스트] 새 지역 조사'])
    expect(model.schedule[0].weeklyNames).toEqual(['크리티아스 주간 임무'])
  })

  it('주간 보스·검마는 displayedBosses 의 미완료 수다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        bossCharacters: [
          bossView('a', {
            weeklyBosses: [
              boss({ bossKey: 'lotus', apiName: '스우', isComplete: true }),
              boss({ bossKey: 'damien', apiName: '데미안' }),
              boss({ bossKey: 'lucid', apiName: '루시드' }),
            ],
            monthlyBosses: [boss({ bossKey: 'black_mage', apiName: '검은 마법사', cycle: 'monthly' })],
          }),
        ],
      }),
    )

    expect(model.schedule[0].weeklyBosses).toHaveLength(2)
    expect(model.schedule[0].monthlyBosses).toHaveLength(1)
  })

  // 미등록이어도 완료했으면 목록에 든다(그리고 완료라 남은 수엔 안 든다).
  // 판정을 여기서 다시 쓰면 이 규칙이 today 에서만 빠진다.
  it('등록되지 않았지만 완료한 보스는 displayedBosses 규칙대로 다뤄진다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        bossCharacters: [
          bossView('a', {
            weeklyBosses: [
              boss({ bossKey: 'lotus', apiName: '스우', difficulty: 'hard', isRegistered: false, isComplete: true }),
              boss({ bossKey: 'lotus', apiName: '스우', difficulty: 'normal', isRegistered: false, isComplete: false }),
            ],
          }),
        ],
      }),
    )

    expect(model.schedule[0].weeklyBosses).toHaveLength(0)
  })

  // 주간 한도를 채우면 남은 미처치 보스는 **남은 일** 이 아니다. 판정은 여기
  // 없다(`displayedBosses` 가 실어 보낸 `isWeeklyLimitClosed` 를 거를 뿐이다).
  it('주간 12마리를 채우면 미처치 등록 보스를 남은 것으로 세지 않는다', () => {
    const clearedNames = (weeklyBossesData.weekly as unknown as { name: string }[])
      .map((entry) => entry.name)
      .slice(-WEEKLY_BOSS_CLEAR_LIMIT)
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        bossCharacters: [
          bossView('a', {
            weeklyBosses: [
              // 보스 표에 없는 보스다. 기록은 안 되지만 남은 스케줄에는 API 원문으로 선다.
              boss({ bossKey: null, apiName: '미처치보스' }),
              ...clearedNames.map((name) =>
                boss({ bossKey: bossKeyOfApiName(name), apiName: name, isComplete: true, ownComplete: true }),
              ),
            ],
          }),
        ],
      }),
    )

    expect(model.schedule[0].weeklyBosses).toHaveLength(0)
  })

  it('한 마리 모자라면 그 보스는 여전히 남은 것이다', () => {
    const clearedNames = (weeklyBossesData.weekly as unknown as { name: string }[])
      .map((entry) => entry.name)
      .slice(-(WEEKLY_BOSS_CLEAR_LIMIT - 1))
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        bossCharacters: [
          bossView('a', {
            weeklyBosses: [
              // 보스 표에 없는 보스다. 기록은 안 되지만 남은 스케줄에는 API 원문으로 선다.
              boss({ bossKey: null, apiName: '미처치보스' }),
              ...clearedNames.map((name) =>
                boss({ bossKey: bossKeyOfApiName(name), apiName: name, isComplete: true, ownComplete: true }),
              ),
            ],
          }),
        ],
      }),
    )

    expect(model.schedule[0].weeklyBosses.map((entry) => entry.name)).toEqual(['미처치보스'])
  })

  it('선택된 캐릭터를 전부 담는다. `외 N명` 접기가 없다', () => {
    const ocids = ['a', 'b', 'c', 'd', 'e', 'f']
    const model = buildTodayViewModel(
      input({
        orderedOcids: ocids,
        contentCharacters: ocids.map((ocid) => contentView(ocid)),
      }),
    )

    expect(model.schedule).toHaveLength(6)
  })
})

describe('남은 스케줄. 순서는 **관리 순서**뿐이다', () => {
  function withRemaining(ocid: string, remaining: number): ContentCharacterView {
    return contentView(ocid, {
      dailyContents: Array.from({ length: remaining }, (_, index) => daily({ apiName: `${ocid}-${index}` })),
    })
  }

  // `남은 개수 많은 순`은 **어느 주기의** 개수인지가 정해져야 셀 수 있고, 그 주기는 위젯의 탭이다.
  // 여기서 총합으로 한 번 세워 두면 위젯이 다시 세우게 되고 동수의 기준(관리 순서)이 뭉개진다.
  it('남은 개수로 다시 세우지 않는다. 그 정렬은 탭을 아는 위젯의 몫이다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b', 'c'],
        contentCharacters: [withRemaining('a', 1), withRemaining('b', 5), withRemaining('c', 3)],
      }),
    )

    expect(model.schedule.map((row) => row.ocid)).toEqual(['a', 'b', 'c'])
  })

  it('캐릭터 관리 순서를 따른다. 스토어 순서(레벨 내림차순)가 아니다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['c', 'a', 'b'],
        contentCharacters: [withRemaining('a', 2), withRemaining('b', 2), withRemaining('c', 2)],
      }),
    )

    expect(model.schedule.map((row) => row.ocid)).toEqual(['c', 'a', 'b'])
  })

  // 실패를 맨 아래로 내리는 것도 **순서** 라, 정렬을 한 번만 하기로 한 뒤로는 위젯이 함께 판다.
  it('동기화 실패도 여기서는 안 내린다. 표식만 얹는다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b'],
        contentCharacters: [withRemaining('a', 9), withRemaining('b', 1)],
        characterIssues: { a: 'failed' },
      }),
    )

    expect(model.schedule.map((row) => row.ocid)).toEqual(['a', 'b'])
    expect(model.schedule[0].syncIssue).toBe('failed')
  })

  // 조회 불가와 동기화 실패는 처방이 다르다. 앞은 영구라 캐릭터 관리에서 손봐야 하고 뒤는
  // 새로고침이면 풀린다. 화면이 둘을 같은 말로 덮으면 사용자가 새로고침만 반복한다.
  it('조회 불가는 동기화 실패와 갈라 담는다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [withRemaining('a', 1)],
        characterIssues: { a: 'unavailable' },
      }),
    )

    expect(model.schedule[0].syncIssue).toBe('unavailable')
  })

  // **출처가 둘이고 도착 시각이 다르다.** 스케줄러 뷰는 캐시 우선 표시에서 즉시 오는데
  // `characterIssues` 는 보스 수익 스토어가 돌고 난 뒤에 온다. 그 사이에 위젯이 빈 내용 배열을
  // `0개 남음 = CLEAR` 로 읽어, 앱을 켜면 `CLEAR` 가 떴다가 `조회 불가` 로 바뀌었다.
  it('스케줄러 뷰가 조회 불가면 characterIssues 를 안 기다린다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          { ...withRemaining('a', 0), error: { kind: 'characterUnavailable' as const } },
        ],
        characterIssues: {},
      }),
    )

    expect(model.schedule[0].syncIssue).toBe('unavailable')
  })

  it('보스 스케줄러 뷰만 알고 있어도 선다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        bossCharacters: [bossView('a', { error: { kind: 'characterUnavailable' as const } })],
        characterIssues: {},
      }),
    )

    expect(model.schedule[0].syncIssue).toBe('unavailable')
  })

  // 그쪽 실패는 새로고침이면 풀린다. 영구 실패와 같은 말로 덮지 않는다.
  it('스케줄러 뷰의 그 외 실패는 failed 다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [{ ...withRemaining('a', 1), error: { kind: 'network' as const } }],
        characterIssues: {},
      }),
    )

    expect(model.schedule[0].syncIssue).toBe('failed')
  })

  // 이 위젯이 답하는 것은 **이번 주에 얼마 벌었나** 다. 조회 불가 캐릭터는 그 숫자를 못 내므로
  // 줄을 세우지 않는다(사용자 지정).
  it('이번 주 보스 수익 목록에서 조회 불가 캐릭터를 뺀다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        profilesByOcid: { a: profile({ name: '지내우시' }) },
        contentCharacters: [
          { ...withRemaining('a', 0), error: { kind: 'characterUnavailable' as const } },
        ],
      }),
    )

    expect(model.profit.topCharacters.map((view) => view.ocid)).not.toContain('a')
  })

  // 대표 카드도 같은 시각에 알아야 EXP 바가 떴다가 배지로 바뀌지 않는다.
  it('대표 카드도 스케줄러 뷰로 판정한다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        representativeOcid: 'a',
        profilesByOcid: { a: profile({ name: '지내우시' }) },
        contentCharacters: [
          { ...withRemaining('a', 0), error: { kind: 'characterUnavailable' as const } },
        ],
        characterIssues: {},
      }),
    )

    expect(model.representative?.unavailable).toBe(true)
  })

  it('실패가 없으면 null 이다', () => {
    const model = buildTodayViewModel(
      input({ orderedOcids: ['a'], contentCharacters: [withRemaining('a', 1)] }),
    )

    expect(model.schedule[0].syncIssue).toBeNull()
  })
})

// 조회 불가 캐릭터가 어디에 서든 그 사실이 함께 서야 한다. 한 화면에서만 말하면 다른 자리의
// 숫자가 여전히 아는 값처럼 읽힌다.
describe('조회 불가 표식이 닿는 자리', () => {
  it('대표 캐릭터가 조회 불가면 그 사실을 나른다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        representativeOcid: 'a',
        profilesByOcid: { a: profile({ name: '지내우시' }) },
        characterIssues: { a: 'unavailable' },
      }),
    )

    expect(model.representative?.unavailable).toBe(true)
  })

  it('대표가 멀쩡하면 거짓이다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        representativeOcid: 'a',
        profilesByOcid: { a: profile({ name: '지내우시' }) },
      }),
    )

    expect(model.representative?.unavailable).toBe(false)
  })

  // 동기화 실패는 마지막으로 확인한 값을 보여주는 상태라 조회 불가와 다르다.
  it('동기화 실패는 조회 불가가 아니다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        representativeOcid: 'a',
        profilesByOcid: { a: profile({ name: '지내우시' }) },
        characterIssues: { a: 'failed' },
      }),
    )

    expect(model.representative?.unavailable).toBe(false)
  })
})

describe('대표 캐릭터', () => {
  it('저장된 대표를 쓴다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b'],
        representativeOcid: 'b',
        profilesByOcid: { a: profile({ name: '가' }), b: profile({ name: '나' }) },
      }),
    )

    expect(model.representative?.ocid).toBe('b')
    expect(model.representative?.name).toBe('나')
  })

  it('미지정이면 목록의 첫 번째가 선다. **대표 없음** 상태가 없다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b'],
        representativeOcid: null,
        profilesByOcid: { a: profile({ name: '가' }), b: profile({ name: '나' }) },
      }),
    )

    expect(model.representative?.ocid).toBe('a')
  })

  it('목록이 비면 null 이다', () => {
    expect(buildTodayViewModel(input()).representative).toBeNull()
  })

  // 이름 없이 카드를 그릴 수 없다. ocid 는 사용자에게 뜻이 없는 값이라 대신 넣지 않는다.
  it('캐시에 프로필이 없으면 null 이다', () => {
    const model = buildTodayViewModel(input({ orderedOcids: ['a'], profilesByOcid: {} }))
    expect(model.representative).toBeNull()
  })

  it('옛 캐시에 없는 필드(직업·경험치·길드)는 그대로 비운다', () => {
    const model = buildTodayViewModel(
      input({ orderedOcids: ['a'], profilesByOcid: { a: profile() } }),
    )

    expect(model.representative?.jobClass).toBeUndefined()
    expect(model.representative?.expRate).toBeUndefined()
    expect(model.representative?.guildName).toBeUndefined()
  })
})

describe('주간 보스 수익', () => {
  it('결정석과 아이템 판매가를 함께 더한다', () => {
    const drops = { [`a|lotus|normal|${WEEK_KEY}`]: [{ category: 'equipment' as const, itemKey: null, itemName: '반지', quantity: 1, priceState: 'entered' as const, priceMeso: 60, priceShare: 2 }] }
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        profitRows: [profitRow({ payoutMeso: 100 })],
        profitDropsByRowKey: drops,
      }),
    )

    expect(model.profit.totalMeso).toBe(130)
    expect(model.profit.hasRecords).toBe(true)
  })

  it('기록이 하나도 없으면 0 이고 **미기록** 을 함께 말한다', () => {
    const model = buildTodayViewModel(input())

    expect(model.profit.totalMeso).toBe(0)
    expect(model.profit.hasRecords).toBe(false)
  })

  it('보던 기간이 이번 주가 아니면 그 행은 세지 않는다', () => {
    const model = buildTodayViewModel(
      input({ orderedOcids: ['a'], profitRows: [profitRow({ periodKey: '2026-08-06' })] }),
    )

    expect(model.profit.totalMeso).toBe(0)
    expect(model.profit.hasRecords).toBe(false)
  })

  it('캐릭터별 상위 셋을 금액 내림차순으로 담는다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b', 'c', 'd'],
        profitRows: [
          profitRow({ ocid: 'a', characterName: '가', payoutMeso: 10 }),
          profitRow({ ocid: 'b', characterName: '나', payoutMeso: 40 }),
          profitRow({ ocid: 'c', characterName: '다', payoutMeso: 30 }),
          profitRow({ ocid: 'd', characterName: '라', payoutMeso: 20 }),
        ],
      }),
    )

    expect(model.profit.topCharacters.map((entry) => entry.ocid)).toEqual(['b', 'c', 'd'])
    expect(model.profit.topCharacters[0].totalMeso).toBe(40)
    expect(model.profit.totalMeso).toBe(100)
  })

  // 위젯 3의 스택 바가 읽는 값이다. 위젯은 스토어를 모르므로 총액만 주면 갈라 그릴 수 없다.
  it('총액을 결정석과 아이템으로 가르고, 둘의 합이 총액이다', () => {
    const drops = {
      [`a|lotus|normal|${WEEK_KEY}`]: [
        { category: 'equipment' as const, itemKey: null, itemName: '반지', quantity: 1, priceState: 'entered' as const, priceMeso: 60, priceShare: 2 },
      ],
    }
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        profitRows: [profitRow({ payoutMeso: 100 })],
        profitDropsByRowKey: drops,
      }),
    )

    expect(model.profit.crystalMeso).toBe(100)
    expect(model.profit.itemMeso).toBe(30)
    expect(model.profit.crystalMeso + model.profit.itemMeso).toBe(model.profit.totalMeso)
    expect(model.profit.topCharacters[0].crystalMeso).toBe(100)
    expect(model.profit.topCharacters[0].itemMeso).toBe(30)
  })
})

describe('최고가 아이템', () => {
  it('기록된 판매가 순위이고 최대 다섯이다', () => {
    const priced = (itemName: string, priceMeso: number): DropHistoryRecord =>
      dropRecord({ itemName, priceState: 'entered', priceMeso })
    const model = buildTodayViewModel(
      input({
        dropGroups: [
          dropGroup([
            priced('1위', 900),
            priced('3위', 700),
            priced('2위', 800),
            priced('4위', 600),
            priced('5위', 500),
            priced('6위', 400),
          ]),
        ],
      }),
    )

    expect(model.topItem?.top.itemName).toBe('1위')
    expect(model.topItem?.rest.map((entry) => entry.itemName)).toEqual(['2위', '3위', '4위', '5위'])
  })

  // today 가 답하는 질문은 **내가 얼마를 벌었나** 다. 총액으로 그리면 같은 화면의 `주간 보스 수익`
  // (`sumDropPayout` = 분배 후 합)보다 최고가가 큰 화면이 나온다.
  it('분배된 금액을 그린다. 입력한 총액이 아니다', () => {
    const model = buildTodayViewModel(
      input({
        dropGroups: [
          dropGroup([
            dropRecord({ itemName: '나눈 것', priceState: 'entered', priceMeso: 900, priceShare: 3 }),
          ]),
        ],
      }),
    )

    expect(model.topItem?.top.payoutMeso).toBe(300)
    expect(model.topItem?.top.shareCount).toBe(3)
  })

  it('순위도 분배 후 기준이다. 표시와 순위가 갈리면 1위가 더 작은 숫자를 단다', () => {
    const model = buildTodayViewModel(
      input({
        dropGroups: [
          dropGroup([
            // 총액은 이쪽이 크지만(1000 > 600) 6인이라 실수령은 167 이다.
            dropRecord({ itemName: '총액 1위', priceState: 'entered', priceMeso: 1000, priceShare: 6 }),
            dropRecord({ itemName: '실수령 1위', priceState: 'entered', priceMeso: 600, priceShare: 1 }),
          ]),
        ],
      }),
    )

    expect(model.topItem?.top.itemName).toBe('실수령 1위')
    expect(model.topItem?.top.payoutMeso).toBe(600)
  })

  it('분배 인원이 없으면 단독이다. 나눈 적 없는 기록을 나누지 않는다', () => {
    const model = buildTodayViewModel(
      input({
        dropGroups: [
          dropGroup([dropRecord({ itemName: '단독', priceState: 'entered', priceMeso: 500 })]),
        ],
      }),
    )

    expect(model.topItem?.top.payoutMeso).toBe(500)
    expect(model.topItem?.top.shareCount).toBe(1)
  })

  // 값을 모르는 것을 **가장 싼 것** 으로 단정하지 않는다.
  it('가격 미입력 기록은 순위에 들지 않는다', () => {
    const model = buildTodayViewModel(
      input({
        dropGroups: [
          dropGroup([
            dropRecord({ itemName: '미입력' }),
            dropRecord({ itemName: '입력함', priceState: 'entered', priceMeso: 10 }),
          ]),
        ],
      }),
    )

    expect(model.topItem?.top.itemName).toBe('입력함')
    expect(model.topItem?.rest).toEqual([])
  })

  it('전부 미입력이면 최고가가 없고 미입력 건수가 남는다', () => {
    const model = buildTodayViewModel(
      input({ dropGroups: [dropGroup([dropRecord({ itemName: 'a' }), dropRecord({ itemName: 'b' })])] }),
    )

    expect(model.topItem).toBeNull()
    expect(model.unpricedCount).toBe(2)
  })

  // 'excluded' 는 **값을 매기지 않기로 한** 사용자의 결정이라 기다리는 건이 아니다.
  it('기록 안함(excluded)은 미입력으로 세지 않는다', () => {
    const model = buildTodayViewModel(
      input({ dropGroups: [dropGroup([dropRecord({ itemName: 'a', priceState: 'excluded' })])] }),
    )

    expect(model.unpricedCount).toBe(0)
  })

  it('지난 주 기록은 이번 주 순위·미입력 건수에 들지 않는다', () => {
    const model = buildTodayViewModel(
      input({
        dropGroups: [
          dropGroup(
            [dropRecord({ periodKey: '2026-08-06', itemName: '지난주', priceState: 'entered', priceMeso: 9999 })],
            '2026-08-06',
          ),
        ],
      }),
    )

    expect(model.topItem).toBeNull()
    expect(model.unpricedCount).toBe(0)
  })

  // 위젯 4가 **캐릭터· 보스** 를 그린다. ocid 는 사용자에게 뜻이 없는 값이라 대신 넣지 않는다.
  it('캐릭터 이름은 프로필 캐시에 있을 때만 싣는다', () => {
    const 기록 = dropRecord({ itemName: '반지', priceState: 'entered', priceMeso: 10 })
    const 있음 = buildTodayViewModel(
      input({ profilesByOcid: { a: profile() }, dropGroups: [dropGroup([기록])] }),
    )
    const 없음 = buildTodayViewModel(input({ dropGroups: [dropGroup([기록])] }))

    expect(있음.topItem?.top.characterName).toBe('단풍루틴')
    expect(없음.topItem?.top.characterName).toBeUndefined()
  })

  // 아이콘 조회(`dropItemIconOf(itemKey)`)가 쓴다. 빠지면 에러가 아니라 조용한 폴백 원이 된다.
  // 이름은 key 로 찾은 표의 지금 이름이라, 적을 때의 이름이 달라도 표를 따른다.
  it('아이콘 조회에 필요한 `itemKey` 를 나르고 이름은 표에서 찾는다', () => {
    const model = buildTodayViewModel(
      input({
        dropGroups: [
          dropGroup([
            dropRecord({ itemKey: 'guardian_angel_ring', itemName: '옛 이름', priceState: 'entered', priceMeso: 10 }),
          ]),
        ],
      }),
    )

    expect(model.topItem?.top).toMatchObject({ itemKey: 'guardian_angel_ring', itemName: '가디언 엔젤 링' })
  })

  // 이관이 이름을 못 찾은 옛 기록. 지우지 않고 적어 둔 이름으로 싣고, 그림은 폴백이다.
  it('key 가 없는 옛 기록은 적어 둔 이름을 그대로 싣는다', () => {
    const model = buildTodayViewModel(
      input({
        dropGroups: [
          dropGroup([dropRecord({ itemKey: null, itemName: '익셉셔널 해머', priceState: 'entered', priceMeso: 10 })]),
        ],
      }),
    )

    expect(model.topItem?.top).toMatchObject({ itemKey: null, itemName: '익셉셔널 해머' })
  })
})

describe('주간 결정석 판매 한도', () => {
  it('월드별로 갈리고 분모는 WEEKLY_CRYSTAL_SALE_LIMIT 이다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b'],
        profitRows: [
          profitRow({ ocid: 'a', world: '스카니아', worldKey: 'scania', bossKey: 'lotus', bossName: '스우', isComplete: true }),
          profitRow({ ocid: 'a', world: '스카니아', worldKey: 'scania', bossKey: 'damien', bossName: '데미안', isComplete: true }),
          profitRow({ ocid: 'b', world: '루나', worldKey: 'luna', bossKey: 'lotus', bossName: '스우', isComplete: true }),
          profitRow({ ocid: 'b', world: '루나', worldKey: 'luna', bossKey: 'lucid', bossName: '루시드', isComplete: false }),
        ],
      }),
    )

    expect(model.crystalLimits).toEqual([
      { worldKey: 'scania', world: '스카니아', cleared: 2, limit: WEEKLY_CRYSTAL_SALE_LIMIT },
      { worldKey: 'luna', world: '루나', cleared: 1, limit: WEEKLY_CRYSTAL_SALE_LIMIT },
    ])
  })

  // 한도는 월드 key 로 센다. 행에 적힌 이름의 띄어쓰기가 달라도 한 월드이고 적는 글자는 표 이름이다.
  it('월드 key 로 묶고 표 이름을 적는다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b'],
        profitRows: [
          profitRow({ ocid: 'a', world: '챌린저스 2', worldKey: 'challengers_2', bossKey: 'lotus', bossName: '스우', isComplete: true }),
          profitRow({ ocid: 'b', world: '챌린저스2', worldKey: 'challengers_2', bossKey: 'lucid', bossName: '루시드', isComplete: true }),
        ],
      }),
    )

    expect(model.crystalLimits).toEqual([
      { worldKey: 'challengers_2', world: '챌린저스2', cleared: 2, limit: WEEKLY_CRYSTAL_SALE_LIMIT },
    ])
  })
})

describe('아이템 드롭 가뭄', () => {
  it('단계와 풀 크기를 함께 실어 화면이 인덱스만 고르게 한다', () => {
    const model = buildTodayViewModel(
      input({
        drought: { periodKey: WEEK_KEY, cycle: 'weekly', weeksSince: 0, records: [dropRecord({ itemName: '칠흑의 보스 반지 상자' })] },
      }),
    )

    expect(model.drought?.weeksSince).toBe(0)
    expect(model.drought?.tier).toBe(0)
    expect(model.drought?.headlineCount).toBeGreaterThan(1)
    expect(model.drought?.itemsLabel).toBe('칠흑의 보스 반지 상자')
  })

  it('고가 기록이 한 번도 없으면 null 이다', () => {
    expect(buildTodayViewModel(input()).drought).toBeNull()
  })
})

describe('초기화 카운트다운', () => {
  // now 를 고정하면 전부 결정적이다. 이 파일이 `new Date` 를 부르지 않는 이유.
  it('일간·주간·월간 초기화까지 남은 시간을 KST 기준으로 센다', () => {
    const model = buildTodayViewModel(input())

    // 2026-08-18 00:00 KST
    expect(model.resets.daily.remainingMs).toBe(12 * HOUR_MS)
    // 2026-08-20(목) 00:00 KST
    expect(model.resets.weekly.remainingMs).toBe(60 * HOUR_MS)
    // 2026-09-01 00:00 KST
    expect(model.resets.monthly.remainingMs).toBe(348 * HOUR_MS)
  })

  it('다음 초기화 시각도 함께 준다. 화면이 1초마다 다시 세도 기준이 흔들리지 않는다', () => {
    const model = buildTodayViewModel(input())

    expect(new Date(model.resets.daily.atMs).toISOString()).toBe('2026-08-17T15:00:00.000Z')
    expect(new Date(model.resets.weekly.atMs).toISOString()).toBe('2026-08-19T15:00:00.000Z')
    expect(new Date(model.resets.monthly.atMs).toISOString()).toBe('2026-08-31T15:00:00.000Z')
  })
})

//
// 공유 컨텐츠 (~31)
//

const MONSTER_PARK = 'monster_park'
const EXTREME = 'monster_park_extreme'
const EPIC_HIGH = 'epic_dungeon_high_mountain'
const EPIC_ANGLER = 'epic_dungeon_angler_company'
const EPIC_NIGHTMARE = 'epic_dungeon_nightmare_paradise'
const UNION_WEEKLY = 'maple_union_weekly_dragon'
const UNION_PC = 'maple_union_pc_cafe_weekly_dragon'
const EPIC_AURUM = 'epic_dungeon_aurum_regis'

/** 아우룸 레기스가 서는 첫 주(2026-09-17 목) 안의 시각. 줄 넷을 모두 재는 케이스가 쓴다. */
const PATCH_WEEK_NOW = new Date('2026-09-18T03:00:00.000Z')
/** 그 전 주(2026-09-10 목) 안의 시각. */
const PRE_PATCH_WEEK_NOW = new Date('2026-09-16T03:00:00.000Z')

/** 카탈로그의 일곱을 전부 등록해 둔 캐릭터. 값만 덮어 쓰며 쓴다. */
function sharedView(ocid: string, overrides: Partial<ContentCharacterView> = {}): ContentCharacterView {
  return contentView(ocid, {
    dailyContents: [daily({ ...content(MONSTER_PARK), kind: 'contents', maxCount: 14, questState: null })],
    weeklyContents: [
      weekly({ ...content(EPIC_HIGH), kind: 'contents', maxCount: 0, questState: null }),
      weekly({ ...content(EPIC_ANGLER), kind: 'contents', maxCount: 0, questState: null }),
      weekly({ ...content(EPIC_NIGHTMARE), kind: 'contents', maxCount: 0, questState: null }),
      weekly({ ...content(UNION_WEEKLY) }),
      weekly({ ...content(UNION_PC) }),
      weekly({ ...content(EXTREME), maxCount: 2 }),
    ],
    ...overrides,
  })
}

function sharedRows(model: ReturnType<typeof buildTodayViewModel>) {
  return model.sharedContents.map((group) => [
    group.label,
    group.items.map((item) => [item.shortName, item.count, item.isComplete] as const),
  ])
}

describe('공유 컨텐츠. 계열로 묶는다', () => {
  it('계열 셋을 카탈로그 순서로 낸다. 월드/계정은 그리지 않는다', () => {
    const model = buildTodayViewModel(
      input({ orderedOcids: ['a'], contentCharacters: [sharedView('a')] }),
    )

    expect(model.sharedContents.map((group) => group.label)).toEqual([
      '몬스터파크',
      '메이플 유니온',
      '에픽 던전',
    ])
  })

  it('짧은 이름을 쓴다. 계열명은 위에 있으므로 항목에서 뺀다', () => {
    const model = buildTodayViewModel(
      input({ now: PATCH_WEEK_NOW, orderedOcids: ['a'], contentCharacters: [sharedView('a')] }),
    )

    const epic = model.sharedContents.find((group) => group.category === 'epic_dungeon')

    expect(epic?.items.map((item) => item.shortName)).toEqual([
      '하이마운틴',
      '앵글러컴퍼니',
      '악몽선경',
      '아우룸레기스',
    ])
  })

  it('캐릭터가 넷이어도 항목은 한 줄씩이다. 이 분리의 이유가 그 중복이다', () => {
    const model = buildTodayViewModel(
      input({
        now: PATCH_WEEK_NOW,
        orderedOcids: ['a', 'b', 'c', 'd'],
        contentCharacters: ['a', 'b', 'c', 'd'].map((ocid) => sharedView(ocid)),
      }),
    )

    expect(model.sharedContents.flatMap((group) => group.items)).toHaveLength(8)
  })

  it('`남은 스케줄`에서는 여덟이 빠진다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            dailyContents: [
              daily({ ...content(MONSTER_PARK), kind: 'contents', maxCount: 14, questState: null }),
              daily(content('daily_quest_road_of_vanishing')),
            ],
          }),
        ],
      }),
    )

    // 캐릭터 줄에는 개인 일퀘 하나만 남는다. 몬스터파크는 공유 위젯의 몫이다.
    expect(model.schedule[0]?.dailyNames).toEqual(['소멸의 여로'])
    expect(model.schedule[0]?.weeklyNames).toEqual([])
  })
})

describe('공유 컨텐츠. 오른쪽 열은 `maxCount > 0` 하나로 갈린다', () => {
  it('몬스터파크는 7/14. 월드 총합을 그대로 그린다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            dailyContents: [
              daily({ ...content(MONSTER_PARK), kind: 'contents', nowCount: 7, maxCount: 14, questState: null }),
            ],
          }),
        ],
      }),
    )
    const park = model.sharedContents.find((group) => group.category === 'monster_park')

    expect(park?.items[0]).toMatchObject({
      shortName: '일간',
      count: { now: 7, max: 14 },
      isComplete: false,
    })
  })

  it('에픽 던전은 maxCount 가 0이라 카운트를 안 그린다. 참여 여부만 안다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            weeklyContents: [
              weekly({ ...content(EPIC_HIGH), kind: 'contents', nowCount: 1, maxCount: 0, questState: null }),
              weekly({ ...content(EPIC_ANGLER), kind: 'contents', maxCount: 0, questState: null }),
            ],
          }),
        ],
      }),
    )
    const epic = model.sharedContents.find((group) => group.category === 'epic_dungeon')

    expect(epic?.items[0]).toMatchObject({ shortName: '하이마운틴', count: null, isComplete: true })
    expect(epic?.items[1]).toMatchObject({ shortName: '앵글러컴퍼니', count: null, isComplete: false })
  })

  it('완료하면 카운트를 안 준다. 화면이 CLEAR 를 그린다', () => {
    // 완료한 항목의 **몇 번 했나** 는 언제나 max 라 카운트를 줄 이유가 없다. 익스트림 몬스터파커의
    // `now_count` 는 이번 주 일간 몬스터파크 횟수로 진짜지만, 그 사실이 이 규칙을 바꾸지 않는다.
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            weeklyContents: [weekly({ ...content(EXTREME), nowCount: 0, maxCount: 5, questState: 2 })],
          }),
        ],
      }),
    )
    const park = model.sharedContents.find((group) => group.category === 'monster_park')
    const extreme = park?.items.find((item) => item.shortName === '익스트림 몬스터파커')

    expect(extreme).toMatchObject({ count: null, isComplete: true })
  })

  it('카운트형도 다 채우면 카운트를 안 준다. `익스트림만 예외`는 이름으로 유추하는 규칙이 된다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            dailyContents: [
              daily({ ...content(MONSTER_PARK), kind: 'contents', nowCount: 14, maxCount: 14, questState: null }),
            ],
          }),
        ],
      }),
    )
    const park = model.sharedContents.find((group) => group.category === 'monster_park')

    expect(park?.items[0]).toMatchObject({ shortName: '일간', count: null, isComplete: true })
  })

  it('카운트가 최대를 넘어도 분모를 넘지 않는다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            weeklyContents: [weekly({ ...content(EXTREME), nowCount: 7, maxCount: 5, questState: 0 })],
          }),
        ],
      }),
    )
    const extreme = model.sharedContents
      .flatMap((group) => group.items)
      .find((item) => item.shortName === '익스트림 몬스터파커')

    expect(extreme?.count).toEqual({ now: 5, max: 5 })
  })

  it('진행은 공유라 캐릭터마다 갈리면 가장 앞선 값을 쓴다. 늦게 동기화된 캐릭터가 값을 되돌리지 않는다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b'],
        contentCharacters: [
          sharedView('a', {
            dailyContents: [
              daily({ ...content(MONSTER_PARK), kind: 'contents', nowCount: 2, maxCount: 14, questState: null }),
            ],
          }),
          sharedView('b', {
            dailyContents: [
              daily({ ...content(MONSTER_PARK), kind: 'contents', nowCount: 9, maxCount: 14, questState: null }),
            ],
          }),
        ],
      }),
    )
    const park = model.sharedContents.find((group) => group.category === 'monster_park')

    expect(park?.items[0]?.count).toEqual({ now: 9, max: 14 })
  })

})

// 줄을 응답이 아니라 카탈로그에서 만들기 때문에, 게임에 아직 없는 컨텐츠도 카탈로그에 있으면 선다.
// 카탈로그 줄의 시작 기간을 **지금 주간 기간**으로 거른다.
describe('공유 컨텐츠. 시작 기간 전인 줄은 안 그린다', () => {
  const epicNames = (now: Date): string[] =>
    buildTodayViewModel(input({ now, orderedOcids: ['a'], contentCharacters: [sharedView('a')] }))
      .sharedContents.find((group) => group.category === 'epic_dungeon')
      ?.items.map((item) => item.shortName) ?? []

  it('2026-09-10 주에는 아우룸 레기스 줄이 없다', () => {
    expect(epicNames(PRE_PATCH_WEEK_NOW)).toEqual(['하이마운틴', '앵글러컴퍼니', '악몽선경'])
  })

  it('2026-09-17 주부터 선다. 등록 여부와 무관하게 늘 그리는 규칙은 그대로다', () => {
    expect(epicNames(PATCH_WEEK_NOW)).toEqual(['하이마운틴', '앵글러컴퍼니', '악몽선경', '아우룸레기스'])
  })

  // 응답에 값이 와도 기간이 이긴다. 이 위젯은 지금 할 수 있는 일을 말하는 자리다.
  it('기간 전이면 응답에 값이 있어도 안 그린다', () => {
    const model = buildTodayViewModel(
      input({
        now: PRE_PATCH_WEEK_NOW,
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            weeklyContents: [weekly({ ...content(EPIC_AURUM), kind: 'contents', nowCount: 1, questState: null })],
          }),
        ],
      }),
    )

    expect(model.sharedContents.flatMap((group) => group.items).map((item) => item.contentKey)).not.toContain(
      EPIC_AURUM,
    )
  })
})

// 에픽 던전은 4종이지만 주 3회가 한도다. 계열 제목에 n/3 이 서고, 한도가 차면 네 줄 모두 취소선을 긋는다.
// 체크는 실제로 진행한 줄만 채운다.
describe('공유 컨텐츠. 에픽 던전 주간 한도', () => {
  const epicView = (nowCounts: [number, number, number, number], maxCount = 0) =>
    sharedView('a', {
      weeklyContents: [EPIC_HIGH, EPIC_ANGLER, EPIC_NIGHTMARE, EPIC_AURUM].map((key, index) =>
        weekly({ ...content(key), kind: 'contents', nowCount: nowCounts[index], maxCount, questState: null }),
      ),
    })
  const epicOf = (view: ContentCharacterView) =>
    buildTodayViewModel(input({ now: PATCH_WEEK_NOW, orderedOcids: ['a'], contentCharacters: [view] }))
      .sharedContents.find((group) => group.category === 'epic_dungeon')

  it('계열 제목의 수는 완료한 에픽 던전 수와 한도 3 이다', () => {
    expect(epicOf(epicView([1, 1, 0, 0]))?.weeklyLimit).toEqual({ now: 2, max: 3 })
  })

  it('한도가 없는 계열은 수가 없다', () => {
    const model = buildTodayViewModel(
      input({ now: PATCH_WEEK_NOW, orderedOcids: ['a'], contentCharacters: [sharedView('a')] }),
    )

    expect(model.sharedContents.find((group) => group.category === 'monster_park')?.weeklyLimit).toBeNull()
  })

  it('3종을 완료하면 남은 1줄이 막힌다. 체크는 완료한 3줄만이다', () => {
    const epic = epicOf(epicView([1, 1, 0, 1]))

    expect(epic?.weeklyLimit).toEqual({ now: 3, max: 3 })
    expect(epic?.items.map((item) => [item.shortName, item.isComplete, item.isWeeklyLimitClosed])).toEqual([
      ['하이마운틴', true, false],
      ['앵글러컴퍼니', true, false],
      ['악몽선경', false, true],
      ['아우룸레기스', true, false],
    ])
  })

  // 더 진행할 수 없는 줄의 진행 칸이다. 응답의 max_count 가 0 이 아니어도 안 그린다.
  it('막힌 줄은 카운트를 안 그린다', () => {
    const epic = epicOf(epicView([1, 1, 0, 1], 5))

    expect(epic?.items.find((item) => item.shortName === '악몽선경')?.count).toBeNull()
  })

  it('2종이면 아무 줄도 안 막힌다', () => {
    const epic = epicOf(epicView([1, 1, 0, 0]))

    expect(epic?.items.some((item) => item.isWeeklyLimitClosed)).toBe(false)
  })

  // 한도는 갈래로 센다. 표에 없는 컨텐츠는 갈래가 없어 이름이 에픽 던전처럼 보여도 세지 않는다.
  it('표에 없는 컨텐츠는 완료해도 한도에 안 든다', () => {
    const view = epicView([1, 1, 0, 0])
    const epic = epicOf({
      ...view,
      weeklyContents: [
        ...view.weeklyContents,
        weekly({ contentKey: null, apiName: '에픽 던전 : 새 던전', kind: 'contents', nowCount: 1, questState: null }),
      ],
    })

    expect(epic?.weeklyLimit).toEqual({ now: 2, max: 3 })
    expect(epic?.items).toHaveLength(4)
  })
})

describe('공유 컨텐츠. 유니온만 조건부다', () => {
  it('아무 캐릭터의 스케줄러에도 없으면 유니온 계열이 통째로 빠진다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            weeklyContents: [
              weekly({ ...content(EPIC_HIGH), kind: 'contents', maxCount: 0, questState: null }),
              weekly({ ...content(EXTREME), maxCount: 2 }),
            ],
          }),
        ],
      }),
    )

    expect(model.sharedContents.map((group) => group.category)).toEqual(['monster_park', 'epic_dungeon'])
  })

  it('둘 중 하나만 있으면 그 한 줄만 남는다. 계열이 아니라 항목 단위다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            weeklyContents: [weekly({ ...content(UNION_PC) })],
          }),
        ],
      }),
    )
    const union = model.sharedContents.find((group) => group.category === 'maple_union')

    expect(union?.items.map((item) => item.shortName)).toEqual(['PC방 주간 드래곤 퇴치'])
  })

  it('에픽 던전·몬스터파크는 아무도 등록 안 해도 그린다', () => {
    const model = buildTodayViewModel(
      input({ now: PATCH_WEEK_NOW, orderedOcids: ['a'], contentCharacters: [contentView('a')] }),
    )

    expect(sharedRows(model)).toEqual([
      ['몬스터파크', [['일간', null, false], ['익스트림 몬스터파커', null, false]]],
      [
        '에픽 던전',
        [
          ['하이마운틴', null, false],
          ['앵글러컴퍼니', null, false],
          ['악몽선경', null, false],
          ['아우룸레기스', null, false],
        ],
      ],
    ])
  })

  it('캐릭터가 하나도 없어도 여섯 줄이 선다. 위젯은 사라지지 않는다', () => {
    const model = buildTodayViewModel(input({ now: PATCH_WEEK_NOW }))

    expect(model.sharedContents.flatMap((group) => group.items)).toHaveLength(6)
  })

  it('수동 모드에서는 추적 목록 멤버십이 **스케줄러에 있는가** 다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        trackingMode: 'manual',
        manualContentByOcid: { a: [{ contentKey: UNION_PC, kind: 'weekly' }] },
        contentCharacters: [sharedView('a')],
      }),
    )
    const union = model.sharedContents.find((group) => group.category === 'maple_union')

    expect(union?.items.map((item) => item.shortName)).toEqual(['PC방 주간 드래곤 퇴치'])
  })
})

// 요구 레벨에 못 미치는 항목은 **남은 것** 이 아니다. 게임이 등록을 허용해도
// 이 캐릭터로는 못 하므로, 세면 그 숫자가 **영원히 안 줄어든다.** 스케줄러 카드·진행률·링과 같은
// 판정 함수를 봐야(**한 글자도 다르면 안 된다**)이 성립한다.
//
// 항목을 **캐릭터 단위**로 고른 것이 요점이다. 몬스터파크(요구 레벨 105)는 월드 공유라 이 목록에
// 애초에 안 든다. 공유 항목으로 재면 레벨과 무관하게 빠져 테스트가 거짓으로
// 통과한다.
describe('요구 레벨 미달은 남은 개수에서 빠진다', () => {
  const 항목 = [
    daily(content('daily_quest_road_of_vanishing')), // 요구 레벨 200
    daily(content('daily_quest_chew_chew')), // 요구 레벨 210
  ]

  const 남은것 = (level?: number): readonly string[] =>
    buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [contentView('a', { level, dailyContents: 항목 })],
      }),
    ).schedule[0]?.dailyNames ?? []

  it('레벨이 되면 둘 다 센다', () => {
    expect(남은것(300)).toHaveLength(2)
  })

  it('레벨이 미달인 항목만 빠진다', () => {
    expect(남은것(205)).toHaveLength(1)
  })

  it('둘 다 미달이면 둘 다 빠진다', () => {
    expect(남은것(199)).toHaveLength(0)
  })

  // 레벨을 모르면 단정하지 않는다. 전부 센다(태도).
  it('레벨을 모르면 아무것도 안 뺀다', () => {
    expect(남은것()).toHaveLength(2)
  })
})
