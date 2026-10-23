// 위젯 테스트가 공유하는 **빈 뷰모델**. 테스트 파일이 아니라 보조 파일이라 `*.test.ts` 가 아니고
// (`jest.config.js` 의 `testMatch` 가 이름으로 거른다), `components/__tests__/render-atom.tsx` 와 같은
// 자리에 있다.
//
// 위젯은 스토어를 모르고 `TodayViewModel` 만 받으므로 **목이 필요 없다**. 값
// 조합이 곧 테스트 입력이다. 그 이득을 실제로 회수하려면 **전부 빈 상태** 하나가 있어야 하고, 각
// 테스트는 자기가 보는 필드만 덮어쓴다.

import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../../../lib/boss/boss-matching'
import { contentCategoryNameOf, type ContentCategoryKey } from '../../../../lib/scheduler/content-categories'

import type {
  CrystalLimitView,
  PricedDropView,
  RepresentativeView,
  ResetCountdown,
  ScheduleRowView,
  SharedContentGroupView,
  SharedContentItemView,
  TodayViewModel,
  WeeklyIncomeCharacterView,
  WeeklyIncomeView,
} from '../../view-model'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const 빈_뷰모델: TodayViewModel = {
  representative: null,
  headerPortraits: [],
  sharedContents: [],
  schedule: [],
  weeklyIncome: {
    loading: false,
    totals: { incomeMeso: 0, expenseMeso: 0, netMeso: 0 },
    income: [],
    expense: [],
    characters: [],
  },
  topItem: null,
  unpricedCount: 0,
  crystalLimits: [],
  resets: {
    daily: { atMs: 0, remainingMs: 0, periodMs: DAY_MS },
    weekly: { atMs: 0, remainingMs: 0, periodMs: 7 * DAY_MS },
    monthly: { atMs: 0, remainingMs: 0, periodMs: 31 * DAY_MS },
  },
  nextParty: [],
}

export function 뷰모델(부분: Partial<TodayViewModel>): TodayViewModel {
  return { ...빈_뷰모델, ...부분 }
}

/** 모든 줄이 채워진 대표 캐릭터. 없는 것을 지우는 테스트가 여기서 하나씩 뺀다. */
export const 대표_캐릭터: RepresentativeView = {
  ocid: 'ocid-대표',
  name: '단풍루틴',
  level: 291,
  imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
  worldKey: 'scania',
  jobClass: '아크메이지(불,독)',
  guildName: '백호단',
  expRate: 80.3,
  unavailable: false,
}

/**
 * 남은 것이 넷 다 있는 행. **개수는 배열 길이에서 나온다**. 4·3·2·1 이라 테스트가 글자로 집을 수 있다.
 *
 * 이름은 실제 참조 데이터의 것을 쓴다(지어낸 이름은 지역명만 쓴다 판정을 타지 못한다).
 */
export function 스케줄행(부분: Partial<ScheduleRowView> = {}): ScheduleRowView {
  const base: ScheduleRowView = {
    ocid: 'ocid-1',
    characterName: '야간비행',
    imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/one',
    dailyNames: ['소멸의 여로', '츄츄 아일랜드', '레헬른', '아르카나'],
    weeklyNames: ['에르다 스펙트럼', '크리티아스', '헤이븐'],
    weeklyBosses: [
      { bossKey: 'lotus', name: '스우', difficulty: 'hard' },
      { bossKey: 'papulatus', name: '파풀라투스', difficulty: 'chaos' },
    ],
    monthlyBosses: [{ bossKey: 'black_mage', name: '검은마법사', difficulty: 'hard' }],
    syncIssue: null,
  }

  return { ...base, ...부분 }
}

/** n명짜리 목록. 이름·ocid 만 갈린다(스냅샷이 캐릭터 수만 다르게 찍힌다). */
export function 스케줄목록(n: number): ScheduleRowView[] {
  return Array.from({ length: n }, (_, index) =>
    스케줄행({
      ocid: `ocid-${index + 1}`,
      characterName: `캐릭터${index + 1}`,
      imageUrl: `https://open.api.nexon.com/static/maplestory/character/look/${index + 1}`,
    }),
  )
}

/** 아이콘이 실제로 해석되는 key 를 기본값으로 둔다(마스터 표 `drop-items.json` 에 그림이 있는 반지). */
export function 드롭(부분: Partial<PricedDropView> = {}): PricedDropView {
  return {
    ocid: 'ocid-1',
    characterName: '야간비행',
    boss: '스우',
    difficulty: 'normal',
    itemName: '가디언 엔젤 링',
    itemKey: 'guardian_angel_ring',
    quantity: 1,
    category: 'equipment',
    payoutMeso: 12_000_000_000,
    ...부분,
  }
}

/**
 * 월드 한도 한 줄. **분모는 언제나 참조 데이터에서 온다**.
 *
 * 픽스처가 숫자를 적으면 위젯이 그 숫자를 그대로 그려도 상수에서 왔는가 를 못 묻는다. 그래서
 * 기본값을 상수로 두고, 판별력 확인이 필요한 테스트만 `limit` 을 명시적으로 덮는다.
 */
export function 월드한도(부분: Partial<CrystalLimitView> = {}): CrystalLimitView {
  return { worldKey: 'scania', world: '스카니아', cleared: 34, limit: WEEKLY_CRYSTAL_SALE_LIMIT, ...부분 }
}

