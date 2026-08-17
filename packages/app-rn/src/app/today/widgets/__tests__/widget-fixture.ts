// 위젯 테스트가 공유하는 **빈 뷰모델**. 테스트 파일이 아니라 보조 파일이라 `*.test.ts` 가 아니고
// (`jest.config.js` 의 `testMatch` 가 이름으로 거른다), `components/__tests__/render-atom.tsx` 와 같은
// 자리에 있다.
//
// 위젯은 스토어를 모르고 `TodayViewModel` 만 받으므로([[ADR-146]] 결정 4) **목이 필요 없다** — 값
// 조합이 곧 테스트 입력이다. 그 이득을 실제로 회수하려면 «전부 빈 상태» 하나가 있어야 하고, 각
// 테스트는 자기가 보는 필드만 덮어쓴다.

import { WEEKLY_CRYSTAL_SALE_LIMIT } from '@core/lib/boss-matching'

import { getValuableDroughtTier, valuableDroughtHeadlineCount } from '@core/lib/drop-history'

import type {
  CrystalLimitView,
  DroughtView,
  PricedDropView,
  RepresentativeView,
  ResetCountdown,
  ScheduleRowView,
  TodayViewModel,
  UnpricedDropView,
  WeeklyProfitCharacterView,
} from '../../view-model'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const 빈_뷰모델: TodayViewModel = {
  representative: null,
  schedule: [],
  scheduleTotal: 0,
  profit: {
    totalMeso: 0,
    crystalMeso: 0,
    itemMeso: 0,
    hasRecords: false,
    periodRange: '8월 14일 ~ 8월 20일',
    topCharacters: [],
  },
  topItem: null,
  unpricedCount: 0,
  unpricedPreview: [],
  crystalLimits: [],
  drought: null,
  resets: {
    daily: { atMs: 0, remainingMs: 0, periodMs: DAY_MS },
    weekly: { atMs: 0, remainingMs: 0, periodMs: 7 * DAY_MS },
    monthly: { atMs: 0, remainingMs: 0, periodMs: 31 * DAY_MS },
  },
}

export function 뷰모델(부분: Partial<TodayViewModel>): TodayViewModel {
  return { ...빈_뷰모델, ...부분 }
}

/** 모든 줄이 채워진 대표 캐릭터 — 없는 것을 지우는 테스트가 여기서 하나씩 뺀다. */
export const 대표_캐릭터: RepresentativeView = {
  ocid: 'ocid-대표',
  name: '단풍루틴',
  level: 291,
  imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
  world: '스카니아',
  jobClass: '아크메이지(불,독)',
  guildName: '백호단',
  expRate: 80.3,
}

/** 남은 것이 넷 다 있는 행. 수치는 **서로 다른 값**이라 테스트가 글자로 집을 수 있다. */
export function 스케줄행(부분: Partial<ScheduleRowView> = {}): ScheduleRowView {
  const base: ScheduleRowView = {
    ocid: 'ocid-1',
    characterName: '야간비행',
    imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/one',
    dailyQuest: 4,
    weeklyQuest: 3,
    weeklyBoss: 2,
    monthlyBoss: 1,
    remainingTotal: 10,
    hasSyncIssue: false,
  }
  const merged = { ...base, ...부분 }

  // 합계를 손으로 적게 하면 테스트마다 어긋난다 — 명시적으로 준 경우만 그 값을 쓴다.
  return 부분.remainingTotal === undefined
    ? {
        ...merged,
        remainingTotal:
          merged.dailyQuest + merged.weeklyQuest + merged.weeklyBoss + merged.monthlyBoss,
      }
    : merged
}

/** n명짜리 목록 — 이름·ocid 만 갈린다(스냅샷이 캐릭터 수만 다르게 찍힌다). */
export function 스케줄목록(n: number): ScheduleRowView[] {
  return Array.from({ length: n }, (_, index) =>
    스케줄행({
      ocid: `ocid-${index + 1}`,
      characterName: `캐릭터${index + 1}`,
      imageUrl: `https://open.api.nexon.com/static/maplestory/character/look/${index + 1}`,
    }),
  )
}

/**
 * 수익 캐릭터 한 명. **결정석과 아이템이 서로 다른 값**이라 스택 바가 반반으로 그려지는 실수를
 * 테스트가 볼 수 있고, `formatMesoShort` 를 통과한 세 값(`20.0억`·`5.0억`·`25.0억`)도 서로 다르다.
 */
export function 수익캐릭터(
  부분: Partial<WeeklyProfitCharacterView> = {},
): WeeklyProfitCharacterView {
  const base = {
    ocid: 'ocid-1',
    characterName: '야간비행',
    imageUrl: null,
    crystalMeso: 2_000_000_000,
    itemMeso: 500_000_000,
  }
  const merged = { ...base, ...부분 }

  // 합계를 손으로 적게 하면 «둘의 합이 총액» 이라는 뷰모델의 계약이 픽스처에서 깨진다.
  return {
    ...merged,
    totalMeso: 부분.totalMeso ?? merged.crystalMeso + merged.itemMeso,
  }
}

