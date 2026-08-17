/**
 * today 위젯이 읽는 **하나의 뷰모델** — 화면이 스토어 넷을 읽어 한 번 모으고, 위젯에는 프롭으로만
 * 준다([[ADR-146]] 결정 4).
 *
 * ## 이 파일이 순수 함수인 이유
 *
 * 스토어를 import 하지 않고 **상태를 값으로 받는다.** 그래야 위젯이 한 줄도 없는 지금 로직 전부를
 * 값 조합만으로 검증할 수 있고, 「수익 0 · 캐릭터 없음 · 동기화 실패」 같은 상태를 목 없이 만든다.
 * 같은 이유로 `new Date()` 를 부르지 않는다 — `now` 를 받아야 카운트다운·기간 판정이 고정된다.
 *
 * ## 여기서 «판정» 을 새로 쓰지 않는다 ([[ADR-146]] 결정 8)
 *
 * today 가 세는 «남은 것» 은 스케줄러 화면이 보여 주는 것과 한 글자도 다르면 안 된다. 그래서 판정은
 * 전부 남의 것을 부른다:
 *
 * | 값 | 출처 |
 * |---|---|
 * | 컨텐츠 완료 | `../content-scheduler/content-completion`([[ADR-142]] 결정 4의 «규칙의 출처») |
 * | 표시 대상 보스 | `@core/features/boss-scheduler/displayed-bosses`([[ADR-035]]·[[ADR-031]]) |
 * | 수익 합산 | `../boss-profit/character-groups` 의 `groupTotalMeso`([[ADR-124]] 결정 7) |
 * | 결정석·아이템 분해 | 같은 파일의 `sumPayout` + `@core/lib/drop-price` 의 `sumDropPayout` |
 * | 결정석 월드 집계 | 같은 파일의 `summarizeWorldCrystals`([[ADR-054]] 결정 5) |
 * | 한도 분모 | `@core/lib/boss-matching` 의 `WEEKLY_CRYSTAL_SALE_LIMIT` |
 * | 대표 캐릭터 | `resolveDisplayRepresentative`([[ADR-143]] 결정 4의 «임시 대표») |
 * | 초기화 시각 | `@core/lib/reset-clock` · `@core/lib/boss-profit-period` |
 *
 * 그 대가로 **화면 사이 import 가 둘 생긴다**(`content-scheduler`·`boss-profit`). [[ADR-146]] 결정 8이
 * 감수하기로 한 것이고, 판정을 두 벌로 만드는 것보다 낫다.
 *
 * ## 「이번 주」 의 범위
 *
 * 위젯 3·4·7 은 전부 **현재 주간 기간 키 하나**로 자른다 — 보스 수익 화면의 주간 탭과 같은 범위다.
 * 월간 키(`YYYY-MM`)로 저장되는 검은마법사 기록은 여기 들지 않는다(그쪽은 그 화면의 월간 탭 몫).
 * 셋이 같은 범위여야 위젯 7이 위젯 4의 «없음» 을 설명할 수 있다([[ADR-146]] 결정 9).
 */

import { resolveDisplayRepresentative } from '@core/features/character-manage/derivations'
import { displayedBosses } from '@core/features/boss-scheduler/displayed-bosses'
import type { BossCharacterView } from '@core/features/boss-scheduler/store'
import type { ContentCharacterView } from '@core/features/content-scheduler/store'
import type { BossProfitRow } from '@core/features/boss-profit/store'
import { WEEKLY_CRYSTAL_SALE_LIMIT } from '@core/lib/boss-matching'
import {
  formatBossProfitPeriodLabel,
  getAdjacentPeriodKey,
  getCurrentBossProfitPeriod,
} from '@core/lib/boss-profit-period'
import {
  formatValuableDroughtItems,
  getPeriodStartUtcMs,
  getValuableDroughtTier,
  valuableDroughtHeadlineCount,
  type DropHistoryPeriodGroup,
  type DropHistoryRecord,
  type ValuableDroughtSummary,
} from '@core/lib/drop-history'
import { sumDropPayout } from '@core/lib/drop-price'
import { getCurrentKstDateKey, getMostRecentWeeklyResetKst } from '@core/lib/reset-clock'
import type { ManualTrackedItem } from '@core/storage/manual-tracked-content'
import type { TrackingMode } from '@core/storage/tracking-mode'
import type { BossCycle, CharacterBasicProfile, DropCategory } from '@core/types'
import type { RecordedDrop } from '@core/types/drops'

