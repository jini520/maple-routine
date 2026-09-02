/**
 * today 위젯이 읽는 **하나의 뷰모델**. 화면이 스토어 넷을 읽어 한 번 모으고, 위젯에는 프롭으로만
 * 준다.
 *
 * ## 이 파일이 순수 함수인 이유
 *
 * 스토어를 import 하지 않고 **상태를 값으로 받는다.** 그래야 위젯이 한 줄도 없는 지금 로직 전부를
 * 값 조합만으로 검증할 수 있고, 수익 0 · 캐릭터 없음 · 동기화 실패 같은 상태를 목 없이 만든다.
 * 같은 이유로 `new Date()` 를 부르지 않는다. `now` 를 받아야 카운트다운·기간 판정이 고정된다.
 *
 * ## 여기서 판정 을 새로 쓰지 않는다
 *
 * today 가 세는 남은 것 은 스케줄러 화면이 보여 주는 것과 한 글자도 다르면 안 된다. 그래서 판정은
 * 전부 남의 것을 부른다:
 *
 * | 값 | 출처 |
 * |---|---|
 * | 컨텐츠 완료 | `../content-scheduler/content-completion` |
 * | 표시 대상 보스 | `src/features/boss-scheduler/displayed-bosses` |
 * | 수익 합산 | `../boss-profit/character-groups` 의 `groupTotalMeso` |
 * | 결정석·아이템 분해 | 같은 파일의 `sumPayout` + `src/lib/drop/drop-price` 의 `sumDropPayout` |
 * | 결정석 월드 집계 | 같은 파일의 `summarizeWorldCrystals` |
 * | 한도 분모 | `src/lib/boss/boss-matching` 의 `WEEKLY_CRYSTAL_SALE_LIMIT` |
 * | 대표 캐릭터 | `resolveDisplayRepresentative` |
 * | 초기화 시각 | `src/lib/scheduler/reset-clock` · `src/lib/boss/boss-profit-period` |
 *
 * 그 대가로 **화면 사이 import 가 둘 생긴다**(`content-scheduler`·`boss-profit`).이
 * 감수하기로 한 것이고, 판정을 두 벌로 만드는 것보다 낫다.
 *
 * ## 이번 주 의 범위
 *
 * 위젯 3·4·7 은 전부 **현재 주간 기간 키 하나**로 자른다. 보스 수익 화면의 주간 탭과 같은 범위다.
 * 월간 키(`YYYY-MM`)로 저장되는 검은마법사 기록은 여기 들지 않는다(그쪽은 그 화면의 월간 탭 몫).
 * 셋이 같은 범위여야 위젯 7이 위젯 4의 없음 을 설명할 수 있다.
 */

import { isBossBlocked, isContentBlocked } from '../../lib/scheduler/required-level'
import { resolveDisplayRepresentative } from '../../features/character-manage/derivations'
import { displayedBosses } from '../../features/boss-scheduler/displayed-bosses'
import type { BossCharacterView } from '../../features/boss-scheduler/store'
import type { ContentCharacterView } from '../../features/content-scheduler/store'
import type { BossProfitRow } from '../../features/boss-profit/store'
import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../lib/boss/boss-matching'
import { getShareScope, getSharedContentGroups } from '../../lib/scheduler/scheduler-content-scope'
import {
  formatBossProfitPeriodLabel,
  getAdjacentPeriodKey,
  getCurrentBossProfitPeriod,
} from '../../lib/boss/boss-profit-period'
import {
  formatValuableDroughtItems,
  getPeriodStartUtcMs,
  getValuableDroughtTier,
  valuableDroughtHeadlineCount,
  type DropHistoryPeriodGroup,
  type DropHistoryRecord,
  type ValuableDroughtSummary,
} from '../../lib/drop/drop-history'
import { dropPayoutMeso, sumDropPayout } from '../../lib/drop/drop-price'
import { getCurrentKstDateKey, getMostRecentWeeklyResetKst } from '../../lib/scheduler/reset-clock'
import type { ManualTrackedItem } from '../../storage/manual-tracked-content'
import type { TrackingMode } from '../../storage/tracking-mode'
import type {
  BossCycle,
  BossDifficulty,
  CharacterBasicProfile,
  DailyContent,
  DropCategory,
  WeeklyContent,
} from '../../types'
import type { RecordedDrop } from '../../types/drops'

import { orderByTracked } from '../../lib/scheduler/tracked-order'
import {
  buildCharacterGroups,
  collectGroupDrops,
  groupTotalMeso,
  sumPayout,
  summarizeWorldCrystals,
} from '../boss-profit/character-groups'
import {
  displayedDailyContents,
  displayedWeeklyContents,
} from '../../features/content-scheduler/displayed-contents'

import {
  shortDailyContentName,
  shortWeeklyContentName,
} from '../../features/content-scheduler/short-content-name'

