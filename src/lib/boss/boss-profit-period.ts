import type { BossCycle } from '../../types'
import { getMostRecentWeeklyResetKst } from '../scheduler/reset-clock'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 스케줄러 API(`date` 파라미터)로 조회 가능한 최소 날짜.
 *
 * 이 API 자체가 신규 도입돼 그 이전 데이터가 존재하지 않는 고정 하한선이다. 오늘 날짜 기준으로
 * 매일 밀려나는 롤링 윈도우가 아니므로 시간이 지나도 이 값을 다시 계산할 필요가 없다.
 */
export const MIN_SCHEDULER_DATE = '2026-07-01'

/**
 * 스케줄러 API `date` 파라미터가 실제로 받아들이는 롤링 조회 가능 일수(사용자 실측,
 * 2026-07-22. 오늘(2026-07-22) 기준 2026-07-08(오늘-14일)은 조회되지 않고 2026-07-09(오늘-13일)까지만
 * 조회된다). MIN_SCHEDULER_DATE(API 자체가 존재하기 시작한 고정 하한선)와는 별개로, 매일
 * 하루씩 앞으로 밀리는 제약이다.
 */
const ROLLING_QUERY_WINDOW_DAYS = 13

export interface BossProfitPeriod {
  periodKey: string // 저장/조회 시 unique key로 쓰이는 안정적인 문자열
  label: string // 화면 표시용 ("이번 주" | "이번 달")
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toKstWallClock(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS)
}

/**
 * 보스 수익 기록의 unique key(ocid+boss+difficulty+기간)에 쓰이는 기간.
 *
 * - weekly: 가장 최근 주간 리셋(KST 목요일 00:00, lib/scheduler/reset-clock)의 KST 날짜를 periodKey로 쓴다.
 * - monthly: 월간 보스(검은마법사)의 Nexon 서버 리셋 시각은 KST 기준 매월 1일 00:00 이다.
 */
export function getCurrentBossProfitPeriod(cycle: BossCycle, now: Date): BossProfitPeriod {
  if (cycle === 'weekly') {
    const resetKst = toKstWallClock(getMostRecentWeeklyResetKst(now))
    const periodKey = `${resetKst.getUTCFullYear()}-${pad(resetKst.getUTCMonth() + 1)}-${pad(resetKst.getUTCDate())}`
    return { periodKey, label: '이번 주' }
  }

  const nowKst = toKstWallClock(now)
  const periodKey = `${nowKst.getUTCFullYear()}-${pad(nowKst.getUTCMonth() + 1)}`
  return { periodKey, label: '이번 달' }
}

function parseWeeklyPeriodKey(periodKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = periodKey.split('-').map(Number)
  return { year, month, day }
}

function parseMonthlyPeriodKey(periodKey: string): { year: number; month: number } {
  const [year, month] = periodKey.split('-').map(Number)
  return { year, month }
}

