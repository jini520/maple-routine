/**
 * 가계부의 **오케스트레이션** — 화면과 저장소 사이([[ADR-003]]·[[ADR-005]], [[ADR-094]] 결정 6).
 *
 * 화면은 `storage/` 를 직접 안 부른다(CLAUDE.md 의 CRITICAL 규칙). 여기서 하는 일은 셋이다:
 *
 * ① **행의 신원을 만든다** — `id` 와 `recordedAt`. 어댑터가 만들면 «같은 입력에 같은 SQL» 이
 *    깨져 테스트가 값을 못 박는다(`storage/income.ts` 파일 머리). 그래서 **불순한 자리를 여기
 *    하나로 모은다** — 이 파일이 `Math.random()` 과 `new Date()` 를 부르는 유일한 곳이다.
 * ② **시세를 기억한다** — 메포 지출을 저장할 때 그 시세를 다음 입력의 기본값으로 남긴다
 *    ([[ADR-166]] 결정 5).
 * ③ **여러 원천을 하루로 접는다** — 캘린더 칸이 받는 `CalendarAmounts` 를 만든다.
 */
import { withSqliteFallback } from '../boss-profit/sqlite-guards'
import type { CalendarAmounts, CalendarDayAmounts } from '../../lib/calendar-month'
import { pointToMeso } from '../../lib/spend-catalog'
import {
  deleteIncomeRecord,
  getIncomeRecordsBetween,
  insertIncomeRecord,
  updateIncomeRecord,
  type IncomeRecord,
} from '../../storage/income'
import { getLastPointRate, setLastPointRate } from '../../storage/last-point-rate'
import {
  deleteSpendRecord,
  getSpendRecordsBetween,
  insertSpendRecord,
  updateSpendRecord,
  type SpendRecord,
} from '../../storage/spend'

export type IncomeDraft = Omit<IncomeRecord, 'id' | 'recordedAt'>
export type SpendDraft = Omit<SpendRecord, 'id' | 'recordedAt'>

/**
 * 행 하나의 신원. **자연키가 없어서** 필요하다 — 손입력은 «같은 날 같은 것을 두 번» 이 정상이다
 * ([[ADR-170]] 결정 2).
 *
 * `crypto.randomUUID` 를 안 쓰는 이유는 Hermes 에 없기 때문이다. 충돌만 안 나면 되는 로컬 키라
 * 시각 + 난수로 충분하다 — 같은 밀리초에 두 번 저장하는 것은 손입력에서 일어나지 않고,
 * 그래도 뒤의 난수가 갈라 준다.
 */