import { dailyContentCompletion, weeklyContentCompletion } from '../content-scheduler/content-completion'

const DAY_MS = 24 * 60 * 60 * 1000

/** 캐릭터별 수익 목록에 담는 캐릭터 수. 4x3 타일이 세 줄이다. */
const TOP_CHARACTER_COUNT = 3

/** 최고가 아이템 순위 길이. 4x2 타일이 1위 + 2~5위를 그린다. */
const TOP_ITEM_COUNT = 5

/** 가격 미입력 미리보기 길이. 2x2 타일이 이름 셋까지 세우고 나머지는 외 N건 이다. */
const UNPRICED_PREVIEW_COUNT = 3

/** 대표 캐릭터 카드가 그리는 것. 값이 없는 줄은 위젯이 그리지 않는다. */
export interface RepresentativeView {
  ocid: string
  name: string
  level: number
  imageUrl: string
  /** 월드 엠블럼은 위젯이 `worldEmblemUrl` 로 푼다. 뷰모델은 이름만 나른다. */
  world?: string
  jobClass?: string
  /** `null` = 미가입 · `undefined` = 모름. */
  guildName?: string | null
  expRate?: number
}

/**
 * 한 캐릭터의 남은 것 넷.
 *
 * 라벨(일퀘·주간퀘·주간 보스·**검마**)은 위젯이 붙인다. 검마는 월간 보스가 하나뿐이라 성립하는
 * 이름이라 참조 데이터에서 파생시키지 않는다.
 */
/** 아코디언 본문의 보스 한 줄. 난이도는 공용 `Badge` 가 그린다. */
export interface RemainingBossView {
  name: string
  difficulty: BossDifficulty
}

/**
 * 캐릭터 한 줄.
 *
 * **개수 대신 이름을 든다**. 접힘의 수치는 이 배열들의 `length` 이고, 펼침의
 * 본문은 같은 배열을 이름으로 그린다. 두 층이 **같은 배열 하나**를 보므로 세는 것 = 보이는 것
 * 이 구조로 성립한다. 개수를 따로 들면 그 둘이 갈릴 자리가 생긴다.
 */
export interface ScheduleRowView {
  ocid: string
  characterName: string
  imageUrl: string | null
  dailyNames: readonly string[]
  weeklyNames: readonly string[]
  weeklyBosses: readonly RemainingBossView[]
  monthlyBosses: readonly RemainingBossView[]
  /**의 캐릭터 단위 실패 표식. 참이면 위젯이 수치 대신 동기화 실패를 그린다. */
  hasSyncIssue: boolean
}

/**
 * 공유 컨텐츠 한 줄.
 *
 * **캐릭터가 없다**. 진행이 공유되므로 캐릭터 수만큼 세면 하루 한 번 할 일이 넷으로 부풀고, 그
 * 부풀림을 없애는 것이 위젯 9의 존재 이유다.
 */
export interface SharedContentItemView {
  /** API 원문 이름. 화면은 안 쓰지만 어느 항목인가 의 신원이라 남긴다. */
  name: string
  /** 그리는 이름. 계열명이 위에 있으므로 그것을 뺀 나머지다(카탈로그의 `shortName`). */
  shortName: string
  /**
   * `null` 이면 화면이 `CLEAR`(완료) 또는 **빈칸**(미완료)을 그린다.
   *
   * 값이 서는 것은 **미완료이면서 분모가 있는** 항목뿐이다. 완료한 항목의
   * 몇 번 했나 는 언제나 `max` 라 숫자가 더 말하는 것이 없고, 분모가 없는 항목에 `0/1` 을 붙이려면
   * **API 에 없는 값**을 앱이 지어내야 한다.
   */
  count: { now: number; max: number } | null
  isComplete: boolean
}

export interface SharedContentGroupView {
  group: string
  items: SharedContentItemView[]
}

/**
 * 총액을 가른 둘. 위젯 3의 스택 바와 분해 금액이 읽는 값이다.
 *
 * **위젯이 스토어를 모르므로** 총액만 주면 갈라 그릴 방법이 없다. 그렇다고 여기서
 * 새로 세지도 않는다. 결정석은 `sumPayout`, 아이템은 `sumDropPayout` 이고 둘의 합이 곧
 * `groupTotalMeso` 다(이번 주 계산에는 주차별 소계가 언제나 비어 있다).
 */
export interface ProfitSplit {
  /** 보스 행의 `payoutMeso` 합(드롭은 여기 안 든다). */
  crystalMeso: number
  /** 그 행들에 기록된 드롭 판매가의 분배 후 합. */
  itemMeso: number
}

export interface WeeklyProfitCharacterView extends ProfitSplit {
  ocid: string
  characterName: string
  imageUrl: string | null
  totalMeso: number
}