function formatWeeklyPeriodKey(utcMs: number): string {
  const date = new Date(utcMs)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function formatMonthlyPeriodKey(year: number, month: number): string {
  return `${year}-${pad(month)}`
}

/** 한 칸 이동한 periodKey. weekly는 ±7일, monthly는 ±1개월. */
export function getAdjacentPeriodKey(
  cycle: BossCycle,
  periodKey: string,
  direction: 'prev' | 'next',
): string {
  const sign = direction === 'next' ? 1 : -1

  if (cycle === 'weekly') {
    const { year, month, day } = parseWeeklyPeriodKey(periodKey)
    const shiftedMs = Date.UTC(year, month - 1, day) + sign * 7 * 24 * 60 * 60 * 1000
    return formatWeeklyPeriodKey(shiftedMs)
  }

  const { year, month } = parseMonthlyPeriodKey(periodKey)
  const zeroBasedMonth = month - 1 + sign
  const shiftedYear = year + Math.floor(zeroBasedMonth / 12)
  const shiftedMonth = ((zeroBasedMonth % 12) + 12) % 12
  return formatMonthlyPeriodKey(shiftedYear, shiftedMonth + 1)
}

/**
 * periodKey 가 now 기준 현재 기간보다 미래가 아닌가.
 * true면 이 기간에서 next 방향 네비게이션 버튼을 비활성화해야 한다.
 */
export function isLatestPeriod(cycle: BossCycle, periodKey: string, now: Date): boolean {
  const currentPeriodKey = getCurrentBossProfitPeriod(cycle, now).periodKey
  return periodKey >= currentPeriodKey
}

/**
 * 이미 지난 기간인데도 그 안에 아직 진행 중인 주가 들어 있는가.
 *
 * 월간 탭에서 한 주가 달 경계를 걸칠 때만 참이다. 2026년 7월의 마지막 리셋은 7월 30일(목)이라
 * 그 주(7/30~8/5)는 "7월 5주차"이면서 8월 5일까지 이어진다. 8월 1일 00:00에 7월은 지난 달이
 * 되지만 그 주는 여전히 진행 중이므로, 7월 화면은 아직 "다 끝난 과거"가 아니다.
 *
 * weekly에서는 항상 거짓이다: 지난 주는 언제나 완전히 닫혀 있고, 진행 중인 주는 그 자체가
 * 최신 기간이라 isLatestPeriod가 이미 참이다.
 */
export function containsInProgressWeek(cycle: BossCycle, periodKey: string, now: Date): boolean {
  if (cycle !== 'monthly' || isLatestPeriod('monthly', periodKey, now)) {
    return false
  }
  return getWeeklyPeriodKeysInMonth(periodKey).includes(getCurrentBossProfitPeriod('weekly', now).periodKey)
}

/**
 * 이 기간을 화면에서 지금 새로고침(실시간 재조회)하는 것이 의미가 있는지.
 *
 * 헤더 동기화 상태 영역 노출과 당겨서 새로고침 활성 조건이 이 한 플래그를 공유한다. 갈라 두면
 * 버튼은 없는데 당기면 도는 상태가 생긴다.
 *
 * 기간 네비게이션 게이트(다음 기간 비활성)는 여전히 `isLatestPeriod` 다. 이 기간이 최신인가 와
 * 지금 재조회하면 숫자가 달라질 수 있는가 는 다른 질문이다.
 */
export function isPeriodRefreshable(cycle: BossCycle, periodKey: string, now: Date): boolean {
  return isLatestPeriod(cycle, periodKey, now) || containsInProgressWeek(cycle, periodKey, now)
}

export interface BossProfitPeriodLabel {
  primary: string // "이번 주" | "지난 주" | "이번 달" | "지난 달" | "{M}월 {N}주차" | "{YYYY}년 {M}월"
  secondary: string // weekly: "{M}월 {D}일 ~ {M}월 {D}일" (그 주의 시작~끝 날짜), monthly: "{YYYY}년 {M}월"primary와 무관하게 항상 정확한 날짜를 담는다
}

/**
 * monthPeriodKey(`YYYY-MM`)가 속한 달 안에 리셋(목요일)이 있는 weekly periodKey 목록. 오름차순이다.
 * "주가 두 달에 걸치면 그 주가 시작하는 목요일이 속한 달 기준"이라는 규칙은 이미 weekly periodKey 정의(리셋 목요일의
 * KST 날짜) 자체에 반영되어 있으므로, 이 함수는 단순히 그 달의 모든 목요일 날짜를 나열하면 된다.
 */
export function getWeeklyPeriodKeysInMonth(monthPeriodKey: string): string[] {
  const { year, month } = parseMonthlyPeriodKey(monthPeriodKey)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const result: string[] = []
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
    if (dayOfWeek === 4) {
      result.push(formatWeeklyPeriodKey(Date.UTC(year, month - 1, day)))
    }
  }
  return result
}

/** 기간 라벨. now 기준 최근 2개 기간(이번/지난)만 상대 표현을 쓰고, 그 이전은 절대 표현을 쓴다. */
export function formatBossProfitPeriodLabel(
  cycle: BossCycle,
  periodKey: string,
  now: Date,
): BossProfitPeriodLabel {
  const currentPeriodKey = getCurrentBossProfitPeriod(cycle, now).periodKey

  if (cycle === 'weekly') {
    const { year, month, day } = parseWeeklyPeriodKey(periodKey)
    const startMs = Date.UTC(year, month - 1, day)
    const endMs = startMs + 6 * 24 * 60 * 60 * 1000
    const end = new Date(endMs)
    const secondary = `${month}월 ${day}일 ~ ${end.getUTCMonth() + 1}월 ${end.getUTCDate()}일`

    const prevPeriodKey = getAdjacentPeriodKey('weekly', currentPeriodKey, 'prev')
    if (periodKey === currentPeriodKey) {
      return { primary: '이번 주', secondary }
    }
    if (periodKey === prevPeriodKey) {
      return { primary: '지난 주', secondary }
    }

    const weekKeysInMonth = getWeeklyPeriodKeysInMonth(`${year}-${pad(month)}`)
    const weekIndex = weekKeysInMonth.indexOf(periodKey)
    return { primary: `${month}월 ${weekIndex + 1}주차`, secondary }
  }

  const { year, month } = parseMonthlyPeriodKey(periodKey)
  const secondary = `${year}년 ${month}월`

  const prevPeriodKey = getAdjacentPeriodKey('monthly', currentPeriodKey, 'prev')
  if (periodKey === currentPeriodKey) {
    return { primary: '이번 달', secondary }
  }
  if (periodKey === prevPeriodKey) {
    return { primary: '지난 달', secondary }
  }

  return { primary: secondary, secondary }
}