/** n개 월드. 이름과 소진량이 서로 달라 합쳐졌는가 를 글자로 물을 수 있다. */
export function 월드한도목록(n: number): CrystalLimitView[] {
  const 월드 = [
    ['scania', '스카니아'],
    ['luna', '루나'],
    ['aurora', '오로라'],
    ['bera', '베라'],
    ['croa', '크로아'],
  ]
  return Array.from({ length: n }, (_, index) =>
    월드한도({
      worldKey: 월드[index]?.[0] ?? `world_${index + 1}`,
      world: 월드[index]?.[1] ?? `월드${index + 1}`,
      cleared: 10 * (index + 1),
    }),
  )
}

/** 남은 시간 한 벌. 주기 길이는 실제 값과 같게 두고 남은 시간만 테스트가 정한다. */
export function 카운트다운(remainingMs: number, periodMs: number): ResetCountdown {
  return { atMs: remainingMs, remainingMs, periodMs }
}

export function 초기화(
  daily: number,
  weekly: number,
  monthly: number,
): TodayViewModel['resets'] {
  return {
    daily: 카운트다운(daily, DAY_MS),
    weekly: 카운트다운(weekly, 7 * DAY_MS),
    monthly: 카운트다운(monthly, 31 * DAY_MS),
  }
}

/** 공유 컨텐츠 한 줄. 카운트가 없으면 `CLEAR`/빈칸으로 그려진다. */
export function 공유항목(
  shortName: string,
  부분: Partial<SharedContentItemView> = {},
): SharedContentItemView {
  return { contentKey: shortName, shortName, count: null, isComplete: false, isWeeklyLimitClosed: false, ...부분 }
}

/** 공유 컨텐츠 계열. 머리글은 갈래 표의 이름이다. */
export function 공유계열(
  category: ContentCategoryKey,
  items: SharedContentItemView[],
  weeklyLimit: SharedContentGroupView['weeklyLimit'] = null,
): SharedContentGroupView {
  return { category, label: contentCategoryNameOf(category), items, weeklyLimit }
}

/** 카탈로그 일곱을 다 그린 상태. 남은 것 넷(악몽선경· 일간· 익스트림· PC방). */
export function 공유컨텐츠(): SharedContentGroupView[] {
  return [
    공유계열('monster_park', [
      공유항목('일간', { count: { now: 7, max: 14 } }),
      공유항목('익스트림 몬스터파커', { count: { now: 1, max: 5 } }),
    ]),
    공유계열('maple_union', [
      공유항목('주간 드래곤 퇴치', { isComplete: true }),
      공유항목('PC방 주간 드래곤 퇴치'),
    ]),
    공유계열('epic_dungeon', [
      공유항목('하이마운틴', { isComplete: true }),
      공유항목('앵글러컴퍼니', { isComplete: true }),
      공유항목('악몽선경'),
    ]),
  ]
}

/**
 * 이번 주 수익 캐릭터 한 명. 수익 갈래 둘 · 지출 갈래 하나이고, 합계는 갈래의 합에서 낸다.
 *
 * 합계를 손으로 적게 하면 줄의 금액과 팝오버의 합이 같다 는 뷰모델의 계약이 픽스처에서 깨진다.
 */
export function 수익캐릭터(
  key: string,
  name: string,
  income: [string, number][],
  expense: [string, number][],
): WeeklyIncomeCharacterView {
  const totals = (pairs: [string, number][]): number => pairs.reduce((sum, [, meso]) => sum + meso, 0)
  return {
    key,
    name,
    imageUrl: null,
    incomeMeso: totals(income),
    expenseMeso: totals(expense),
    netMeso: totals(income) - totals(expense),
    income: income.map(([category, meso]) => ({ key: category, name: category, meso })),
    expense: expense.map(([category, meso]) => ({ key: category, name: category, meso })),
  }
}

/** 기록이 있는 한 주. 캐릭터 셋의 갈래를 합친 것이 그대로 위젯의 갈래와 합계다. */
export function 이번주수익(캐릭터들: WeeklyIncomeCharacterView[]): WeeklyIncomeView {
  const merge = (side: 'income' | 'expense'): WeeklyIncomeView['income'] => {
    const sums = new Map<string, number>()
    for (const character of 캐릭터들) {
      for (const total of character[side]) sums.set(total.key, (sums.get(total.key) ?? 0) + total.meso)
    }
    return [...sums]
      .map(([key, meso]) => ({ key, name: key, meso }))
      .sort((left, right) => right.meso - left.meso)
  }
  const incomeMeso = 캐릭터들.reduce((sum, character) => sum + character.incomeMeso, 0)
  const expenseMeso = 캐릭터들.reduce((sum, character) => sum + character.expenseMeso, 0)
  return {
    loading: false,
    totals: { incomeMeso, expenseMeso, netMeso: incomeMeso - expenseMeso },
    income: merge('income'),
    expense: merge('expense'),
    characters: 캐릭터들,
  }
}

/**
 * 셋. 순 수익 · 수익 · 지출 순위가 서로 다르다. 세그먼트를 바꾸면 순위가 바뀌는지를 이름으로 물을 수 있다.
 *
 * 순 수익: 가(8억) · 나(5억) · 다(1억), 합 14억. 수익: 가(10억) · 다(6억) · 나(5억). 지출: 다(5억) · 가(2억), 나는 지출이 없다.
 */
export function 수익캐릭터셋(): WeeklyIncomeCharacterView[] {
  return [
    수익캐릭터('ocid:a', '가', [['보스 결정석', 800_000_000], ['사냥', 200_000_000]], [['스타포스', 200_000_000]]),
    수익캐릭터('ocid:b', '나', [['보스 결정석', 500_000_000]], []),
    수익캐릭터('ocid:c', '다', [['보스 드롭', 600_000_000]], [['큐브 재설정', 500_000_000]]),
  ]
}