export interface WeeklyProfitView extends ProfitSplit {
  /** 결정석 + 아이템. 기록이 없으면 0 이다. */
  totalMeso: number
  /**
   * 이번 주에 **기록이 하나라도 있는가**. `totalMeso` 가 0 인 두 경우(0메소를 벌었다 와 아직
   * 아무것도 없다)를 위젯이 가를 근거가 이것뿐이다. 그 구분이 사라지면 큰 `0` 이 사실을 단정한다.
   */
  hasRecords: boolean
  /** 기간 범위(8월 14일 ~ 8월 20일). 4x3 헤더만 쓴다. `formatBossProfitPeriodLabel` 의 `secondary`. */
  periodRange: string
  topCharacters: WeeklyProfitCharacterView[]
}

/**
 * 드롭 한 건에서 **금액을 뺀** 나머지. 위젯 7(가격 미입력)이 읽는 모양이다.
 *
 * 금액이 있는 쪽(`PricedDropView`)이 이것을 넓히는 것이 방향이 맞다. 미입력 건은 아직 값이 없는
 * 것이지 0원인 것이 아니라, 그 사실이 타입에서도 필드의 부재로 남는다.
 */
export interface UnpricedDropView {
  ocid: string
  /**
   * 프로필 캐시에 있을 때만. 없으면 위젯이 보스만 그린다(ocid 는 사용자에게 뜻이 없는 값이라
   * 대신 넣지 않는다, 대표 카드와 같은 규칙).
   */
  characterName?: string
  boss: string
  difficulty: string
  itemName: string
  /** 아이콘 조회(`getItemIconUrl(name, slot)`)가 쓴다. 안 넘기면 조용한 폴백 원이 된다. */
  slot?: string
  ringLevel?: number
  quantity: number
  category: DropCategory
}

export interface PricedDropView extends UnpricedDropView {
  /**
   * **실수령액**. 입력한 판매 총액을 분배 인원으로 나눈 값(`dropPayoutMeso`).
   *
   * 총액이 아니라 이 값을 쓰는 이유는 today 가 답하는 질문이 내가 이번 주에 얼마를 벌었나 이기
   * 때문이다. 같은 화면의 주간 보스 수익이 이미 `sumDropPayout`(= 이 함수의 합)으로 더하므로,
   * 총액으로 순위를 매기면 **최고가 아이템이 총 수익보다 큰 화면**이 나온다.
   *
   * **순위 기준도 이 값이다**. 표시와 순위가 갈리면 1위가 2위보다 작은 숫자를 달고 선다.
   */
  payoutMeso: number
  /** 분배 인원(`priceShare`). `1` 이면 단독이라 화면이 분배 표기를 생략한다. */
  shareCount: number
}

export interface TopItemView {
  top: PricedDropView
  /** 2~5위. 4x2 타일만 쓴다. */
  rest: PricedDropView[]
}

export interface CrystalLimitView {
  world: string
  cleared: number
  limit: number
}

export interface DroughtView {
  weeksSince: number
  /** 잎 색·기울기를 고르는 단계(0 = 이번 주 획득). */
  tier: number
  /**
   * 그 단계의 문구 개수. **무작위 인덱스는 위젯이 마운트당 한 번** 고른다.
   * `Math.random()` 이 여기 들어오면 이 파일이 순수 함수가 아니게 된다.
   */
  headlineCount: number
  periodKey: string
  cycle: BossCycle
  /**
   * 그 기간의 사람이 읽는 이름(`이번 주` · `7월 3주차`). **위젯이 만들 수 없다**.
   * `formatBossProfitPeriodLabel` 이 지금이 언제인가 를 받아야 이번 주 를 말할 수 있는데,
   * 타일마다 시계를 읽으면 같은 화면의 두 타일이 다른 시각을 말한다(위젯 6과 같은 규칙).
   */
  periodLabel: string
  itemsLabel: string
}

export interface ResetCountdown {
  /** 다음 초기화 시각(epoch ms). */
  atMs: number
  /** `now` 기준 남은 밀리초. */
  remainingMs: number
  /**
   * 이 주기 **한 바퀴**의 길이(ms). 2x2 타일의 진행 바가 주기의 어디쯤인가 를 그리는 분모다.
   *
   * 일간·주간은 상수지만 **월간은 달마다 다르다**(28~31일). 위젯이 그것을 스스로 구하려면 KST 달
   * 경계를 다시 계산해야 하고, 그 순간 리셋 시각의 진실이 둘이 된다. 그래서 경계를 이미 아는 이
   * 파일이 함께 낸다(`buildResets` 가 두 경계를 다 갖고 있어 뺄셈 한 번이다).
   */
  periodMs: number
}

export interface ResetCountdownView {
  daily: ResetCountdown
  weekly: ResetCountdown
  monthly: ResetCountdown
}

/**
 * 스토어 **상태를 값으로** 받는다(스토어 인스턴스가 아니라). 필드 하나하나가 어느 스토어의 어느
 * 값인지는 아래 주석이 적어 둔다. `TodayScreen` 의 배선이 기계적이어야 한다.
 */