/**
 * 그 기간에 **든 날짜 전부**(KST `YYYY-MM-DD`, 오름차순).
 *
 * `getBackfillQueryDate` 는 기간당 **한 날짜**만 낸다(그 기간이 가장 온전히 반영되는 시점). 그것으로는
 * 그 기간에 잡았다 까지만 알 수 있고 **며칟날인지는 안 나온다**. 일간 해상도는 날짜들을 훑어
 * 미완료 → 완료 로 뒤집힌 지점을 찾아야 나오므로, 이 함수가 그 훑을 목록을 만든다.
 *
 * 주간은 리셋 목요일부터 이레, 월간은 1일부터 그 달 마지막 날까지다. **달을 넘는 주도 그냥 이어진다**.
 * `Date.UTC` 로 더하므로 월말 경계를 따로 다루지 않는다.
 */
export function getPeriodDateKeys(cycle: BossCycle, periodKey: string): string[] {
  if (cycle === 'weekly') {
    const { year, month, day } = parseWeeklyPeriodKey(periodKey)
    const startMs = Date.UTC(year, month - 1, day)
    return Array.from({ length: 7 }, (_, index) =>
      formatWeeklyPeriodKey(startMs + index * 24 * 60 * 60 * 1000),
    )
  }

  const { year, month } = parseMonthlyPeriodKey(periodKey)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from({ length: daysInMonth }, (_, index) =>
    formatWeeklyPeriodKey(Date.UTC(year, month - 1, index + 1)),
  )
}

/**
 * 과거 기간 백필에 쓸 조회 날짜(`YYYY-MM-DD`).
 * 그 기간의 완료 현황이 가장 온전히 반영되는 시점. 다음 리셋 직전(그 기간의 마지막 날). 을 쓴다.
 * weekly: periodKey(리셋 목요일) + 6일. monthly: periodKey가 속한 달의 마지막 날.
 */
