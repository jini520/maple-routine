/**
 * 통계 화면의 집계. 가계부가 읽은 날짜별 줄(`loadMonthDays`)을 기간 · 캐릭터 · 갈래로 접는 순수 함수들.
 *
 * 금액은 가계부의 메소 축(`recordMesoOf`) 그대로다. 같은 기간의 가계부 합계와 통계 합계가 갈리지 않는다.
 */
import { dayTotalsOf, recordMesoOf, type DayRecord } from '../cashbook/records'
import { incomeCategoryNameOf, spendCategoryNameOf } from '../../lib/cashbook/categories'
import { spendGroupOf } from '../../lib/cashbook/spend-catalog'
import type { IncomeRecord } from '../../storage/income'
import { enhancementCategoryNameOf } from '../../lib/enhancement/categories'
import { bossAliasOf, findBoss } from '../../lib/boss/bosses'
import type { BossCycle, BossDifficulty } from '../../types'

export type DaysByDate = Readonly<Record<string, readonly DayRecord[]>>

/** 양끝을 포함하는 날짜 범위(KST `YYYY-MM-DD`). */
export interface StatsRange {
  from: string
  to: string
}

export interface StatsTotals {
  incomeMeso: number
  expenseMeso: number
  netMeso: number
}

export interface CharacterTotals extends StatsTotals {
  /** `ocid:…` 이거나, 캐릭터에 못 붙은 강화 기록이면 `name:…` */
  key: string
  ocid: string | null
  name: string
}

export interface CategoryTotal {
  key: string
  name: string
  meso: number
  /** 한 조각이 품은 갈래들(사냥 · 버프). 큰 순서이고 0 인 줄은 없다. 없으면 나눌 것이 없는 조각이다 */
  parts?: CategoryTotal[]
}

function isExpense(entry: DayRecord): boolean {
  return entry.kind === 'spend' || entry.kind === 'enhancement'
}

function entriesBetween(byDate: DaysByDate, range: StatsRange): DayRecord[] {
  return Object.entries(byDate)
    .filter(([dateKey]) => dateKey >= range.from && dateKey <= range.to)
    .flatMap(([, entries]) => entries)
}

/** 범위의 수입 · 지출 · 순 수익. */
export function totalsBetween(byDate: DaysByDate, range: StatsRange): StatsTotals {
  const { incomeMeso, expenseMeso } = dayTotalsOf(entriesBetween(byDate, range))
  return { incomeMeso, expenseMeso, netMeso: incomeMeso - expenseMeso }
}

/** 기간마다의 합계. 추이 카드의 막대다. */
export function totalsSeries(byDate: DaysByDate, ranges: readonly StatsRange[]): StatsTotals[] {
  return ranges.map((range) => totalsBetween(byDate, range))
}

/** 순 수익을 차례로 더한 값. 누적 카드의 선이다. */
export function cumulativeNet(series: readonly StatsTotals[]): number[] {
  let sum = 0
  return series.map((totals) => (sum += totals.netMeso))
}

/**
 * 캐릭터별 합계. 순 수익이 큰 순서다.
 *
 * 캐릭터를 고르지 않은 손입력은 안 든다. 강화 기록은 이름만 들어, 지금 이름과 같은 캐릭터가 있으면
 * 거기 붙고 없으면(개명 전 이름) 그 이름으로 따로 선다. 가계부가 강화 줄을 이름으로 묶는 것과 같다.
 */
export function characterTotalsBetween(byDate: DaysByDate, range: StatsRange): CharacterTotals[] {
  const entries = entriesBetween(byDate, range)
  const rows = new Map<string, CharacterTotals>()
  const keyByName = new Map<string, string>()

  const rowOf = (key: string, ocid: string | null, name: string): CharacterTotals => {
    const existing = rows.get(key)
    if (existing !== undefined) return existing
    const created = { key, ocid, name, incomeMeso: 0, expenseMeso: 0, netMeso: 0 }
    rows.set(key, created)
    return created
  }
  const add = (row: CharacterTotals, entry: DayRecord): void => {
    const meso = recordMesoOf(entry)
    if (isExpense(entry)) row.expenseMeso += meso
    else row.incomeMeso += meso
    row.netMeso = row.incomeMeso - row.expenseMeso
  }

  // 강화 줄이 이름으로 붙을 자리를 먼저 세운다. 줄 차례와 상관없이 같은 결과가 나와야 한다.
  for (const entry of entries) {
    if (entry.kind === 'enhancement') continue
    const ocid = entry.kind === 'income' || entry.kind === 'spend' ? entry.record.ocid : entry.ocid
    if (ocid === null) continue
    const key = `ocid:${ocid}`
    add(rowOf(key, ocid, entry.characterName), entry)
    if (entry.characterName !== '') keyByName.set(entry.characterName, key)
  }
  for (const entry of entries) {
    if (entry.kind !== 'enhancement') continue
    const key = keyByName.get(entry.characterName) ?? `name:${entry.characterName}`
    add(rows.get(key) ?? rowOf(key, null, entry.characterName), entry)
  }

  return [...rows.values()].sort((left, right) => right.netMeso - left.netMeso)
}

/** 결정석과 보스 드롭은 손입력 갈래 표에 없다. */
const BOSS_CRYSTAL = { key: 'boss_crystal', name: '보스 결정석' }
const BOSS_DROP = { key: 'boss_drop', name: '보스 드롭' }
/** 사냥과 솔 에르다 조각은 사냥이 낸 것이라 한 조각이고, 누르면 메소와 조각으로 나눈다 */
const HUNTING = { key: 'hunting', name: incomeCategoryNameOf('hunting') }
const HUNTING_MESO = { key: 'hunting_meso', name: '사냥 메소' }
const SOL_ERDA_FRAGMENT = { key: 'sol_erda_fragment', name: incomeCategoryNameOf('sol_erda_fragment') }
/** 버프 갈래의 항목이 선택 목록에서 묶음을 못 찾을 때의 줄 */
const UNKNOWN_BUFF_GROUP = { key: 'buff_etc', name: '기타' }