export interface TodayViewModelInput {
  now: Date
  /** 캐릭터 관리 순서(= 추적 목록 저장 순서). */
  orderedOcids: string[]
  /** 사용자가 대표라고 말한 ocid. 미지정이면 첫 번째가 선다. */
  representativeOcid: string | null
  /** `character-basic-cache` 에서 읽은 프로필. */
  profilesByOcid: Readonly<Record<string, CharacterBasicProfile>>
  /** 컨텐츠 스케줄러 스토어. */
  contentCharacters: readonly ContentCharacterView[]
  /** 보스 스케줄러 스토어. */
  bossCharacters: readonly BossCharacterView[]
  trackingMode: TrackingMode
  /**
   * 수동 멤버십의 **계열별 주인**.
   *
   * 저장소 키는 하나인데(`manualTrackedContent`) 스케줄러 스토어 **둘이 각자 사본**을 든다. 사본을
   * 갱신하는 것은 각자 자기 계열을 바꿀 때뿐이므로(`addManualContent` 는 컨텐츠 스토어만,
   * `addManualBoss` 는 보스 스토어만) 계열마다 최신인 사본이 정해져 있다. 스케줄러 화면 둘은 자기
   * 계열만 그려 이 사실을 몰라도 되지만, **두 계열을 한 화면에서 그리는 것은 여기뿐**이라 이 조립은
   * 둘을 다 받아야 한다. 하나로 합쳐 받으면 반대쪽 계열이 옛 사본에 굳는다.
   */
  manualContentByOcid: Record<string, ManualTrackedItem[]> | null
  manualBossByOcid: Record<string, ManualTrackedItem[]> | null
  /** 보스 수익 스토어의 캐릭터 단위 실패 표식. 위젯 2·3 이 물려받는다. */
  characterIssues: Readonly<Record<string, 'unavailable' | 'failed'>>
  /** 보스 수익 스토어. 이번 주가 아닌 기간의 행은 이 파일이 걸러낸다(파일 머리 이번 주). */
  profitRows: readonly BossProfitRow[]
  profitDropsByRowKey: Readonly<Record<string, RecordedDrop[]>>
  /** 드롭 히스토리 스토어(전 기간). */
  dropGroups: readonly DropHistoryPeriodGroup[]
  drought: ValuableDroughtSummary | null
}

export interface TodayViewModel {
  representative: RepresentativeView | null
  /** 계열별로 묶인 공유 컨텐츠. 위젯 9. */
  sharedContents: SharedContentGroupView[]
  /** 그중 완료가 아닌 **줄**의 수. 캐릭터 수와 무관하다. 그게 이 분리의 이유다. */
  sharedRemaining: number
  /** **캐릭터 관리 순서**의 목록. 남은 개수 많은 순은 탭을 아는 위젯이 세운다. */
  schedule: ScheduleRowView[]
  profit: WeeklyProfitView
  topItem: TopItemView | null
  /** 이번 주 가격 미입력 드롭 건수. 위젯 7의 값이라 위젯 4 안에 넣지 않는다. */
  unpricedCount: number
  /**
   * 그중 앞 몇 건. 2x2 타일이 **이름**을 보여 준다. 값을 적어야지보다 그 연마석 얼마에
   * 팔았지가 손을 움직이는 문장이라, 건수만으로는 그 문장을 만들 수 없다.
   *
   * 순서는 스토어가 준 순서 그대로다(`period_key DESC, ocid, boss, difficulty, drop_index`).
   * 여기서 다시 정렬하면 무엇 기준으로 앞 셋인가 라는 주장이 생기는데, 미입력 건에는 비교할
   * 값이 없다.
   */
  unpricedPreview: UnpricedDropView[]
  crystalLimits: CrystalLimitView[]
  drought: DroughtView | null
  resets: ResetCountdownView
}

export function buildTodayViewModel(input: TodayViewModelInput): TodayViewModel {
  const weeklyPeriodKey = getCurrentBossProfitPeriod('weekly', input.now).periodKey
  const weeklyDrops = collectWeeklyDrops(input.dropGroups, weeklyPeriodKey)
  const schedule = buildScheduleRows(input)
  // `값을 기다리는 것`의 정의는 `priceState === undefined` 하나다. `'excluded'`(기록 안 함)는
  // 사용자가 **값을 매기지 않기로** 정한 것이라 기다리는 건이 아니다(파일 머리 `이번 주` 절).
  const unpriced = weeklyDrops.filter((record) => record.priceState === undefined)

  const sharedContents = buildSharedContents(input)

  return {
    representative: buildRepresentative(input),
    sharedContents,
    sharedRemaining: sharedContents
      .flatMap((group) => group.items)
      .filter((item) => !item.isComplete).length,
    schedule,
    ...buildProfit(input, weeklyPeriodKey),
    topItem: buildTopItem(weeklyDrops, input.profilesByOcid),
    unpricedCount: unpriced.length,
    unpricedPreview: unpriced
      .slice(0, UNPRICED_PREVIEW_COUNT)
      .map((record) => toDropView(record, input.profilesByOcid)),
    drought: buildDrought(input.drought, input.now),
    resets: buildResets(input.now),
  }
}

