// today 뷰모델의 **조립 규칙**([[ADR-147]] 결정 4·8·9). 위젯이 스토어를 모르므로 화면이 값을 한
// 번 모으는데, 그 조립을 순수 함수로 두면 **위젯이 한 줄도 없는 지금 로직 전부를 검증할 수 있다.**
//
// 여기서 지키는 것의 대부분은 «다시 구현하지 않았는가» 다 — 남은 개수는 `content-completion` ·
// `displayedBosses` 가, 수익은 `groupTotalMeso` 가, 한도 분모는 `WEEKLY_CRYSTAL_SALE_LIMIT` 가
// 판정한다. 판정이 두 벌이 되면 today 와 원래 화면이 **다른 수를 말한다.**

import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../../lib/boss-matching'
import type { MatchedBoss } from '../../../lib/boss-matching'
import type { DropHistoryPeriodGroup, DropHistoryRecord } from '../../../lib/drop-history'
import type { BossProfitRow } from '../../../features/boss-profit/store'
import type { ContentCharacterView } from '../../../features/content-scheduler/store'
import type { BossCharacterView } from '../../../features/boss-scheduler/store'
import type { CharacterBasicProfile, DailyContent, WeeklyContent } from '../../../types'

import { buildTodayViewModel, type TodayViewModelInput } from '../view-model'

// 2026-08-17(월) 12:00 KST. 이 시점의 주간 기간 키는 직전 목요일인 2026-08-13 이다.
const NOW = new Date('2026-08-17T03:00:00.000Z')
const WEEK_KEY = '2026-08-13'
const HOUR_MS = 60 * 60 * 1000

function daily(overrides: Partial<DailyContent> = {}): DailyContent {
  return {
    name: '일일 퀘스트',
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
    name: '[주간 퀘스트] 크리티아스',
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
    apiName: '스우',
    difficulty: '노멀',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    ownComplete: false,
    matchedBossName: '스우',
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
    boss: '스우',
    difficulty: '노멀',
    cycle: 'weekly',
    periodKey: WEEK_KEY,
    periodLabel: '이번 주',
    priceMeso: 100,
    maxPartySize: 6,
    partySize: 1,
    payoutMeso: 100,
    isComplete: true,
    ...overrides,
  }
}

