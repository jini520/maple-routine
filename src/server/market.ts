/**
 * 우리 서버의 드롭 시세 공개 조회 셋. `notices.ts` 와 같은 자리, 같은 규칙이다.
 *
 * 서버는 하루 한 번 만든 응답을 그대로 주고 몸의 해시를 ETag 로 단다. 가진 응답의 ETag 를 보내면 바뀐 것이 없을 때
 * 몸 없이 304 로 끝난다. 실패는 `null` 하나로 나가고, 화면은 가진 값을 지킨다.
 *
 * 계약은 서버 저장소의 `modules/drop-market/market-publish.service.ts` 와 나눠 갖는다. 칸을 더할 때 양쪽을 함께 볼 것.
 */
const BASE_URL = 'https://mapleroutine.store/v1'

/** 얼마나 기다리나. 화면은 기기에 남긴 응답을 이미 그리고 있어 늦게 실패하는 것보다 빨리 실패하는 편이 낫다. */
const TIMEOUT_MS = 8_000

export type MarketGrade = 'many' | 'normal' | 'few'

export interface MaspiPoint {
  date: string
  value: number
}

/** 낸 값이 없으면 `date` · `close` 가 `null` 이고 `series` 가 비었다. */
export interface MaspiResponse {
  date: string | null
  close: number | null
  change: number | null
  series: MaspiPoint[]
}

/** 신뢰 시세 하나. 가격은 메소 정수다. */
export interface MarketEntry {
  itemKey: string
  ringLevel: number | null
  price: number
  /** 전일 대비(%). 앞 날이 없으면 `null` */
  changePct: number | null
  /** 범위. 7일 표가 모자라면 `null` */
  low: number | null
  high: number | null
  grade: MarketGrade
  /** 최근 30일 기준가 */
  spark: number[]
}

export interface MarketItemsResponse {
  date: string
  equipment: MarketEntry[]
  consumable: { world: string; items: MarketEntry[] }
}

export interface MarketSeriesPoint {
  date: string
  price: number
  /** 그날 띠. 범위가 없거나 잇지 않는 날은 `null` */
  low: number | null
  high: number | null
}

export interface MarketItemResponse extends Omit<MarketEntry, 'spark'> {
  date: string
  /** 최대 1년의 날마다 값. 날짜 차례 */
  series: MarketSeriesPoint[]
}

/** 상세 하나를 가리키는 값. 장비는 서버가 월드를 보지 않는다. */
export interface MarketItemTarget {
  itemKey: string
  ringLevel: number | null
  world: string
}

export type MarketFetch<T> =
  | { kind: 'not-modified' }
  /** 그 월드 · 아이템의 신뢰 시세가 없다(404) */
  | { kind: 'missing' }
  | { kind: 'ok'; etag: string | null; body: T }

const GRADES: readonly string[] = ['many', 'normal', 'few']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || isNumber(value)
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isGrade(value: unknown): value is MarketGrade {
  return typeof value === 'string' && GRADES.includes(value)
}

/** 시세 하나의 칸. `spark` 를 뺀 몫이라 목록과 상세가 함께 쓴다. */
function entryHead(value: Record<string, unknown>): Omit<MarketEntry, 'spark'> | null {
  if (
    typeof value.itemKey !== 'string' ||
    value.itemKey === '' ||
    !isNumberOrNull(value.ringLevel) ||
    !isNumber(value.price) ||
    !isNumberOrNull(value.changePct) ||
    !isNumberOrNull(value.low) ||
    !isNumberOrNull(value.high) ||
    !isGrade(value.grade)
  ) {
    return null
  }
  return {
    itemKey: value.itemKey,
    ringLevel: value.ringLevel,
    price: value.price,
    changePct: value.changePct,
    low: value.low,
    high: value.high,
    grade: value.grade,
  }
}

function toEntry(value: unknown): MarketEntry | null {
  if (!isRecord(value) || !Array.isArray(value.spark) || !value.spark.every(isNumber)) return null
  const head = entryHead(value)
  return head === null ? null : { ...head, spark: value.spark }
}

/** 어긴 줄은 빼고 남은 줄만. 배열이 아니면 `null` 이다. */
function entriesOf(value: unknown): MarketEntry[] | null {
  if (!Array.isArray(value)) return null
  return value.map(toEntry).filter((entry): entry is MarketEntry => entry !== null)
}

export function parseMaspi(value: unknown): MaspiResponse | null {
  if (!isRecord(value) || !Array.isArray(value.series)) return null
  if (!(value.date === null || isDate(value.date)) || !isNumberOrNull(value.close) || !isNumberOrNull(value.change)) return null
  const series = value.series.filter(
    (point): point is MaspiPoint => isRecord(point) && isDate(point.date) && isNumber(point.value),
  )
  return { date: value.date, close: value.close, change: value.change, series }
}

export function parseMarketItems(value: unknown): MarketItemsResponse | null {
  if (!isRecord(value) || !isDate(value.date) || !isRecord(value.consumable)) return null
  const equipment = entriesOf(value.equipment)
  const items = entriesOf(value.consumable.items)
  if (equipment === null || items === null || typeof value.consumable.world !== 'string') return null
  return { date: value.date, equipment, consumable: { world: value.consumable.world, items } }
}

export function parseMarketItem(value: unknown): MarketItemResponse | null {
  if (!isRecord(value) || !isDate(value.date) || !Array.isArray(value.series)) return null
  const head = entryHead(value)
  if (head === null) return null
  const series = value.series.filter(
    (point): point is MarketSeriesPoint =>
      isRecord(point) && isDate(point.date) && isNumber(point.price) && isNumberOrNull(point.low) && isNumberOrNull(point.high),
  )
  return { ...head, date: value.date, series }
}

async function fetchStored<T>(path: string, etag: string | null, parse: (value: unknown) => T | null): Promise<MarketFetch<T> | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      ...(etag === null ? {} : { headers: { 'If-None-Match': etag } }),
    })
    if (response.status === 304) return { kind: 'not-modified' }
    if (response.status === 404) return { kind: 'missing' }
    if (response.status !== 200) return null
    const body = parse(JSON.parse(await response.text()) as unknown)
    return body === null ? null : { kind: 'ok', etag: response.headers.get('etag'), body }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * MASPI. today 위젯과 MASPI 카드가 쓴다.
 *
 * @param etag 가진 응답의 ETag. 주면 바뀐 것이 없을 때 서버가 304 로 답한다
 */
export function fetchMaspi(etag: string | null): Promise<MarketFetch<MaspiResponse> | null> {
  return fetchStored('/market/maspi', etag, parseMaspi)
}

/** 장비(일반 거래권)와 그 월드의 소비 신뢰 시세. */
export function fetchMarketItems(world: string, etag: string | null): Promise<MarketFetch<MarketItemsResponse> | null> {
  return fetchStored(`/market/items?world=${encodeURIComponent(world)}`, etag, parseMarketItems)
}

/** 시세 하나와 최대 1년의 날마다 값. */
export function fetchMarketItem(target: MarketItemTarget, etag: string | null): Promise<MarketFetch<MarketItemResponse> | null> {
  const query = `ring=${target.ringLevel ?? ''}&world=${encodeURIComponent(target.world)}`
  return fetchStored(`/market/items/${encodeURIComponent(target.itemKey)}?${query}`, etag, parseMarketItem)
}
