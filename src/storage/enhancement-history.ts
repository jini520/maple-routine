/**
 * 강화 내역의 조회 원장과 옛 원본 표 읽기. 합계는 `enhancement-totals.ts` 가 든다.
 *
 * 조회 원장은 넥슨 계정 · 종류 · 날짜마다 한 줄이다. **어제 이전 날짜는 다시 안 부른다.** 그 날짜의 데이터는 변할 수
 * 없어서다.
 *
 * @see docs/persistence/sqlite.md `enhancement_history_checks`
 */
import type { EnhancementKind } from '../nexon/history/client'
import { getBossProfitDb } from './sqlite/db'

export interface EnhancementHistoryEntry {
  id: string
  kind: EnhancementKind
  dateKey: string
  createdAt: string
  characterName: string
  /** API 이름 원문. 화면은 이 글자를 보인다 */
  targetItem: string
  /** 장비 key. 장비 표에 없는 장비면 `null` 이다 */
  itemKey: string | null
  /** 스타포스는 응답에 없어 `null` */
  itemLevel: number | null
  /** 줄 원본. 못 풀면 `null` 이다 */
  payload: unknown
}

export interface EnhancementCheck {
  /** 1쪽의 커서. 그 날에 아무것도 안 했으면 `null` */
  nextCursor: string | null
  /** 어제 이전이라 다시 안 부른다 */
  settled: boolean
}

/** 조회 원장의 키. 종류와 날짜 둘이 한 칸이다. */
export function checkKey(kind: EnhancementKind, dateKey: string): string {
  return `${kind}|${dateKey}`
}

/** 못 풀면 `null`. 던지면 깨진 줄 하나가 그 날 지출을 통째로 죽인다. */
function parsePayload(raw: unknown): unknown {
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * 옛 원본 표의 줄. 합계로 옮기는 부팅 단계만 읽는다. 원본 표는 v1.0.14 에서 지운다.
 */
export async function loadEnhancementHistory(
  dateKeys: readonly string[],
): Promise<EnhancementHistoryEntry[]> {
  if (dateKeys.length === 0) return []
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT id, kind, date_key, created_at, character_name, target_item, item_key, item_level, payload
       FROM enhancement_history
      WHERE date_key IN (${dateKeys.map(() => '?').join(', ')})
      ORDER BY created_at`,
    [...dateKeys],
  )

  return (values ?? []).map((row) => ({
    id: String(row.id),
    kind: row.kind as EnhancementKind,
    dateKey: String(row.date_key),
    createdAt: String(row.created_at),
    characterName: String(row.character_name),
    targetItem: String(row.target_item),
    itemKey: typeof row.item_key === 'string' ? row.item_key : null,
    itemLevel: typeof row.item_level === 'number' ? row.item_level : null,
    payload: parsePayload(row.payload),
  }))
}

/** 옛 원본 표에 줄이 있는 날짜. 합계로 옮길 때 날짜마다 나눠 읽는다. */
export async function listEnhancementHistoryDates(): Promise<string[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query('SELECT DISTINCT date_key FROM enhancement_history ORDER BY date_key')
  return (values ?? []).map((row) => String(row.date_key))
}

/** 키는 `checkKey` 가 만든다. 없는 날짜는 **없는 대로** 둔다. 안 부른 것과 빈 날은 다르다. */
export async function loadEnhancementChecks(
  nexonAccountId: string,
  dateKeys: readonly string[],
): Promise<Map<string, EnhancementCheck>> {
  if (dateKeys.length === 0) return new Map()
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT enhancement_type, history_date, next_cursor, settled
       FROM enhancement_history_checks
      WHERE nexon_account_id = ? AND history_date IN (${dateKeys.map(() => '?').join(', ')})`,
    [nexonAccountId, ...dateKeys],
  )

  const checks = new Map<string, EnhancementCheck>()
  for (const row of values ?? []) {
    checks.set(checkKey(row.enhancement_type as EnhancementKind, String(row.history_date)), {
      nextCursor: typeof row.next_cursor === 'string' ? row.next_cursor : null,
      settled: row.settled === 1,
    })
  }
  return checks
}

/**
 * 한 칸을 적는다.
 *
 * @param nexonAccountId 조회한 자격의 넥슨 계정 id
 * @param settled 참이면 다시 안 부른다. **월드를 모르는 회차는 거짓으로 둔다** - 그 날짜의 지출을
 *   가릴 수가 없어 다음 회차가 다시 와야 한다.
 */
export async function markEnhancementChecked(
  nexonAccountId: string,
  kind: EnhancementKind,
  dateKey: string,
  nextCursor: string | null,
  settled: boolean,
  checkedAt: string,
): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(
    `INSERT INTO enhancement_history_checks (nexon_account_id, enhancement_type, history_date, next_cursor, settled, checked_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(nexon_account_id, enhancement_type, history_date) DO UPDATE SET
       next_cursor = excluded.next_cursor,
       settled = excluded.settled,
       checked_at = excluded.checked_at`,
    [nexonAccountId, kind, dateKey, nextCursor, settled ? 1 : 0, checkedAt],
  )
}
