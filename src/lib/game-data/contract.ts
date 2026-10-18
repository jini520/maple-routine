/**
 * 서버 응답 칸의 계약 검사가 같이 쓰는 조각. 칸마다 `parse` 가 하나이고 어긴 값은 줄이 아니라 표 전체가 `null` 이다.
 *
 * 줄 하나만 버리면 그 줄이 화면에서 조용히 사라지고 기록이 설 자리를 잃는다. 표 전체를 버리면 들고 있던 표가
 * 그대로 선다. 선택 칸은 `null` 과 빠짐을 같은 것으로 읽어 코드에서는 빠진 칸으로 만든다.
 */
export type Row = Record<string, unknown>

export function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

export function isInteger(value: unknown): value is number {
  return Number.isInteger(value)
}

export function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0
}

export function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

const PERIOD_TEXT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/

/** 기간 글자. KST `YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm`. */
export function isPeriodText(value: unknown): value is string {
  return typeof value === 'string' && PERIOD_TEXT.test(value)
}

/** 선택 칸. `null` · 빠짐은 `undefined`, 값이 있으면 검사를 통과해야 하고 어기면 `false`. */
export function optional<T>(value: unknown, is: (value: unknown) => value is T): T | undefined | false {
  if (value === null || value === undefined) return undefined
  return is(value) ? value : false
}

/** 글자 집합 중 하나인가. ENUM 칸에 쓴다. */
export function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return (values as readonly unknown[]).includes(value)
}

/** 칸 맨 위의 `updatedAt`. `null` 은 서버에서 받은 적 없는 사본이다. 글자도 `null` 도 아니면 `false`. */
export function updatedAtOf(row: Row): string | null | false {
  return row.updatedAt === null || typeof row.updatedAt === 'string' ? row.updatedAt : false
}

/**
 * 배열의 줄마다 `toRow`. 배열이 아니거나 줄 하나라도 어기면 `null`.
 *
 * 빈 배열도 `null` 이다. 비어 있는 표로 덮으면 그 표 없이 화면이 선다. 비어도 되는 표는 `allowEmpty` 로 푼다.
 */
export function rowsOf<T>(
  value: unknown,
  toRow: (row: Row) => T | null,
  options: { allowEmpty?: boolean } = {},
): T[] | null {
  if (!Array.isArray(value)) return null
  if (value.length === 0 && options.allowEmpty !== true) return null
  const rows: T[] = []
  for (const raw of value) {
    if (!isRow(raw)) return null
    const row = toRow(raw)
    if (row === null) return null
    rows.push(row)
  }
  return rows
}

/** 같은 key 가 둘이면 거짓. */
export function uniqueBy<T>(items: readonly T[], keyOf: (item: T) => string): boolean {
  return new Set(items.map(keyOf)).size === items.length
}

/** `undefined` 인 칸을 뺀 줄. 선택 칸이 빠진 모양으로 선다. */
export function compact<T extends object>(row: T): T {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined) out[key] = value
  }
  return out as T
}