/** 사냥 기록에 적힌 조각 값. 조각 가격을 안 적었으면 합계에 없어 0 이다 */
function fragmentMesoOf(record: IncomeRecord): number {
  const hunt = record.hunt
  if (hunt === null || hunt.fragmentPrice === null) return 0
  return hunt.fragments * hunt.fragmentPrice
}

/** 한 줄이 드는 조각과, 그 조각 안에서 나눠 보일 줄들의 몫. */
function sliceOf(entry: DayRecord): { slice: { key: string; name: string }; parts: { key: string; name: string; meso: number }[] } {
  const meso = recordMesoOf(entry)
  const whole = (slice: { key: string; name: string }) => ({ slice, parts: [] })
  switch (entry.kind) {
    case 'bossCrystal':
      return whole(BOSS_CRYSTAL)
    case 'dropSale':
      return whole(BOSS_DROP)
    case 'enhancement':
      return whole({ key: `enhancement:${entry.category}`, name: enhancementCategoryNameOf(entry.category) })
    case 'income': {
      const { category } = entry.record
      if (category === 'sol_erda_fragment') return { slice: HUNTING, parts: [{ ...SOL_ERDA_FRAGMENT, meso }] }
      if (category === 'hunting') {
        const fragmentMeso = fragmentMesoOf(entry.record)
        return {
          slice: HUNTING,
          parts: [
            { ...HUNTING_MESO, meso: meso - fragmentMeso },
            { ...SOL_ERDA_FRAGMENT, meso: fragmentMeso },
          ],
        }
      }
      return whole({ key: category, name: incomeCategoryNameOf(category) })
    }
    case 'spend': {
      const { category, itemKey } = entry.record
      const slice = { key: category, name: spendCategoryNameOf(category) }
      if (category !== 'buff') return whole(slice)
      return { slice, parts: [{ ...(spendGroupOf(category, itemKey) ?? UNKNOWN_BUFF_GROUP), meso }] }
    }
  }
}

function sortedNonZero(totals: Iterable<CategoryTotal>): CategoryTotal[] {
  return [...totals].filter((total) => total.meso !== 0).sort((left, right) => right.meso - left.meso)
}

/** 수입 또는 지출의 갈래별 합계. 큰 순서이고 0 인 갈래는 없다. */
export function categoryTotalsBetween(
  byDate: DaysByDate,
  range: StatsRange,
  side: 'income' | 'expense',
): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>()
  const partsBySlice = new Map<string, Map<string, CategoryTotal>>()
  for (const entry of entriesBetween(byDate, range)) {
    if (isExpense(entry) !== (side === 'expense')) continue
    const { slice, parts } = sliceOf(entry)
    const total = totals.get(slice.key) ?? { ...slice, meso: 0 }
    total.meso += recordMesoOf(entry)
    totals.set(slice.key, total)
    if (parts.length === 0) continue
    const sliceParts = partsBySlice.get(slice.key) ?? new Map<string, CategoryTotal>()
    for (const part of parts) {
      const sum = sliceParts.get(part.key) ?? { key: part.key, name: part.name, meso: 0 }
      sum.meso += part.meso
      sliceParts.set(part.key, sum)
    }
    partsBySlice.set(slice.key, sliceParts)
  }
  for (const [key, parts] of partsBySlice) totals.get(key)!.parts = sortedNonZero(parts.values())
  return sortedNonZero(totals.values())
}

export interface BossTotal {
  /** 난이도별은 `보스 key|난이도`, 보스별은 보스 key */
  key: string
  bossKey: string
  /** 표의 `alias` */
  name: string
  /** 보스별로 합치면 `null` */
  difficulty: BossDifficulty | null
  meso: number
  /** 처치 횟수. 캐릭터마다 센다 */
  count: number
}

/**
 * 보스별 내 몫 결정석과 처치 횟수. 큰 순서다. `boss` 는 난이도를 합친다.
 *
 * 주간이면 월간 보스를 뺀다. 한 달에 한 번 잡는 보스가 주간 타일에 서면 그 주만 튄다.
 *
 * @param cycle 보고 있는 주기
 */
export function bossTotalsBetween(
  byDate: DaysByDate,
  range: StatsRange,
  mode: 'difficulty' | 'boss',
  cycle: BossCycle,
): BossTotal[] {
  const totals = new Map<string, BossTotal>()
  for (const entry of entriesBetween(byDate, range)) {
    if (entry.kind !== 'bossCrystal') continue
    for (const boss of entry.bosses) {
      if (cycle === 'weekly' && findBoss(boss.bossKey)?.cycle === 'monthly') continue
      const key = mode === 'boss' ? boss.bossKey : `${boss.bossKey}|${boss.difficulty}`
      const total = totals.get(key) ?? {
        key,
        bossKey: boss.bossKey,
        name: bossAliasOf(boss.bossKey, boss.bossName),
        difficulty: mode === 'boss' ? null : boss.difficulty,
        meso: 0,
        count: 0,
      }
      total.meso += boss.payoutMeso
      total.count += 1
      totals.set(key, total)
    }
  }
  return [...totals.values()].sort((left, right) => right.meso - left.meso)
}