function buildRepresentative(input: TodayViewModelInput): RepresentativeView | null {
  const ocid = resolveDisplayRepresentative(input.orderedOcids, input.representativeOcid)
  if (ocid === null) return null

  // 이름 없이 카드를 그릴 수 없다. ocid 는 사용자에게 뜻이 없는 값이라 대신 넣지 않는다
  // (`drop-history-store` 가 캐시 미스에 항목을 만들지 않는 것과 같은 규칙).
  const profile = input.profilesByOcid[ocid]
  if (profile === undefined) return null

  return {
    ocid,
    name: profile.name,
    level: profile.level,
    imageUrl: profile.imageUrl,
    world: profile.world,
    jobClass: profile.jobClass,
    guildName: profile.guildName,
    expRate: profile.expRate,
  }
}

/** 카탈로그 이름과 응답 이름의 공백 방향이 항목마다 달라(카탈로그 `matchingNote`) 지운 뒤 비교한다. */
function sameContentName(a: string, b: string): boolean {
  return a.replace(/\s+/g, '') === b.replace(/\s+/g, '')
}

/** 한 캐릭터의 컨텐츠 입력. 남은 스케줄과 공유 위젯이 같은 모양으로 읽는다. */
function contentsInputOf(
  input: TodayViewModelInput,
  content: ContentCharacterView | undefined,
): { dailyContents: DailyContent[]; weeklyContents: WeeklyContent[]; manualItems: ManualTrackedItem[] } {
  return {
    dailyContents: content?.dailyContents ?? [],
    weeklyContents: content?.weeklyContents ?? [],
    manualItems: (content === undefined ? undefined : input.manualContentByOcid?.[content.ocid]) ?? [],
  }
}

/**
 * 공유 컨텐츠를 **계열별로** 조립한다 (~30).
 *
 * ## 값은 가장 앞선 캐릭터 것이다
 *
 * 진행이 공유되므로 캐릭터마다 같은 값이어야 하는데, 마지막 동기화 시각이 달라 **뒤처진 캐릭터가
 * 낮은 값을 들고 있을 수 있다**. 주기 안에서 진행은 줄지 않으므로 최댓값이 곧 최신값이고, 완료는
 * 하나라도 완료면 완료다. 낮은 쪽을 고르면 이미 한 일이 화면에서 되돌아간다.
 *
 * ## 값 과 스케줄러에 있는가 는 다른 목록에서 온다
 *
 * - **값**: 캐릭터의 원본 목록(`dailyContents`/`weeklyContents`). API 는 등록 여부와 무관하게
 *   진행을 준다. 그래서 아무도 등록 안 한 에픽 던전도 값이 있으면 `CLEAR` 로 그려진다.
 * - **있는가**: `displayed*Contents`(자동 모드 = `registration_flag`, 수동 모드 = 추적 목록 멤버십).
 *  `onlyWhenScheduled` 인 항목만 이 판정을 탄다(유니온 둘).
 *
 * 둘을 한 목록으로 합치면 등록 안 했지만 진행은 있다 를 표현할 방법이 사라진다.
 */
function buildSharedContents(input: TodayViewModelInput): SharedContentGroupView[] {
  const daily: DailyContent[] = []
  const weekly: WeeklyContent[] = []
  const scheduled = new Set<string>()

  for (const content of input.contentCharacters) {
    daily.push(...content.dailyContents)
    weekly.push(...content.weeklyContents)

    const contentsInput = contentsInputOf(input, content)
    for (const item of displayedDailyContents(contentsInput, input.trackingMode)) {
      scheduled.add(item.name.replace(/\s+/g, ''))
    }
    for (const item of displayedWeeklyContents(contentsInput, input.trackingMode)) {
      scheduled.add(item.name.replace(/\s+/g, ''))
    }
  }

  return getSharedContentGroups()
    .map((group): SharedContentGroupView => {
      const items = group.entries
        .filter(
          (entry) => !entry.onlyWhenScheduled || scheduled.has(entry.name.replace(/\s+/g, '')),
        )
        .map((entry): SharedContentItemView => {
          const matches = (entry.section === 'daily' ? daily : weekly).filter((item) =>
            sameContentName(item.name, entry.name),
          )
          const isComplete = matches.some(
            (item) =>
              (entry.section === 'daily'
                ? dailyContentCompletion(item as DailyContent)
                : weeklyContentCompletion(item as WeeklyContent)) === 'complete',
          )
          // `maxCount` 는 스토어가 이미 `maxCountOverride` 를 얹은 값이다(`scheduler-merge`).
          // 여기서 다시 얹으면 오버라이드의 출처가 둘이 된다.
          const max = Math.max(0, ...matches.map((item) => item.maxCount))
          const now = Math.max(0, ...matches.map((item) => item.nowCount))

          return {
            name: entry.name,
            shortName: entry.shortName,
            // **완료하면 카운트를 안 준다**. 완료한 항목의 **몇 번 했나** 는
            // 언제나 `max` 라 `CLEAR` 가 이미 그 말을 하고, 안 주면 카운트로 완료를 재지 않는
            // 항목(익스트림 몬스터파커는 `quest_state` 로 판정한다)이 **끝냈는데 `0/2` 로 보이는**
            // 위험도 함께 사라진다. `그 항목만 예외`로 적으면 그것이 이름으로 유추하는 규칙이 된다.
            count: !isComplete && max > 0 ? { now: Math.min(now, max), max } : null,
            isComplete,
          }
        })

      return { group: group.group, items }
    })
    .filter((group) => group.items.length > 0)
}