function dropRecord(overrides: Partial<DropHistoryRecord> = {}): DropHistoryRecord {
  return {
    ocid: 'a',
    boss: '스우',
    difficulty: '노멀',
    periodKey: WEEK_KEY,
    category: 'equipment',
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

describe('남은 스케줄 — 분류 넷 ([[ADR-147]] 정정 3)', () => {
  it('일퀘·주간퀘는 content-completion 의 미완료 수다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          contentView('a', {
            dailyContents: [daily({ name: 'd1', questState: 2 }), daily({ name: 'd2' }), daily({ name: 'd3' })],
            weeklyContents: [weekly({ name: '[주간 퀘스트] 크리티아스', questState: 2 }), weekly({ name: '에르다 스펙트럼', kind: 'contents', nowCount: 0, maxCount: 1 })],
          }),
        ],
      }),
    )

    expect(model.schedule[0].dailyNames).toHaveLength(2)
    expect(model.schedule[0].weeklyNames).toHaveLength(1)
  })

  // 무릉도장은 «다 했다» 가 정의되지 않는다 — 세면 링도 위젯도 영원히 안 찬다.
  it('끝이 없는 항목(무릉도장)은 남은 개수에 들지 않는다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          contentView('a', {
            weeklyContents: [weekly({ name: '[주간 퀘스트] 무릉도장', nowCount: 0, maxCount: 0 })],
          }),
        ],
      }),
    )

    expect(model.schedule[0].weeklyNames).toHaveLength(0)
    expect(model.scheduleTotal).toBe(0)
  })

  it('주간 보스·검마는 displayedBosses 의 미완료 수다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        bossCharacters: [
          bossView('a', {
            weeklyBosses: [
              boss({ apiName: '스우', isComplete: true }),
              boss({ apiName: '데미안' }),
              boss({ apiName: '루시드' }),
            ],
            monthlyBosses: [boss({ apiName: '검은 마법사', cycle: 'monthly' })],
          }),
        ],
      }),
    )

    expect(model.schedule[0].weeklyBosses).toHaveLength(2)
    expect(model.schedule[0].monthlyBosses).toHaveLength(1)
    expect(model.schedule[0].remainingTotal).toBe(3)
  })

  // [[ADR-031]] 결정 5 — 미등록이어도 완료했으면 목록에 든다(그리고 완료라 남은 수엔 안 든다).
  // 판정을 여기서 다시 쓰면 이 규칙이 today 에서만 빠진다.
  it('등록되지 않았지만 완료한 보스는 displayedBosses 규칙대로 다뤄진다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        bossCharacters: [
          bossView('a', {
            weeklyBosses: [
              boss({ apiName: '스우', difficulty: '하드', isRegistered: false, isComplete: true }),
              boss({ apiName: '스우', difficulty: '노멀', isRegistered: false, isComplete: false }),
            ],
          }),
        ],
      }),
    )

    expect(model.schedule[0].weeklyBosses).toHaveLength(0)
  })

  it('선택된 캐릭터를 전부 담는다 — 「외 N명」 접기가 없다', () => {
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

describe('남은 스케줄 — 정렬 ([[ADR-147]] 정정 12)', () => {
  function withRemaining(ocid: string, remaining: number): ContentCharacterView {
    return contentView(ocid, {
      dailyContents: Array.from({ length: remaining }, (_, index) => daily({ name: `${ocid}-${index}` })),
    })
  }

  it('남은 개수 많은 순이다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b', 'c'],
        contentCharacters: [withRemaining('a', 1), withRemaining('b', 5), withRemaining('c', 3)],
      }),
    )

    expect(model.schedule.map((row) => row.ocid)).toEqual(['b', 'c', 'a'])
  })

  it('동수면 캐릭터 관리 순서다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['c', 'a', 'b'],
        // 스토어 순서(레벨 내림차순)와 관리 순서가 다르다 — 관리 순서가 이긴다.
        contentCharacters: [withRemaining('a', 2), withRemaining('b', 2), withRemaining('c', 2)],
      }),
    )

    expect(model.schedule.map((row) => row.ocid)).toEqual(['c', 'a', 'b'])
  })

  // 남은 개수를 «모르는» 것이라, 위로 올리면 «제일 밀린 캐릭터» 자리를 모르는 값이 차지한다.
  it('동기화 실패 캐릭터는 남은 개수가 많아도 맨 아래다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b'],
        contentCharacters: [withRemaining('a', 9), withRemaining('b', 1)],
        characterIssues: { a: 'failed' },
      }),
    )

    expect(model.schedule.map((row) => row.ocid)).toEqual(['b', 'a'])
    expect(model.schedule[1].hasSyncIssue).toBe(true)
  })

  it('실패 캐릭터의 남은 개수는 합계에 넣지 않는다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b'],
        contentCharacters: [withRemaining('a', 9), withRemaining('b', 1)],
        characterIssues: { a: 'unavailable' },
      }),
    )

    expect(model.scheduleTotal).toBe(1)
  })
})