import { orderByTracked } from '../../lib/tracked-order'
import {
  buildCharacterGroups,
  collectGroupDrops,
  groupTotalMeso,
  sumPayout,
  summarizeWorldCrystals,
} from '../boss-profit/character-groups'
import { dailyContentProgress, weeklyContentProgress } from '../content-scheduler/content-completion'

const DAY_MS = 24 * 60 * 60 * 1000

/** 「캐릭터별 수익」 목록에 담는 캐릭터 수 — 4x3 타일이 세 줄이다. */
const TOP_CHARACTER_COUNT = 3

/** 최고가 아이템 순위 길이 — 4x2 타일이 1위 + 2~5위를 그린다([[ADR-146]] 정정 5). */
const TOP_ITEM_COUNT = 5

/** 가격 미입력 미리보기 길이 — 2x2 타일이 이름 셋까지 세우고 나머지는 «외 N건» 이다. */
const UNPRICED_PREVIEW_COUNT = 3

/** 대표 캐릭터 카드가 그리는 것 — 값이 없는 줄은 위젯이 그리지 않는다([[ADR-146]] 정정 7·8). */
export interface RepresentativeView {
  ocid: string
  name: string
  level: number
  imageUrl: string
  /** 월드 엠블럼은 위젯이 `worldEmblemUrl` 로 푼다 — 뷰모델은 이름만 나른다. */
  world?: string
  jobClass?: string
  /** `null` = 미가입 · `undefined` = 모름([[ADR-057]]). */
  guildName?: string | null
  expRate?: number
}

/**
 * 한 캐릭터의 «남은 것» 넷.
 *
 * 라벨(일퀘·주간퀘·주간 보스·**검마**)은 위젯이 붙인다 — 「검마」는 월간 보스가 하나뿐이라 성립하는
 * 이름이라([[ADR-146]] 정정 3) 참조 데이터에서 파생시키지 않는다.
 */
export interface ScheduleRowView {
  ocid: string
  characterName: string
  imageUrl: string | null
  dailyQuest: number
  weeklyQuest: number
  weeklyBoss: number
  monthlyBoss: number
  remainingTotal: number
  /** [[ADR-068]] 결정 3의 캐릭터 단위 실패 표식. 참이면 위젯이 수치 대신 「동기화 실패」를 그린다. */
  hasSyncIssue: boolean
}

/**
 * 총액을 가른 둘 — 위젯 3의 스택 바와 분해 금액이 읽는 값이다.
 *
 * **위젯이 스토어를 모르므로**([[ADR-146]] 결정 4) 총액만 주면 갈라 그릴 방법이 없다. 그렇다고 여기서
 * 새로 세지도 않는다 — 결정석은 `sumPayout`, 아이템은 `sumDropPayout` 이고 둘의 합이 곧
 * `groupTotalMeso` 다(이번 주 계산에는 주차별 소계가 언제나 비어 있다).
 */
export interface ProfitSplit {
  /** 보스 행의 `payoutMeso` 합([[ADR-124]] — 드롭은 여기 안 든다). */
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
  /** 결정석 + 아이템([[ADR-124]]). 기록이 없으면 0 이다([[ADR-146]] 정정 4). */
  totalMeso: number
  /**
   * 이번 주에 **기록이 하나라도 있는가**. `totalMeso` 가 0 인 두 경우(«0메소를 벌었다» 와 «아직
   * 아무것도 없다»)를 위젯이 가르는 유일한 근거다 — 그 구분이 사라지면 큰 `0` 이 사실을 단정한다.
   */
  hasRecords: boolean
  topCharacters: WeeklyProfitCharacterView[]
}