function newRecordId(now: Date): string {
  return `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function recordIncome(draft: IncomeDraft, now: Date): Promise<void> {
  await insertIncomeRecord({ ...draft, id: newRecordId(now), recordedAt: now.toISOString() })
}

export async function recordSpend(draft: SpendDraft, now: Date): Promise<void> {
  await insertSpendRecord({ ...draft, id: newRecordId(now), recordedAt: now.toISOString() })
  // 저장이 성공한 뒤에만 기억한다 — 던진 입력의 시세를 다음 기본값으로 남기면 안 된다.
  if (draft.pointPer100mMeso !== null) {
    await setLastPointRate(draft.pointPer100mMeso)
  }
}

/**
 * 지출 한 건의 **메소 축 금액**([[ADR-166]] 정정 2 ①).
 *
 * 메소로 낸 것 + 메소마켓 시세로 환산한 메포다. **캐시는 안 든다** — 환산 자체를 안 하므로
 * (현금과 게임 재화의 교환비가 실제로 성립하는 경로가 운영정책 위반 거래다) 캐시 지출이 있는 날은
 * 이 값이 그날 지출의 전부가 아니다. 그 사실은 고른 날의 상세가 따로 말한다.
 */
export function spendMesoOf(record: SpendRecord): number {
  const meso = record.mesoAmount ?? 0
  if (record.pointAmount === null || record.pointPer100mMeso === null) return meso
  return meso + pointToMeso(record.pointAmount, record.pointPer100mMeso)
}

function addTo(
  amounts: Record<string, CalendarDayAmounts>,
  dateKey: string,
  delta: Partial<CalendarDayAmounts>,
): void {
  const current = amounts[dateKey] ?? { incomeMeso: 0, expenseMeso: 0 }
  amounts[dateKey] = {
    incomeMeso: current.incomeMeso + (delta.incomeMeso ?? 0),
    expenseMeso: current.expenseMeso + (delta.expenseMeso ?? 0),
  }
}

/**
 * 날짜 범위의 칸 금액 — **두 끝을 포함**한다.
 *
 * 지금 접는 원천은 **손입력 둘**뿐이다. 보스 수익은 아직 «며칟날» 을 모르므로(`period_key` 가
 * 주·월이다) 어느 칸에도 못 얹는다 — 그것을 만드는 일이 **#239** 이고, 그때 이 함수에 원천이
 * 하나 더 붙는다([[ADR-170]] 결정 4). **지우지 말고 채울 것.**
 *
 * 그동안 칸의 수익 줄은 보스를 뺀 값이라 **목요일의 큰 봉우리가 안 칠해진다** — 열지도가 수익만
 * 따르는 것이 맞는지는 그때 다시 본다(`docs/features/cashbook.md` 열린 질문).
 */
export async function loadCalendarAmounts(
  fromDateKey: string,
  toDateKey: string,
): Promise<CalendarAmounts> {
  // **읽기가 실패해도 화면이 죽지 않는다.** 커넥션이 stale 하거나(리로드 직후) 응답이 없으면
  // 빈 값으로 진행하고 다음 방문에서 다시 읽는다 — `features/boss-profit` 이 같은 결함으로
  // «불러오는 중…» 에 영영 멈췄던 자리라 그 처방을 그대로 쓴다(이름이 boss-profit 에 있을 뿐
  // 내용은 SQLite 일반이다). 여기서는 «칸이 0 으로 보인다» 가 그 대가다.
  const [incomes, spends] = await Promise.all([
    withSqliteFallback(getIncomeRecordsBetween(fromDateKey, toDateKey), []),
    withSqliteFallback(getSpendRecordsBetween(fromDateKey, toDateKey), []),
  ])

  const amounts: Record<string, CalendarDayAmounts> = {}
  for (const income of incomes) {
    addTo(amounts, income.earnedOn, { incomeMeso: income.mesoAmount })
  }
  for (const spend of spends) {
    addTo(amounts, spend.spentOn, { expenseMeso: spendMesoOf(spend) })
  }
  return amounts
}

/** 다음 입력의 시세 기본값([[ADR-166]] 결정 5). 화면이 `storage/` 를 직접 안 부르게 한 번 감싼다. */
export async function loadLastPointRate(): Promise<number | null> {
  return getLastPointRate().catch(() => null)
}


/**
 * 그날 목록의 **한 줄**([[ADR-171]] 결정 1).
 *
 * 수입과 지출은 테이블이 갈려 있어([[ADR-170]] 결정 2) 한 목록에 세우려면 어느 쪽인지를 들고
 * 다녀야 한다. 그 표식이 `kind` 이고, **그것이 곧 «손입력인가» 의 답**이기도 하다 — #239 가
 * 보스 수익을 칸에 얹으면 갈래가 하나 더 붙고, 그 줄은 여기서 못 고친다([[ADR-171]] 결정 5).
 */
export type DayRecord =
  | { kind: 'income'; record: IncomeRecord }
  | { kind: 'spend'; record: SpendRecord }

/**
 * 그날 적은 것 — **적은 순**이다.
 *
 * 금액순으로 정렬하지 않는 이유는 «방금 적은 것» 이 목록 어디로 튈지 모르기 때문이다. 방금 적은
 * 것이 맨 아래에 있으면 눈이 거기부터 간다.
 *
 * 읽기 실패는 **빈 값으로 진행한다** — 캘린더 칸과 같은 처방이다(`loadCalendarAmounts` 참조).
 * 한쪽만 실패하면 다른 쪽은 보인다.
 */
export async function loadDayRecords(dateKey: string): Promise<DayRecord[]> {
  const [incomes, spends] = await Promise.all([
    withSqliteFallback(getIncomeRecordsBetween(dateKey, dateKey), []),
    withSqliteFallback(getSpendRecordsBetween(dateKey, dateKey), []),
  ])

  const rows: DayRecord[] = [
    ...incomes.map((record): DayRecord => ({ kind: 'income', record })),
    ...spends.map((record): DayRecord => ({ kind: 'spend', record })),
  ]
  return rows.sort((left, right) => left.record.recordedAt.localeCompare(right.record.recordedAt))
}

/**
 * 줄에 적는 이름 — 없으면 **갈래 이름**이다([[ADR-171]] 결정 1).
 *
 * 직접 입력에서 사용처를 비우는 것은 정상이라(«비워 둬도 됩니다») 이름 없는 기록이 실제로 생긴다.
 * 그 줄을 비워 두면 «무엇인지 모르는 줄» 이 되는데, 갈래는 언제나 있으므로 그것을 쓴다.
 */
export function recordTitleOf(entry: DayRecord): string {
  return entry.record.item ?? entry.record.category
}

/** 줄의 **메소 축** 금액. 캐시는 환산을 안 하므로 0 이다([[ADR-166]] 정정 2 ①). */
export function recordMesoOf(entry: DayRecord): number {
  return entry.kind === 'income' ? entry.record.mesoAmount : spendMesoOf(entry.record)
}

/** 캐시로 낸 지출만 값을 준다 — 그 줄은 메소가 아니라 **원**으로 적힌다. */
export function recordCashOf(entry: DayRecord): number | null {
  return entry.kind === 'spend' ? entry.record.cashAmount : null
}

/**
 * 고치기 — `recordedAt` 은 안 바뀐다([[ADR-171]] 결정 4). 시세를 기억하는 순서는 넣을 때와 같다:
 * **성공한 뒤에만.**
 */
export async function editSpend(record: SpendRecord): Promise<void> {
  await updateSpendRecord(record)
  if (record.pointPer100mMeso !== null) {
    await setLastPointRate(record.pointPer100mMeso)
  }
}

export async function editIncome(record: IncomeRecord): Promise<void> {
  await updateIncomeRecord(record)
}

/** 지우기 — 갈래가 어느 테이블인지를 안다. */
export async function removeRecord(entry: DayRecord): Promise<void> {
  if (entry.kind === 'spend') {
    await deleteSpendRecord(entry.record.id)
    return
  }
  await deleteIncomeRecord(entry.record.id)
}