describe('대표 캐릭터 ([[ADR-147]] 정정 2)', () => {
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

  it('미지정이면 목록의 첫 번째가 선다 — «대표 없음» 상태가 없다', () => {
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

  // 이름 없이 카드를 그릴 수 없다 — ocid 는 사용자에게 뜻이 없는 값이라 대신 넣지 않는다.
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

describe('주간 보스 수익 ([[ADR-147]] 정정 4)', () => {
  it('결정석과 아이템 판매가를 함께 더한다', () => {
    const drops = { [`a|스우|노멀|${WEEK_KEY}`]: [{ category: 'equipment' as const, itemName: '반지', quantity: 1, priceState: 'entered' as const, priceMeso: 60, priceShare: 2 }] }
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

  it('기록이 하나도 없으면 0 이고 «미기록» 을 함께 말한다', () => {
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

  // 위젯 3의 스택 바가 읽는 값이다 — 위젯은 스토어를 모르므로 총액만 주면 갈라 그릴 수 없다.
  it('총액을 결정석과 아이템으로 가르고, 둘의 합이 총액이다', () => {
    const drops = {
      [`a|스우|노멀|${WEEK_KEY}`]: [
        { category: 'equipment' as const, itemName: '반지', quantity: 1, priceState: 'entered' as const, priceMeso: 60, priceShare: 2 },
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

describe('최고가 아이템 ([[ADR-147]] 결정 9 · 정정 5)', () => {
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

  // today 가 답하는 질문은 «내가 얼마를 벌었나» 다 — 총액으로 그리면 같은 화면의 「주간 보스 수익」
  // (`sumDropPayout` = 분배 후 합)보다 최고가가 큰 화면이 나온다([[ADR-147]] 정정 21).
  it('분배된 금액을 그린다 — 입력한 총액이 아니다', () => {
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

  it('순위도 분배 후 기준이다 — 표시와 순위가 갈리면 1위가 더 작은 숫자를 단다', () => {
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

  it('분배 인원이 없으면 단독이다 — 나눈 적 없는 기록을 나누지 않는다', () => {
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

  // 값을 모르는 것을 «가장 싼 것» 으로 단정하지 않는다.
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

  // 'excluded' 는 «값을 매기지 않기로 한» 사용자의 결정이라 기다리는 건이 아니다.
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

  // 위젯 4가 «캐릭터 · 보스» 를 그린다. ocid 는 사용자에게 뜻이 없는 값이라 대신 넣지 않는다.
  it('캐릭터 이름은 프로필 캐시에 있을 때만 싣는다', () => {
    const 기록 = dropRecord({ itemName: '반지', priceState: 'entered', priceMeso: 10 })
    const 있음 = buildTodayViewModel(
      input({ profilesByOcid: { a: profile() }, dropGroups: [dropGroup([기록])] }),
    )
    const 없음 = buildTodayViewModel(input({ dropGroups: [dropGroup([기록])] }))

    expect(있음.topItem?.top.characterName).toBe('단풍루틴')
    expect(없음.topItem?.top.characterName).toBeUndefined()
  })

  // 아이콘 조회(`getItemIconUrl(name, slot)`)가 쓴다 — 빠지면 에러가 아니라 조용한 폴백 원이 된다.
  it('아이콘 조회에 필요한 `slot` 을 그대로 나른다', () => {
    const model = buildTodayViewModel(
      input({
        dropGroups: [
          dropGroup([dropRecord({ itemName: '반지', slot: '반지', priceState: 'entered', priceMeso: 10 })]),
        ],
      }),
    )

    expect(model.topItem?.top.slot).toBe('반지')
  })
})

describe('주간 결정석 판매 한도 ([[ADR-054]])', () => {
  it('월드별로 갈리고 분모는 WEEKLY_CRYSTAL_SALE_LIMIT 이다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b'],
        profitRows: [
          profitRow({ ocid: 'a', world: '스카니아', boss: '스우', isComplete: true }),
          profitRow({ ocid: 'a', world: '스카니아', boss: '데미안', isComplete: true }),
          profitRow({ ocid: 'b', world: '루나', boss: '스우', isComplete: true }),
          profitRow({ ocid: 'b', world: '루나', boss: '루시드', isComplete: false }),
        ],
      }),
    )

    expect(model.crystalLimits).toEqual([
      { world: '스카니아', cleared: 2, limit: WEEKLY_CRYSTAL_SALE_LIMIT },
      { world: '루나', cleared: 1, limit: WEEKLY_CRYSTAL_SALE_LIMIT },
    ])
  })
})

describe('아이템 드롭 가뭄 ([[ADR-147]] 정정 6)', () => {
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
  // now 를 고정하면 전부 결정적이다 — 이 파일이 `new Date()` 를 부르지 않는 이유.
  it('일간·주간·월간 초기화까지 남은 시간을 KST 기준으로 센다', () => {
    const model = buildTodayViewModel(input())

    // 2026-08-18 00:00 KST
    expect(model.resets.daily.remainingMs).toBe(12 * HOUR_MS)
    // 2026-08-20(목) 00:00 KST
    expect(model.resets.weekly.remainingMs).toBe(60 * HOUR_MS)
    // 2026-09-01 00:00 KST
    expect(model.resets.monthly.remainingMs).toBe(348 * HOUR_MS)
  })

  it('다음 초기화 시각도 함께 준다 — 화면이 1초마다 다시 세도 기준이 흔들리지 않는다', () => {
    const model = buildTodayViewModel(input())

    expect(new Date(model.resets.daily.atMs).toISOString()).toBe('2026-08-17T15:00:00.000Z')
    expect(new Date(model.resets.weekly.atMs).toISOString()).toBe('2026-08-19T15:00:00.000Z')
    expect(new Date(model.resets.monthly.atMs).toISOString()).toBe('2026-08-31T15:00:00.000Z')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 공유 컨텐츠 ([[ADR-147]] 정정 28~31)
// ────────────────────────────────────────────────────────────────────────────

const MONSTER_PARK = '몬스터파크'
const EXTREME = '[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?'
const EPIC_HIGH = '에픽 던전 : 하이마운틴'
const EPIC_ANGLER = '에픽 던전 : 앵글러 컴퍼니'
const EPIC_NIGHTMARE = '에픽 던전 : 악몽선경'
const UNION_WEEKLY = '[메이플 유니온] 주간 드래곤 퇴치'
const UNION_PC = '[메이플 유니온] PC방 주간 드래곤 퇴치'

/** 카탈로그의 일곱을 전부 등록해 둔 캐릭터 — 값만 덮어 쓰며 쓴다. */
function sharedView(ocid: string, overrides: Partial<ContentCharacterView> = {}): ContentCharacterView {
  return contentView(ocid, {
    dailyContents: [daily({ name: MONSTER_PARK, kind: 'contents', maxCount: 14, questState: null })],
    weeklyContents: [
      weekly({ name: EPIC_HIGH, kind: 'contents', maxCount: 0, questState: null }),
      weekly({ name: EPIC_ANGLER, kind: 'contents', maxCount: 0, questState: null }),
      weekly({ name: EPIC_NIGHTMARE, kind: 'contents', maxCount: 0, questState: null }),
      weekly({ name: UNION_WEEKLY }),
      weekly({ name: UNION_PC }),
      weekly({ name: EXTREME, maxCount: 2 }),
    ],
    ...overrides,
  })
}

function sharedRows(model: ReturnType<typeof buildTodayViewModel>) {
  return model.sharedContents.map((group) => [
    group.group,
    group.items.map((item) => [item.shortName, item.count, item.isComplete] as const),
  ])
}

describe('공유 컨텐츠 — 계열로 묶는다 ([[ADR-147]] 정정 28)', () => {
  it('계열 셋을 카탈로그 순서로 낸다 — 월드/계정은 그리지 않는다', () => {
    const model = buildTodayViewModel(
      input({ orderedOcids: ['a'], contentCharacters: [sharedView('a')] }),
    )

    expect(model.sharedContents.map((group) => group.group)).toEqual([
      '에픽던전',
      '몬스터파크',
      '메이플 유니온',
    ])
  })

  it('짧은 이름을 쓴다 — 계열명은 위에 있으므로 항목에서 뺀다', () => {
    const model = buildTodayViewModel(
      input({ orderedOcids: ['a'], contentCharacters: [sharedView('a')] }),
    )

    expect(model.sharedContents[0]?.items.map((item) => item.shortName)).toEqual([
      '하이마운틴',
      '앵글러컴퍼니',
      '악몽선경',
    ])
  })

  it('캐릭터가 넷이어도 항목은 한 줄씩이다 — 이 분리의 이유가 그 중복이다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b', 'c', 'd'],
        contentCharacters: ['a', 'b', 'c', 'd'].map((ocid) => sharedView(ocid)),
      }),
    )

    expect(model.sharedContents.flatMap((group) => group.items)).toHaveLength(7)
  })

  it('「남은 스케줄」에서는 일곱이 빠진다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            dailyContents: [
              daily({ name: MONSTER_PARK, kind: 'contents', maxCount: 14, questState: null }),
              daily({ name: '[일일 퀘스트] 소멸의 여로 조사' }),
            ],
          }),
        ],
      }),
    )

    // 캐릭터 줄에는 개인 일퀘 하나만 남는다 — 몬스터파크는 공유 위젯의 몫이다.
    expect(model.schedule[0]?.dailyNames).toEqual(['소멸의 여로'])
    expect(model.schedule[0]?.weeklyNames).toEqual([])
    expect(model.scheduleTotal).toBe(1)
  })
})

describe('공유 컨텐츠 — 오른쪽 열은 `maxCount > 0` 하나로 갈린다 ([[ADR-147]] 정정 29)', () => {
  it('몬스터파크는 7/14 — 월드 총합을 그대로 그린다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            dailyContents: [
              daily({ name: MONSTER_PARK, kind: 'contents', nowCount: 7, maxCount: 14, questState: null }),
            ],
          }),
        ],
      }),
    )
    const park = model.sharedContents.find((group) => group.group === '몬스터파크')

    expect(park?.items[0]).toMatchObject({
      shortName: '일간',
      count: { now: 7, max: 14 },
      isComplete: false,
    })
  })

  it('에픽 던전은 maxCount 가 0이라 카운트를 안 그린다 — 참여 여부만 안다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            weeklyContents: [
              weekly({ name: EPIC_HIGH, kind: 'contents', nowCount: 1, maxCount: 0, questState: null }),
              weekly({ name: EPIC_ANGLER, kind: 'contents', maxCount: 0, questState: null }),
            ],
          }),
        ],
      }),
    )
    const epic = model.sharedContents.find((group) => group.group === '에픽던전')

    expect(epic?.items[0]).toMatchObject({ shortName: '하이마운틴', count: null, isComplete: true })
    expect(epic?.items[1]).toMatchObject({ shortName: '앵글러컴퍼니', count: null, isComplete: false })
  })

  it('완료하면 카운트를 안 준다 — 화면이 CLEAR 를 그린다 ([[ADR-147]] 정정 33)', () => {
    // 익스트림 몬스터파커는 `quest_state` 로 완료를 판정하는 항목이라 `now_count` 의 충실도가
    // 확인된 적이 없다. 완료한 항목의 «몇 번 했나» 는 언제나 max 라 카운트를 줄 이유가 없고,
    // 안 주면 **끝낸 퀘스트가 `0/2` 로 보일 위험도 함께 사라진다**.
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            weeklyContents: [weekly({ name: EXTREME, nowCount: 0, maxCount: 2, questState: 2 })],
          }),
        ],
      }),
    )
    const park = model.sharedContents.find((group) => group.group === '몬스터파크')
    const extreme = park?.items.find((item) => item.shortName === '익스트림 몬스터파커')

    expect(extreme).toMatchObject({ count: null, isComplete: true })
  })

  it('카운트형도 다 채우면 카운트를 안 준다 — 「익스트림만 예외」는 이름으로 유추하는 규칙이 된다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            dailyContents: [
              daily({ name: MONSTER_PARK, kind: 'contents', nowCount: 14, maxCount: 14, questState: null }),
            ],
          }),
        ],
      }),
    )
    const park = model.sharedContents.find((group) => group.group === '몬스터파크')

    expect(park?.items[0]).toMatchObject({ shortName: '일간', count: null, isComplete: true })
  })

  it('카운트가 최대를 넘어도 분모를 넘지 않는다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            weeklyContents: [weekly({ name: EXTREME, nowCount: 5, maxCount: 2, questState: 0 })],
          }),
        ],
      }),
    )
    const extreme = model.sharedContents
      .flatMap((group) => group.items)
      .find((item) => item.shortName === '익스트림 몬스터파커')

    expect(extreme?.count).toEqual({ now: 2, max: 2 })
  })

  it('진행은 공유라 캐릭터마다 갈리면 가장 앞선 값을 쓴다 — 늦게 동기화된 캐릭터가 값을 되돌리지 않는다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a', 'b'],
        contentCharacters: [
          sharedView('a', {
            dailyContents: [
              daily({ name: MONSTER_PARK, kind: 'contents', nowCount: 2, maxCount: 14, questState: null }),
            ],
          }),
          sharedView('b', {
            dailyContents: [
              daily({ name: MONSTER_PARK, kind: 'contents', nowCount: 9, maxCount: 14, questState: null }),
            ],
          }),
        ],
      }),
    )
    const park = model.sharedContents.find((group) => group.group === '몬스터파크')

    expect(park?.items[0]?.count).toEqual({ now: 9, max: 14 })
  })

  it('머리의 수는 완료가 아닌 줄의 수다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            weeklyContents: [
              weekly({ name: EPIC_HIGH, kind: 'contents', nowCount: 1, maxCount: 0, questState: null }),
              weekly({ name: EPIC_ANGLER, kind: 'contents', nowCount: 1, maxCount: 0, questState: null }),
              weekly({ name: EPIC_NIGHTMARE, kind: 'contents', maxCount: 0, questState: null }),
              weekly({ name: UNION_WEEKLY, questState: 2 }),
              weekly({ name: UNION_PC }),
              weekly({ name: EXTREME, nowCount: 1, maxCount: 2 }),
            ],
          }),
        ],
      }),
    )

    // 남은 것 — 악몽선경 · 몬스터파크(0/14) · 익스트림 · PC방
    expect(model.sharedRemaining).toBe(4)
  })
})