export function getBackfillQueryDate(cycle: BossCycle, periodKey: string): string {
  if (cycle === 'weekly') {
    const { year, month, day } = parseWeeklyPeriodKey(periodKey)
    const endMs = Date.UTC(year, month - 1, day) + 6 * 24 * 60 * 60 * 1000
    return formatWeeklyPeriodKey(endMs)
  }

  const { year, month } = parseMonthlyPeriodKey(periodKey)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${pad(month)}-${pad(lastDay)}`
}

/**
 * now(KST) 기준으로 스케줄러 API 가 실제로 조회 가능한 최소 날짜(`YYYY-MM-DD`).
 * ROLLING_QUERY_WINDOW_DAYS만큼 매일 앞으로 밀리는 하한선이다.
 */
export function getMinQueryableDate(now: Date): string {
  const kstWallClock = toKstWallClock(now)
  const shiftedMs = Date.UTC(
    kstWallClock.getUTCFullYear(),
    kstWallClock.getUTCMonth(),
    kstWallClock.getUTCDate() - ROLLING_QUERY_WINDOW_DAYS,
  )
  return formatWeeklyPeriodKey(shiftedMs)
}

/**
 * now(KST) 기준으로 스케줄러 API가 받아들이는 **최대** 날짜(YYYY-MM-DD). 오늘−1일이다
 * (실측).
 *
 * `date=오늘` 과 미래 날짜는 400 `OPENAPI00004` 다. `오늘−1일` 은 **집계가 끝나기 전(KST 새벽)엔
 * 400 `OPENAPI00009`** 지만 그 뒤에는 정상 조회된다. 그래서 상한을 오늘−2일로 낮추지 않는다.
 * 낮추면 집계가 끝난 목요일 아침에 볼 수 있는 지난 주를 우리가 스스로 가리게 된다. 새벽의
 * 00009는 실패가 아니라 `notCollected` 상태로 흡수한다(resolvePeriodDataState).
 */
export function getMaxQueryableDate(now: Date): string {
  const kstWallClock = toKstWallClock(now)
  const shiftedMs = Date.UTC(
    kstWallClock.getUTCFullYear(),
    kstWallClock.getUTCMonth(),
    kstWallClock.getUTCDate() - 1,
  )
  return formatWeeklyPeriodKey(shiftedMs)
}

/**
 * 이 기간(cycle, periodKey)을 지금 백필로 조회할 수 있는가. 캐시된 기록이
 * 이미 있는지와는 무관하게, 순수하게 "지금 API를 호출하면 성공할 수 있는가"만 본다.
 *
 * 하한 둘(API가 존재하기 시작한 고정 하한선 MIN_SCHEDULER_DATE, 매일 밀리는 롤링 하한선
 * getMinQueryableDate) 중 더 늦은 쪽과, 상한 하나(getMaxQueryableDate = 오늘−1일) 사이여야 한다.
 * **상한은에서 추가됐다**. 전에는 하한만 봐서 현재 기간(조회일이 미래)에도
 * "조회 가능"이라 답했고, 그 답을 믿고 호출하면 400이었다.
 *
 * 주의: 이 함수는 "백필 가능성"만 답한다. **현재 기간을 볼 수 있는가는 다른 질문이다**. 그건
 * 실시간 동기화가 담당하므로 resolvePeriodDataState의 isCurrentPeriod로 갈라 다룬다.
 */
export function isPeriodQueryable(cycle: BossCycle, periodKey: string, now: Date): boolean {
  const date = getBackfillQueryDate(cycle, periodKey)
  const rollingFloor = getMinQueryableDate(now)
  const effectiveFloor = rollingFloor > MIN_SCHEDULER_DATE ? rollingFloor : MIN_SCHEDULER_DATE
  return date >= effectiveFloor && date <= getMaxQueryableDate(now)
}

/**
 * 한 기간을 조회하려 한 결과 중 **영속되지 않는** 것(이번 세션의 시도 결과).
 *
 * `outOfRange` 가 여기 있는 이유: 우리가 계산한 조회 구간 안인데도 API가 400 `OPENAPI00004` 로
 * 거부하는 경우가 있다. 그 날짜에 이 캐릭터가 지금 월드에 없었거나(월드 리프) 휴면이었던 경우다
 * (실측, 구분 불가). 날짜만 보면 알 수 없으므로 **응답이 알려준 사실**로
 * 상태를 정한다. 다만 아직 영속하지 않으므로 다음 방문에 한 번 더 호출한다(후속 과제).
 */
export type PeriodQueryOutcome = 'notCollected' | 'outOfRange' | 'failed'

/**
 * 한 (캐릭터, 기간)의 표시 상태.
 *
 * | 상태 | 뜻 | 사용자 행동 |
 * |---|---|---|
 * | recorded | 기록이 있다 | — |
 * | confirmedEmpty | 조회해서 0건을 확인했다 | 없음 |
 * | notChecked | 조회 가능한데 아직 조회하지 않았다 | 조회 |
 * | notCollected | 아직 집계 전(OPENAPI00009) | 없음(나중에 자동) |
 * | outOfRange | 조회 구간 밖(윈도우 밖·월드 이전 이전) | 없음 |
 * | failed | 그 외 실패 | 다시 시도 |
 */
export type PeriodDataState =
  | 'recorded'
  | 'confirmedEmpty'
  | 'notChecked'
  | 'notCollected'
  | 'outOfRange'
  | 'failed'

export interface PeriodDataStateInput {
  /** 그 tab의 "지금" 기간인가. 실시간 동기화가 원천이라 백필 조회 가능성을 보지 않는다. */
  isCurrentPeriod: boolean
  hasRecords: boolean
  /** boss_profit_period_checks에 확인 기록이 있는가 = **조회해서 확인했다**(조회 불가로 굳힌 것이 아니다). */
  isChecked: boolean
  isQueryable: boolean
  lastOutcome: PeriodQueryOutcome | null
}

/**
 * 화면과 백필이 같은 값을 공유하게 하는 한 자리 판정. 화면이 `isPeriodQueryable`
 * 하나로, 백필은 target 별로 따로 판정하면 월간 탭에서 조회 불가 와 불러오지 못했습니다 가
 * 동시에 뜨는 경로가 생긴다.
 */
export function resolvePeriodDataState(input: PeriodDataStateInput): PeriodDataState {
  // 현재 기간은 백필 대상이 아니다. 조회일이 미래라 isQueryable이 false지만 "조회 불가"가 아니라
  // 실시간 동기화가 방금 알려준 사실이다. 처치가 0건이면 그것이 확정된 빈 상태다.
  if (input.isCurrentPeriod) {
    return input.hasRecords ? 'recorded' : 'confirmedEmpty'
  }
  if (input.hasRecords) {
    return 'recorded'
  }
  // 확인 기록은 "조회해서 0건을 봤다"만 의미한다. 조회 불가 기간을 checked로
  // 굳히지 않도록 store를 함께 바꿨다. 그래서 이 분기가 시간이 지나도 outOfRange로 격하되지 않는다.
  if (input.isChecked) {
    return 'confirmedEmpty'
  }
  // 조회 자체가 불가능한 기간의 시도 결과는 신뢰하지 않는다(애초에 호출하지 않으므로 outcome이 남지 않는다).
  if (!input.isQueryable) {
    return 'outOfRange'
  }
  if (input.lastOutcome !== null) {
    return input.lastOutcome
  }
  return 'notChecked'
}

/**
 * periodKey에서 한 단계 더 과거로 이동하면 MIN_SCHEDULER_DATE 이전이라 백필 자체가 불가능한
 * 기간에 도달하는지 확인한다. true면 이 기간에서 prev 방향 네비게이션 버튼을 비활성화해야 한다.
 * (weekly에 적용하면 MIN_SCHEDULER_DATE 이전 주로 이동을 막고, monthly에 적용하면 그 달이
 * 통째로 MIN_SCHEDULER_DATE 이전인 달로 이동을 막는다. 이미 진입한 기간 자체가 부분적으로만
 * 조회 불가능한 경우(예: 2026-07월 첫 며칠만 데이터 없음, 혹은 롤링 윈도우를 벗어난 경우)는
 * 막지 않는다. 이미 캐시된 기록이 있을 수 있으므로 isPeriodQueryable과 달리 여기서는 항상
 * MIN_SCHEDULER_DATE라는 고정 하한선만 본다. 롤링 윈도우로 인해 조회 자체가 안 되는 기간은
 * loadPeriod/backfillTarget이 API 호출만 건너뛰고("조회 불가" 표시), 네비게이션 자체는 막지
 * 않는다.)
 */
export function isEarliestNavigablePeriod(cycle: BossCycle, periodKey: string): boolean {
  const prevPeriodKey = getAdjacentPeriodKey(cycle, periodKey, 'prev')
  return getBackfillQueryDate(cycle, prevPeriodKey) < MIN_SCHEDULER_DATE
}

/**
 * 캐릭터별 상태를 화면(기간) 하나로 접은 상태. 캐릭터가 여러 명이면 상태가 섞이는데, 그때
 * **불확실을 확정으로 위장하지 않는다**. `confirmedEmpty`("0건 확정")는 **전원이** 확정했을 때만
 * 말한다. 하나라도 모르는 캐릭터가 있으면 그 사실을 우선한다(error-resilience 원칙 2).
 *
 * 우선순위: recorded > failed > notCollected > notChecked > outOfRange > confirmedEmpty
 * - recorded가 최상위인 이유: 보여줄 기록이 있으면 그것이 화면의 주인이고, 나머지 캐릭터의
 *  미확인은 목록 안 표식으로 다룬다.
 * - failed·notChecked가 앞에 오는 이유: **사용자가 할 수 있는 행동이 있는 상태**라 묻히면 안 된다.
 */
export function resolvePagePeriodState(states: PeriodDataState[]): PeriodDataState {
  if (states.length === 0) {
    return 'confirmedEmpty'
  }
  const priority: PeriodDataState[] = [
    'recorded',
    'failed',
    'notCollected',
    'notChecked',
    'outOfRange',
    'confirmedEmpty',
  ]
  return priority.find((candidate) => states.includes(candidate)) ?? 'confirmedEmpty'
}