function buildScheduleRows(input: TodayViewModelInput): ScheduleRowView[] {
  const contentByOcid = new Map(input.contentCharacters.map((view) => [view.ocid, view]))
  const bossByOcid = new Map(input.bossCharacters.map((view) => [view.ocid, view]))

  // 두 스토어의 합집합이다. 한쪽에만 있는 캐릭터를 버리면 카드가 통째로 사라진다(`tracked-order`
  // 가 **순서를 정하는 함수가 목록의 크기를 바꾸지 않는다** 로 적어 둔 것과 같은 판단).
  const ocids: string[] = []
  const seen = new Set<string>()
  for (const view of [...input.contentCharacters, ...input.bossCharacters]) {
    if (seen.has(view.ocid)) continue
    seen.add(view.ocid)
    ocids.push(view.ocid)
  }

  const rows = ocids.map((ocid): ScheduleRowView => {
    const content = contentByOcid.get(ocid)
    const boss = bossByOcid.get(ocid)

    // **남은 것** = 셀 수 있는 항목 − 완료한 항목. `unmeasurable`(무릉도장)은 분모에서 이미 빠져
    // 있으므로 여기서 따로 거르지 않는다.
    //
    // **먼저 표시 대상 으로 거른다.** `content.dailyContents` 는 캐릭터가 등록했든 안 했든 게임에
    // 있는 항목 전부라, 그냥 세면 모든 캐릭터가 카탈로그 길이(일간 18)로 똑같아진다. 스케줄러 화면과
    // **같은 함수**를 써야 **세는 것 = 보이는 것** 이 성립한다(보스 쪽 `displayedBosses` 와 같은 짝).
    //
    // **공유 항목은 여기 안 든다**. 진행이 공유되므로 캐릭터마다 세면 하루
    // 한 번 할 일이 캐릭터 수만큼 부푼다. 거르는 자리가 **여기**인 것이 중요하다:
    // `displayed-contents.ts` 는 컨텐츠 화면과 공유하므로 거기서 빼면 그 화면에서도 사라지는데,
    // 그 화면은 캐릭터별로 그리는 것이 맞다(진행이 공유될 뿐 **내가 할 수 있는 일** 목록에는 있다).
    const contentsInput = contentsInputOf(input, content)
    // **요구 레벨에 못 미치는 항목은 남은 것 이 아니다**. 게임이 등록을
    // 허용해도 이 캐릭터로는 못 하므로, 세면 그 숫자가 영원히 안 줄어든다. 스케줄러 카드·진행률·
    // 링과 **같은 판정 함수**를 본다. 그것이 이 요구하는 **한 글자도 다르지
    // 않다** 의 조건이다.
    const characterLevel = content?.level ?? boss?.level ?? null
    const dailyNames = displayedDailyContents(contentsInput, input.trackingMode)
      .filter((item) => getShareScope(item.name) === 'character')
      .filter((item) => !isContentBlocked(characterLevel, item.name))
      .filter((item) => dailyContentCompletion(item) === 'incomplete')
      .map((item) => shortDailyContentName(item.name))
    const weeklyNames = displayedWeeklyContents(contentsInput, input.trackingMode)
      .filter((item) => getShareScope(item.name) === 'character')
      .filter((item) => !isContentBlocked(characterLevel, item.name))
      .filter((item) => weeklyContentCompletion(item) === 'incomplete')
      .map((item) => shortWeeklyContentName(item.name))
    const weeklyBosses = remainingBosses(input, boss, 'weekly', characterLevel)
    const monthlyBosses = remainingBosses(input, boss, 'monthly', characterLevel)

    return {
      ocid,
      characterName: content?.characterName ?? boss?.characterName ?? '',
      imageUrl: content?.imageUrl ?? boss?.imageUrl ?? null,
      dailyNames,
      weeklyNames,
      weeklyBosses,
      monthlyBosses,
      hasSyncIssue: input.characterIssues[ocid] !== undefined,
    }
  })

  // **여기서 세우는 것은 관리 순서 하나다**. `남은 개수 많은 순`은 **어느
  // 주기의** 개수인지가 정해져야 셀 수 있는데 그 주기는 위젯의 탭이라, 그 정렬은 탭을 아는 쪽이
  // 한다. 뷰모델이 총합으로 한 번 세워 두면 위젯이 그것을 **다시** 세우게 되고 순서의 계약이 두
  // 벌이 된다(동수의 기준인 관리 순서도 그때 이미 뭉개져 있다).
  return orderByTracked(rows, input.orderedOcids)
}