describe('공유 컨텐츠 — 유니온만 조건부다 ([[ADR-147]] 정정 30)', () => {
  it('아무 캐릭터의 스케줄러에도 없으면 유니온 계열이 통째로 빠진다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            weeklyContents: [
              weekly({ name: EPIC_HIGH, kind: 'contents', maxCount: 0, questState: null }),
              weekly({ name: EXTREME, maxCount: 2 }),
            ],
          }),
        ],
      }),
    )

    expect(model.sharedContents.map((group) => group.group)).toEqual(['에픽던전', '몬스터파크'])
  })

  it('둘 중 하나만 있으면 그 한 줄만 남는다 — 계열이 아니라 항목 단위다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        contentCharacters: [
          sharedView('a', {
            weeklyContents: [weekly({ name: UNION_PC })],
          }),
        ],
      }),
    )
    const union = model.sharedContents.find((group) => group.group === '메이플 유니온')

    expect(union?.items.map((item) => item.shortName)).toEqual(['PC방 주간 드래곤 퇴치'])
  })

  it('에픽 던전·몬스터파크는 아무도 등록 안 해도 그린다', () => {
    const model = buildTodayViewModel(
      input({ orderedOcids: ['a'], contentCharacters: [contentView('a')] }),
    )

    expect(sharedRows(model)).toEqual([
      [
        '에픽던전',
        [
          ['하이마운틴', null, false],
          ['앵글러컴퍼니', null, false],
          ['악몽선경', null, false],
        ],
      ],
      ['몬스터파크', [['일간', null, false], ['익스트림 몬스터파커', null, false]]],
    ])
  })

  it('캐릭터가 하나도 없어도 다섯 줄이 선다 — 위젯은 사라지지 않는다', () => {
    const model = buildTodayViewModel(input({}))

    expect(model.sharedContents.flatMap((group) => group.items)).toHaveLength(5)
    expect(model.sharedRemaining).toBe(5)
  })

  it('수동 모드에서는 추적 목록 멤버십이 «스케줄러에 있는가» 다', () => {
    const model = buildTodayViewModel(
      input({
        orderedOcids: ['a'],
        trackingMode: 'manual',
        manualContentByOcid: { a: [{ contentName: UNION_PC, kind: 'weekly' }] },
        contentCharacters: [sharedView('a')],
      }),
    )
    const union = model.sharedContents.find((group) => group.group === '메이플 유니온')

    expect(union?.items.map((item) => item.shortName)).toEqual(['PC방 주간 드래곤 퇴치'])
  })
})

