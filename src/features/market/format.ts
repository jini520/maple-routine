/**
 * MASPI 화면과 today 위젯의 표기. 값은 서버가 계산해 주고 여기서는 글자와 색, 기간 자르기만 한다.
 *
 * 부호는 ASCII 하이픈 `-` 이다. 시세 화면의 지수 · 전일 대비가 같은 꼴로 서야 줄끼리 자리가 맞는다.
 */
import { shiftDateKey } from '../../lib/calendar'
import { formatMesoCompact } from '../../lib/cashbook/meso-compact'

/** 등락의 색. 오르면 빨강 · 내리면 파랑 · 같으면 회색 */
export type MarketTone = 'rise' | 'fall' | 'flat'

export const MARKET_PERIODS = ['7일', '30일', '3개월', '6개월', '1년'] as const
export type MarketPeriod = (typeof MARKET_PERIODS)[number]

/** 거꾸로 세는 길이. 날은 그날을 넣어 세고, 달은 같은 날짜의 다음 날부터다. */
const PERIOD_SPANS: Record<MarketPeriod, { days: number } | { months: number }> = {
  '7일': { days: 7 },
  '30일': { days: 30 },
  '3개월': { months: 3 },
  '6개월': { months: 6 },
  '1년': { months: 12 },
}

/** 천 단위 쉼표. 기기 언어에 따라 갈리지 않게 손으로 넣는다. */
function withCommas(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** `9,082.30`. 값이 없으면 `0.00` */
export function formatIndex(value: number | null): string {
  const [whole, fraction] = Math.abs(value ?? 0).toFixed(2).split('.')
  return `${(value ?? 0) < 0 ? '-' : ''}${withCommas(whole)}.${fraction}`
}

/** MASPI 카드의 전일 대비. `+36.70` · `-24.82`, 같거나 없으면 `0.00` */
export function formatIndexSigned(change: number | null): string {
  const tone = toneOf(change)
  const magnitude = formatIndex(Math.abs(change ?? 0))
  return tone === 'rise' ? `+${magnitude}` : tone === 'fall' ? `-${magnitude}` : magnitude
}

/** today 위젯의 전일 대비. `▲ 36.70` · `▼ 24.82`, 같거나 없으면 화살표 없이 `0.00` */
export function formatIndexArrow(change: number | null): string {
  const tone = toneOf(change)
  const magnitude = formatIndex(Math.abs(change ?? 0))
  return tone === 'rise' ? `▲ ${magnitude}` : tone === 'fall' ? `▼ ${magnitude}` : magnitude
}

/** 아이템의 전일 대비(%). `+3.2%` · `-5.0%` · `0.0%`. 앞 날이 없으면 `0.0%` */
export function formatChangePct(changePct: number | null): string {
  const magnitude = `${Math.abs(changePct ?? 0).toFixed(1)}%`
  const tone = toneOf(changePct)
  return tone === 'rise' ? `+${magnitude}` : tone === 'fall' ? `-${magnitude}` : magnitude
}

export function toneOf(change: number | null): MarketTone {
  if (change === null || change === 0) return 'flat'
  return change > 0 ? 'rise' : 'fall'
}

/** 꺾은선의 색. 보이는 기간의 처음과 끝을 견준다. 점이 둘 미만이면 회색 */
export function trendOf(values: readonly number[]): MarketTone {
  if (values.length < 2) return 'flat'
  return toneOf(values[values.length - 1] - values[0])
}

/**
 * `26.89억 ~ 28.78억`. 범위는 그날 판 사람 절반이 판 25% ~ 75% 지점이다.
 * 억 · 만을 다 적으면 목록 줄에서 두 줄로 접혀, 통계 · 계산기와 같은 짧은 금액(억 소수 둘째 자리)으로 적는다.
 */
export function formatMarketRange(low: number, high: number): string {
  return `${formatMesoCompact(low)} ~ ${formatMesoCompact(high)}`
}

/** `11/14 기준`. 값의 날짜이고 받은 시각이 아니다. 날짜가 없으면 빈 글자 */
export function formatBasisDate(date: string | null): string {
  if (date === null) return ''
  const [, month, day] = date.split('-').map(Number)
  return `${month}/${day} 기준`
}

/** 달을 옮긴 날짜. 옮긴 달에 그 날이 없으면 그 달의 마지막 날이다(5/31 의 석 달 전은 2/28). */
function shiftMonths(dateKey: string, delta: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + delta, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

/**
 * 상세 그래프의 기간. 서버가 준 날마다 값에서 마지막 날부터 거꾸로 자른다. 날이 기간보다 적으면 있는 날만 준다.
 *
 * @param series 날짜 차례
 */
export function sliceSeries<T extends { date: string }>(series: readonly T[], period: MarketPeriod): T[] {
  const last = series.at(-1)
  if (last === undefined) return []
  const span = PERIOD_SPANS[period]
  const cutoff = 'days' in span ? shiftDateKey(last.date, -span.days) : shiftMonths(last.date, -span.months)
  return series.filter((point) => point.date > cutoff)
}

/** 눈금 간격의 앞자리. 2.5 를 넣으면 `1.725억` 처럼 눈금 글자가 길어지거나 반올림돼 정확하지 않다 */
const NICE_STEPS = [1, 2, 5, 10]

/**
 * 상세 그래프의 세로 범위와 눈금. 눈금이 넷쯤 되는 가장 작은 고른 간격을 찾고, 범위를 그 간격의 배수로 넓힌다.
 * 값이 모두 같으면 범위가 0 이라 그 값의 5% 를 위아래로 벌린다.
 */
export function niceScale(min: number, max: number): { lo: number; hi: number; step: number; ticks: number[] } {
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.05, 1)
    return niceScale(min - pad, max + pad)
  }
  const raw = (max - min) / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = (NICE_STEPS.find((nice) => nice * magnitude >= raw) ?? 10) * magnitude
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let tick = lo; tick <= hi + step / 2; tick += step) ticks.push(Math.round(tick))
  return { lo, hi, step, ticks }
}

const EOK = 100_000_000
const MAN = 10_000

/**
 * 상세 그래프의 눈금 글자. 억 이상은 간격이 갈리는 자리까지 소수로 적고(`1.75억`), 억 아래는 만으로 적는다(`7,600만`).
 *
 * @param step `niceScale` 의 간격
 */
export function formatTick(value: number, step: number): string {
  if (value === 0) return '0'
  if (Math.abs(value) >= EOK) {
    const decimals = Math.min(4, Math.max(0, Math.ceil(Math.log10(EOK / step))))
    return `${(value / EOK).toFixed(decimals)}억`
  }
  return `${withCommas(String(Math.round(value / MAN)))}만`
}