/**
 * 드롭 한 건에서 **금액을 뺀** 나머지 — 위젯 7(가격 미입력)이 읽는 모양이다.
 *
 * 금액이 있는 쪽(`PricedDropView`)이 이것을 넓히는 것이 방향이 맞다. 미입력 건은 «아직 값이 없는»
 * 것이지 «0원인» 것이 아니라([[ADR-146]] 결정 9), 그 사실이 타입에서도 필드의 부재로 남는다.
 */
export interface UnpricedDropView {
  ocid: string
  /**
   * 프로필 캐시에 있을 때만 — 없으면 위젯이 보스만 그린다(ocid 는 사용자에게 뜻이 없는 값이라
   * 대신 넣지 않는다, 대표 카드와 같은 규칙).
   */
  characterName?: string
  boss: string
  difficulty: string
  itemName: string
  /** 아이콘 조회(`getItemIconUrl(name, slot)`)가 쓴다 — 안 넘기면 조용한 폴백 원이 된다. */
  slot?: string
  ringLevel?: number
  quantity: number
  category: DropCategory
}

export interface PricedDropView extends UnpricedDropView {
  /** 입력된 **판매가**(분배 전). 순위 기준이 이 값이다([[ADR-146]] 결정 9). */
  priceMeso: number
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
   * 그 단계의 문구 개수 — **무작위 인덱스는 위젯이 마운트당 한 번** 고른다([[ADR-146]] 정정 6).
   * `Math.random()` 이 여기 들어오면 이 파일이 순수 함수가 아니게 된다.
   */
  headlineCount: number
  periodKey: string
  cycle: BossCycle
  /**
   * 그 기간의 사람이 읽는 이름(`이번 주` · `7월 3주차`). **위젯이 만들 수 없다** —
   * `formatBossProfitPeriodLabel` 이 «지금이 언제인가» 를 받아야 «이번 주» 를 말할 수 있는데,
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
   * 이 주기 **한 바퀴**의 길이(ms) — 2x2 타일의 진행 바가 «주기의 어디쯤인가» 를 그리는 분모다.
   *
   * 일간·주간은 상수지만 **월간은 달마다 다르다**(28~31일). 위젯이 그것을 스스로 구하려면 KST 달
   * 경계를 다시 계산해야 하고, 그 순간 리셋 시각의 진실이 둘이 된다 — 그래서 경계를 이미 아는 이
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
 * 값인지는 아래 주석이 적어 둔다 — `TodayScreen` 의 배선이 기계적이어야 한다.
 */
export interface TodayViewModelInput {
  now: Date
  /** 캐릭터 관리 순서(= 추적 목록 저장 순서, [[ADR-143]] 결정 3). */
  orderedOcids: string[]
  /** 사용자가 «대표라고 말한» ocid. 미지정이면 첫 번째가 선다([[ADR-146]] 정정 2). */
  representativeOcid: string | null
  /** `character-basic-cache` 에서 읽은 프로필. */
  profilesByOcid: Readonly<Record<string, CharacterBasicProfile>>
  /** 컨텐츠 스케줄러 스토어. */
  contentCharacters: readonly ContentCharacterView[]
  /** 보스 스케줄러 스토어. */
  bossCharacters: readonly BossCharacterView[]
  trackingMode: TrackingMode
  manualTrackedByOcid: Record<string, ManualTrackedItem[]> | null
  /** 보스 수익 스토어의 캐릭터 단위 실패 표식([[ADR-068]] 결정 3) — 위젯 2·3 이 물려받는다. */
  characterIssues: Readonly<Record<string, 'unavailable' | 'failed'>>
  /** 보스 수익 스토어. 이번 주가 아닌 기간의 행은 이 파일이 걸러낸다(파일 머리 「이번 주」). */
  profitRows: readonly BossProfitRow[]
  profitDropsByRowKey: Readonly<Record<string, RecordedDrop[]>>
  /** 드롭 히스토리 스토어(전 기간). */
  dropGroups: readonly DropHistoryPeriodGroup[]
  drought: ValuableDroughtSummary | null
}

export interface TodayViewModel {
  representative: RepresentativeView | null
  /** 정렬까지 끝난 목록 — 위젯은 그리기만 한다. */
  schedule: ScheduleRowView[]
  /** 남은 것의 총합. **동기화 실패 캐릭터는 빼고** 센다(모르는 것을 더하지 않는다). */
  scheduleTotal: number
  profit: WeeklyProfitView
  topItem: TopItemView | null
  /** 이번 주 가격 미입력 드롭 건수 — 위젯 7의 값이라 위젯 4 안에 넣지 않는다([[ADR-146]] 정정 5). */
  unpricedCount: number
  /**
   * 그중 앞 몇 건 — 2x2 타일이 **이름**을 보여 준다. 「값을 적어야지」보다 「그 연마석 얼마에
   * 팔았지」가 손을 움직이는 문장이라, 건수만으로는 그 문장을 만들 수 없다.
   *
   * 순서는 스토어가 준 순서 그대로다(`period_key DESC, ocid, boss, difficulty, drop_index`) —
   * 여기서 다시 정렬하면 «무엇 기준으로 앞 셋인가» 라는 주장이 생기는데, 미입력 건에는 비교할
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
  // 「값을 기다리는 것」의 정의는 `priceState === undefined` 하나다 — `'excluded'`(기록 안 함)는
  // 사용자가 «값을 매기지 않기로» 정한 것이라 기다리는 건이 아니다(파일 머리 「이번 주」 절).
  const unpriced = weeklyDrops.filter((record) => record.priceState === undefined)

  return {
    representative: buildRepresentative(input),
    schedule,
    scheduleTotal: schedule
      .filter((row) => !row.hasSyncIssue)
      .reduce((sum, row) => sum + row.remainingTotal, 0),
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

  // 이름 없이 카드를 그릴 수 없다 — ocid 는 사용자에게 뜻이 없는 값이라 대신 넣지 않는다
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

function buildScheduleRows(input: TodayViewModelInput): ScheduleRowView[] {
  const contentByOcid = new Map(input.contentCharacters.map((view) => [view.ocid, view]))
  const bossByOcid = new Map(input.bossCharacters.map((view) => [view.ocid, view]))

  // 두 스토어의 합집합이다 — 한쪽에만 있는 캐릭터를 버리면 카드가 통째로 사라진다(`tracked-order`
  // 가 «순서를 정하는 함수가 목록의 크기를 바꾸지 않는다» 로 적어 둔 것과 같은 판단).
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

    // «남은 것» = 셀 수 있는 항목 − 완료한 항목. `unmeasurable`(무릉도장)은 분모에서 이미 빠져
    // 있으므로 여기서 따로 거르지 않는다.
    const daily = dailyContentProgress(content?.dailyContents ?? [])
    const weekly = weeklyContentProgress(content?.weeklyContents ?? [])
    const dailyQuest = daily.total - daily.completed
    const weeklyQuest = weekly.total - weekly.completed
    const weeklyBoss = countRemainingBosses(input, boss, 'weekly')
    const monthlyBoss = countRemainingBosses(input, boss, 'monthly')

    return {
      ocid,
      characterName: content?.characterName ?? boss?.characterName ?? '',
      imageUrl: content?.imageUrl ?? boss?.imageUrl ?? null,
      dailyQuest,
      weeklyQuest,
      weeklyBoss,
      monthlyBoss,
      remainingTotal: dailyQuest + weeklyQuest + weeklyBoss + monthlyBoss,
      hasSyncIssue: input.characterIssues[ocid] !== undefined,
    }
  })

  // 관리 순서를 먼저 얹고(동수의 기준이 그것이다) 남은 개수로 다시 세운다. 동순위는 인덱스로
  // 가른다 — 정렬의 안정성에 기대지 않고 이 파일의 계약으로 둔다(`tracked-order` 와 같은 이유).
  return orderByTracked(rows, input.orderedOcids)
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      // 실패는 남은 개수를 «모르는» 것이라 언제나 맨 아래다([[ADR-146]] 정정 12) — 위로 올리면
      // «제일 밀린 캐릭터» 자리를 모르는 값이 거짓으로 차지한다.
      if (a.row.hasSyncIssue !== b.row.hasSyncIssue) return a.row.hasSyncIssue ? 1 : -1
      if (a.row.remainingTotal !== b.row.remainingTotal) return b.row.remainingTotal - a.row.remainingTotal
      return a.index - b.index
    })
    .map((entry) => entry.row)
}

function countRemainingBosses(
  input: TodayViewModelInput,
  boss: BossCharacterView | undefined,
  cycle: BossCycle,
): number {
  if (boss === undefined) return 0
  return displayedBosses(boss, cycle, input.trackingMode, input.manualTrackedByOcid).filter(
    (matched) => !matched.isComplete,
  ).length
}

function buildProfit(
  input: TodayViewModelInput,
  weeklyPeriodKey: string,
): Pick<TodayViewModel, 'profit' | 'crystalLimits'> {
  // 보스 수익 스토어는 사용자가 보던 (탭, 기간)을 들고 있다 — 이번 주 주간 행만 남긴다.
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
    // 총액을 다시 세는 것이 아니라 **가르는** 것이다 — `groupTotalMeso` 가 더하는 세 항 중 주차별
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
 * 저장 행 하나 → 위젯이 읽는 모양. **금액은 싣지 않는다** — 값이 있는 쪽만 그것을 얹는다.
 *
 * 캐릭터 이름이 옵셔널인 것이 요점이다(프로필 캐시에 있을 때만 — ocid 를 대신 넣지 않는다).
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
  // 가격을 아직 안 적은 기록은 순위에 넣지 않는다([[ADR-146]] 결정 9) — 값을 모르는 것을 가장 싼
  // 것으로 단정하는 일이다. 합산(`dropPayoutMeso`)이 미입력을 0으로 접는 것과 **다른 문제**다:
  // 합산은 «더할 것이 없다» 이지만 순위는 «비교했다» 를 주장한다.
  const priced = records
    .filter((record) => record.priceState === 'entered' && typeof record.priceMeso === 'number')
    .map(
      (record): PricedDropView => ({
        ...toDropView(record, profilesByOcid),
        priceMeso: record.priceMeso as number,
      }),
    )
    .sort((a, b) => b.priceMeso - a.priceMeso)
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
    // 히스토리 화면과 같은 라벨 함수다 — 두 자리가 같은 주를 다르게 부르면 안 된다.
    periodLabel: formatBossProfitPeriodLabel(summary.cycle, summary.periodKey, now).primary,
    itemsLabel: formatValuableDroughtItems(summary.records),
  }
}

/**
 * 다음 초기화까지 남은 시간.
 *
 * 세 값 모두 **기존 KST 계산을 조합**한다 — 오프셋 상수를 여기서 다시 선언하면 리셋 시각의 진실이
 * 둘이 된다. 일간은 오늘의 KST 날짜 키가 가리키는 자정 + 24h, 주간은 «가장 최근 목요일 리셋» + 7일,
 * 월간은 다음 달 기간 키의 시작(1일 00:00 KST, [[ADR-030]])이다.
 */
function buildResets(now: Date): ResetCountdownView {
  const nowMs = now.getTime()
  const countdown = (atMs: number, periodMs: number): ResetCountdown => ({
    atMs,
    remainingMs: Math.max(0, atMs - nowMs),
    periodMs,
  })

  const monthlyPeriodKey = getCurrentBossProfitPeriod('monthly', now).periodKey
  // 이번 달의 두 경계 — 길이는 그 차이다(28~31일이라 상수로 둘 수 없다).
  const monthlyStartMs = getPeriodStartUtcMs(monthlyPeriodKey)
  const monthlyAtMs = getPeriodStartUtcMs(getAdjacentPeriodKey('monthly', monthlyPeriodKey, 'next'))

  return {
    daily: countdown(getPeriodStartUtcMs(getCurrentKstDateKey(now)) + DAY_MS, DAY_MS),
    weekly: countdown(getMostRecentWeeklyResetKst(now).getTime() + 7 * DAY_MS, 7 * DAY_MS),
    monthly: countdown(monthlyAtMs, monthlyAtMs - monthlyStartMs),
  }
}