// [[ADR-162]] 결정 1·4 — 요구 레벨에 못 미치는 항목은 «남은 것» 이 아니다. 게임이 등록을 허용해도
// 이 캐릭터로는 못 하므로, 세면 그 숫자가 **영원히 안 줄어든다.** 스케줄러 카드·진행률·링과 같은
// 판정 함수를 봐야 [[ADR-147]] 결정 8(«한 글자도 다르면 안 된다»)이 성립한다.
//
// 항목을 **캐릭터 단위**로 고른 것이 요점이다 — 몬스터파크(요구 레벨 105)는 월드 공유라 이 목록에
// 애초에 안 든다([[ADR-147]] 정정 28). 공유 항목으로 재면 레벨과 무관하게 빠져 테스트가 거짓으로
// 통과한다.
describe('요구 레벨 미달은 남은 개수에서 빠진다 ([[ADR-162]])', () => {
  const 항목 = [
    daily({ name: '[일일 퀘스트] 소멸의 여로 조사' }), // 요구 레벨 200
    daily({ name: '[일일 퀘스트] 츄츄 아일랜드 최고의 요리' }), // 요구 레벨 210
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

  // 레벨을 모르면 단정하지 않는다 — 전부 센다([[ADR-057]] 태도).
  it('레벨을 모르면 아무것도 안 뺀다', () => {
    expect(남은것()).toHaveLength(2)
  })
})