/** 기록이 있는 한 주 — 캐릭터 셋의 합이 그대로 타일의 총액이다. */
export function 수익(캐릭터들: WeeklyProfitCharacterView[]): TodayViewModel['profit'] {
  return {
    totalMeso: 캐릭터들.reduce((sum, entry) => sum + entry.totalMeso, 0),
    crystalMeso: 캐릭터들.reduce((sum, entry) => sum + entry.crystalMeso, 0),
    itemMeso: 캐릭터들.reduce((sum, entry) => sum + entry.itemMeso, 0),
    hasRecords: true,
    periodRange: '8월 14일 ~ 8월 20일',
    topCharacters: 캐릭터들,
  }
}

/** 상위 셋 — 금액이 내림차순이고 셋 다 다르다(뷰모델이 이미 정렬해 준 모양). */
export function 수익캐릭터셋(): WeeklyProfitCharacterView[] {
  return [
    수익캐릭터({ ocid: 'ocid-1', characterName: '가', crystalMeso: 2_000_000_000, itemMeso: 500_000_000 }),
    수익캐릭터({ ocid: 'ocid-2', characterName: '나', crystalMeso: 1_000_000_000, itemMeso: 300_000_000 }),
    수익캐릭터({ ocid: 'ocid-3', characterName: '다', crystalMeso: 200_000_000, itemMeso: 0 }),
  ]
}

/** 아이콘이 실제로 해석되는 이름을 기본값으로 둔다(`item-icons.json` 에 있는 반지). */
export function 드롭(부분: Partial<PricedDropView> = {}): PricedDropView {
  return {
    ocid: 'ocid-1',
    characterName: '야간비행',
    boss: '스우',
    difficulty: '노멀',
    itemName: '가디언 엔젤 링',
    quantity: 1,
    category: 'equipment',
    priceMeso: 12_000_000_000,
    ...부분,
  }
}

/**
 * 월드 한도 한 줄 — **분모는 언제나 참조 데이터에서 온다**([[ADR-006]]).
 *
 * 픽스처가 숫자를 적으면 위젯이 그 숫자를 그대로 그려도 «상수에서 왔는가» 를 못 묻는다. 그래서
 * 기본값을 상수로 두고, 판별력 확인이 필요한 테스트만 `limit` 을 명시적으로 덮는다.
 */
export function 월드한도(부분: Partial<CrystalLimitView> = {}): CrystalLimitView {
  return { world: '스카니아', cleared: 34, limit: WEEKLY_CRYSTAL_SALE_LIMIT, ...부분 }
}

/** n개 월드 — 이름과 소진량이 서로 달라 «합쳐졌는가» 를 글자로 물을 수 있다. */
export function 월드한도목록(n: number): CrystalLimitView[] {
  const 이름 = ['스카니아', '루나', '오로라', '베라', '크로아']
  return Array.from({ length: n }, (_, index) =>
    월드한도({ world: 이름[index] ?? `월드${index + 1}`, cleared: 10 * (index + 1) }),
  )
}

/** 남은 시간 한 벌 — 주기 길이는 실제 값과 같게 두고 남은 시간만 테스트가 정한다. */
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

/** 1위 + 2~5위. `restCount` 가 4보다 작으면 그만큼만 선다(4x2 의 «모자라면 있는 만큼»). */
export function 최고가(restCount: number): TodayViewModel['topItem'] {
  return {
    top: 드롭(),
    rest: Array.from({ length: restCount }, (_, index) =>
      드롭({
        itemName: `${index + 2}위 아이템`,
        priceMeso: 1_000_000_000 - index * 100_000_000,
      }),
    ),
  }
}

/**
 * 가격 미입력 한 벌 — 건수와 미리보기는 **따로 준다.**
 *
 * 뷰모델이 앞 셋만 미리보기에 싣고 나머지는 건수에만 남기므로(«외 N건»), 픽스처가 둘을 묶어 버리면
 * 그 어긋남을 테스트가 만들 수 없다.
 */
export function 미입력(
  count: number,
  이름들: string[] = [],
): Pick<TodayViewModel, 'unpricedCount' | 'unpricedPreview'> {
  return {
    unpricedCount: count,
    unpricedPreview: 이름들.map(
      (itemName, index): UnpricedDropView => ({
        ocid: `ocid-${index + 1}`,
        characterName: '야간비행',
        boss: '스우',
        difficulty: '노멀',
        itemName,
        quantity: 1,
        category: 'equipment',
      }),
    ),
  }
}

/**
 * 가뭄 요약 한 벌 — **단계는 손으로 적지 않는다.**
 *
 * `tier`·`headlineCount` 를 픽스처가 직접 쓰면 «위젯이 `getValuableDroughtTier` 를 따르는가» 를
 * 물을 수 없다(테스트가 답을 들고 와서 답을 맞추는 꼴이 된다). 뷰모델이 하는 것과 같은 파생을 한다.
 */
export function 가뭄(weeksSince: number, 부분: Partial<DroughtView> = {}): DroughtView {
  return {
    weeksSince,
    tier: getValuableDroughtTier(weeksSince),
    headlineCount: valuableDroughtHeadlineCount(weeksSince),
    periodKey: '2026-07-16',
    cycle: 'weekly',
    periodLabel: '7월 3주차',
    itemsLabel: '생명의 연마석 외 1개',
    ...부분,
  }
}