/**
 * 남은 보스. **개수가 아니라 목록**이다(아코디언 본문이 이름을 그린다).
 *
 * 이름은 `matchedBossName ?? apiName`. 참조 데이터에 매핑된 이름이 있으면 그것, 없으면 API 원문
 * 그대로다(매핑 실패는 원문 그대로).
 */
function remainingBosses(
  input: TodayViewModelInput,
  boss: BossCharacterView | undefined,
  cycle: BossCycle,
  /** 요구 레벨에 못 미치는 보스는 남은 것 이 아니다. */
  characterLevel: number | null,
): RemainingBossView[] {
  if (boss === undefined) return []
  return displayedBosses(boss, cycle, input.trackingMode, input.manualBossByOcid)
    .filter(
      (matched) =>
        !isBossBlocked(characterLevel, matched.matchedBossName ?? matched.apiName, matched.difficulty),
    )
    .filter((matched) => !matched.isComplete)
    // **주간 한도를 채우면 남은 것이 아니다**. 이번 주엔 더 잡을 수 없다.
    // 판정은 여기 없다: `displayedBosses` 가 실어 보낸 값을 거를 뿐이라 스케줄러가 `마감` 배지를
    // 다는 보스와 **정확히 같은 집합**이다.
    .filter((matched) => !matched.isWeeklyLimitClosed)
    .map((matched) => ({
      name: matched.matchedBossName ?? matched.apiName,
      difficulty: matched.difficulty,
    }))
}

function buildProfit(
  input: TodayViewModelInput,
  weeklyPeriodKey: string,
): Pick<TodayViewModel, 'profit' | 'crystalLimits'> {
  // 보스 수익 스토어는 사용자가 보던 (탭, 기간)을 들고 있다. 이번 주 주간 행만 남긴다.
  const rows = input.profitRows.filter(
    (row) => row.cycle === 'weekly' && row.periodKey === weeklyPeriodKey,
  )
  // 월간 탭에서만 채워지는 값이라 이번 주 계산에는 언제나 빈 배열이다.
  const groups = buildCharacterGroups(rows, [])
  const dropsByRowKey = input.profitDropsByRowKey as Record<string, RecordedDrop[]>

  const characters = groups.map((group) => ({
    ocid: group.ocid,
    characterName: group.characterName,
    imageUrl: group.imageUrl,
    totalMeso: groupTotalMeso(group, dropsByRowKey),
    // 총액을 다시 세는 것이 아니라 **가르는** 것이다. `groupTotalMeso` 가 더하는 세 항 중 주차별
    // 소계는 이번 주 계산에서 언제나 비어 있으므로(`buildCharacterGroups(rows, [])`) 둘의 합이
    // 그대로 `totalMeso` 가 된다. 그래서 여기서 나오는 두 값은 총액과 어긋날 수 없다.
    crystalMeso: sumPayout(group.bossRows),
    itemMeso: sumDropPayout(collectGroupDrops(group, dropsByRowKey)),
  }))

  const hasRecords =
    rows.some((row) => row.isComplete) ||
    groups.some((group) => collectGroupDrops(group, dropsByRowKey).length > 0)

  return {
    profit: {
      totalMeso: characters.reduce((sum, character) => sum + character.totalMeso, 0),
      crystalMeso: characters.reduce((sum, character) => sum + character.crystalMeso, 0),
      itemMeso: characters.reduce((sum, character) => sum + character.itemMeso, 0),
      hasRecords,
      periodRange: formatBossProfitPeriodLabel('weekly', weeklyPeriodKey, input.now).secondary,
      topCharacters: orderByTracked(characters, input.orderedOcids)
        .map((character, index) => ({ character, index }))
        .sort((a, b) =>
          a.character.totalMeso === b.character.totalMeso
            ? a.index - b.index
            : b.character.totalMeso - a.character.totalMeso,
        )
        .slice(0, TOP_CHARACTER_COUNT)
        .map((entry) => entry.character),
    },
    crystalLimits: summarizeWorldCrystals(groups).map((summary) => ({
      world: summary.world,
      cleared: summary.cleared,
      limit: WEEKLY_CRYSTAL_SALE_LIMIT,
    })),
  }
}

function collectWeeklyDrops(
  groups: readonly DropHistoryPeriodGroup[],
  weeklyPeriodKey: string,
): DropHistoryRecord[] {
  return groups.filter((group) => group.periodKey === weeklyPeriodKey).flatMap((group) => group.records)
}

/**
 * 저장 행 하나 → 위젯이 읽는 모양. **금액은 싣지 않는다**. 값이 있는 쪽만 그것을 얹는다.
 *
 * 캐릭터 이름이 옵셔널인 것이 요점이다(프로필 캐시에 있을 때만. ocid 를 대신 넣지 않는다).
 */
function toDropView(
  record: DropHistoryRecord,
  profilesByOcid: Readonly<Record<string, CharacterBasicProfile>>,
): UnpricedDropView {
  return {
    ocid: record.ocid,
    characterName: profilesByOcid[record.ocid]?.name,
    boss: record.boss,
    difficulty: record.difficulty,
    itemName: record.itemName,
    slot: record.slot,
    ringLevel: record.ringLevel,
    quantity: record.quantity,
    category: record.category,
  }
}

function buildTopItem(
  records: DropHistoryRecord[],
  profilesByOcid: Readonly<Record<string, CharacterBasicProfile>>,
): TopItemView | null {
  // 가격을 아직 안 적은 기록은 순위에 넣지 않는다. 값을 모르는 것을 가장 싼
  // 것으로 단정하는 일이다. 합산(`dropPayoutMeso`)이 미입력을 0으로 접는 것과 **다른 문제**다:
  // 합산은 **더할 것이 없다** 이지만 순위는 **비교했다** 를 주장한다.
  const priced = records
    .filter((record) => record.priceState === 'entered' && typeof record.priceMeso === 'number')
    .map(
      (record): PricedDropView => ({
        ...toDropView(record, profilesByOcid),
        // 분배는 여기서 다시 나누지 않는다. `dropPayoutMeso` 가 그 규칙(0 나눗셈 방어 포함)을
        // 이미 갖고 있고, `주간 보스 수익`의 아이템 합(`sumDropPayout`)이 같은 함수를 쓴다.
        payoutMeso: dropPayoutMeso(record),
        shareCount: Math.max(1, record.priceShare ?? 1),
      }),
    )
    .sort((a, b) => b.payoutMeso - a.payoutMeso)
    .slice(0, TOP_ITEM_COUNT)

  if (priced.length === 0) return null
  return { top: priced[0], rest: priced.slice(1) }
}

function buildDrought(summary: ValuableDroughtSummary | null, now: Date): DroughtView | null {
  if (summary === null) return null
  return {
    weeksSince: summary.weeksSince,
    tier: getValuableDroughtTier(summary.weeksSince),
    headlineCount: valuableDroughtHeadlineCount(summary.weeksSince),
    periodKey: summary.periodKey,
    cycle: summary.cycle,
    // 히스토리 화면과 같은 라벨 함수다. 두 자리가 같은 주를 다르게 부르면 안 된다.
    periodLabel: formatBossProfitPeriodLabel(summary.cycle, summary.periodKey, now).primary,
    itemsLabel: formatValuableDroughtItems(summary.records),
  }
}

/**
 * 다음 초기화까지 남은 시간.
 *
 * 세 값 모두 **기존 KST 계산을 조합**한다. 오프셋 상수를 여기서 다시 선언하면 리셋 시각의 진실이
 * 둘이 된다. 일간은 오늘의 KST 날짜 키가 가리키는 자정 + 24h, 주간은 가장 최근 목요일 리셋 + 7일,
 * 월간은 다음 달 기간 키의 시작(1일 00:00 KST)이다.
 */
function buildResets(now: Date): ResetCountdownView {
  const nowMs = now.getTime()
  const countdown = (atMs: number, periodMs: number): ResetCountdown => ({
    atMs,
    remainingMs: Math.max(0, atMs - nowMs),
    periodMs,
  })

  const monthlyPeriodKey = getCurrentBossProfitPeriod('monthly', now).periodKey
  // 이번 달의 두 경계. 길이는 그 차이다(28~31일이라 상수로 둘 수 없다).
  const monthlyStartMs = getPeriodStartUtcMs(monthlyPeriodKey)
  const monthlyAtMs = getPeriodStartUtcMs(getAdjacentPeriodKey('monthly', monthlyPeriodKey, 'next'))

  return {
    daily: countdown(getPeriodStartUtcMs(getCurrentKstDateKey(now)) + DAY_MS, DAY_MS),
    weekly: countdown(getMostRecentWeeklyResetKst(now).getTime() + 7 * DAY_MS, 7 * DAY_MS),
    monthly: countdown(monthlyAtMs, monthlyAtMs - monthlyStartMs),
  }
}
