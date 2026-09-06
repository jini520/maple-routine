/**
 * 강화 사용 내역과 그 조회 원장.
 *
 * 계정 단위라 ocid 축이 없다. 하루가 큐브·스타포스·잠재 3콜이고 캐릭터 수를 안 곱한다.
 *
 * **어제 이전 날짜는 다시 안 부른다.** 그 날짜의 데이터는 변할 수 없어서다. 그래서 이 표가
 * 지워지면 되살릴 길이 0% 이고, 캐시 삭제의 `기록` 그룹에 든다.
 *
 * @see docs/persistence/sqlite.md `enhancement_history`
 */
import type { EnhancementHistoryRow, EnhancementKind } from '../nexon/history/client'
import { getBossProfitDb } from './sqlite/db'

export interface EnhancementHistoryEntry {
  id: string
  kind: EnhancementKind
  dateKey: string
  createdAt: string
  characterName: string
  targetItem: string
  /** 스타포스는 응답에 없어 `null`. 읽는 쪽이 같은 이름의 다른 행에서 찾는다 */
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

const COLUMNS = 8
/**
 * 한 문장에 넣을 줄 수. `COLUMNS` 를 곱한 값이 SQLite 의 기본 변수 상한(999)을 넘으면 안 된다.
 * 넘기면 조용히 던져 그 날짜가 통째로 안 들어간다.
 */
const CHUNK = 100

/** 조회 원장의 키. 종류와 날짜 둘이 한 칸이다. */
export function checkKey(kind: EnhancementKind, dateKey: string): string {
  return `${kind}|${dateKey}`
}

/**
 * 받은 줄을 넣는다. **겹치면 무시하고 갱신하지 않는다.**
 *
 * 같은 줄을 두 번 받는 것이 정상이다. 커서를 이어받다 겹치고, 오늘 날짜는 하루에 여러 번 부른다.
 * 갱신하면 쓸 일도 없이 디스크만 두드린다.
 */
export async function saveEnhancementHistory(
  kind: EnhancementKind,
  rows: readonly EnhancementHistoryRow[],
): Promise<void> {
  if (rows.length === 0) return
  const db = await getBossProfitDb()

  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK)
    const placeholders = chunk.map(() => `(${Array(COLUMNS).fill('?').join(', ')})`).join(', ')
    const values = chunk.flatMap((row) => [
      row.id,
      kind,
      row.dateKey,
      row.createdAt,
      row.characterName,
      row.targetItem,
      row.itemLevel,
      JSON.stringify(row.payload),
    ])
    await db.run(
      `INSERT OR IGNORE INTO enhancement_history
         (id, kind, date_key, created_at, character_name, target_item, item_level, payload)
       VALUES ${placeholders}`,
      values,
    )
  }
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

export async function loadEnhancementHistory(
  dateKeys: readonly string[],
): Promise<EnhancementHistoryEntry[]> {
  if (dateKeys.length === 0) return []
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT id, kind, date_key, created_at, character_name, target_item, item_level, payload
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
    itemLevel: typeof row.item_level === 'number' ? row.item_level : null,
    payload: parsePayload(row.payload),
  }))
}

/**
 * 이름에서 레벨로. **공백을 지운 이름**이 키다.
 *
 * 스타포스 응답에는 `item_level` 이 없다. 같은 장비를 큐브나 잠재로 만진 행이 그 값을 들고 있어
 * 표가 자라면 예전에 넣은 스타포스 행도 함께 값을 얻는다. `src/data/equipment-items.json` 이
 * 못 채운 자리를 여기가 받는다.
 */
export async function loadObservedItemLevels(): Promise<Map<string, number>> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT target_item, MAX(item_level) AS item_level
       FROM enhancement_history
      WHERE item_level IS NOT NULL AND target_item <> ''
      GROUP BY target_item`,
  )

  const levels = new Map<string, number>()
  for (const row of values ?? []) {
    if (typeof row.item_level === 'number') {
      levels.set(String(row.target_item).replace(/\s/g, ''), row.item_level)
    }
  }
  return levels
}

/**
 * 이미 넣어 둔 줄의 id.
 *
 * 오늘 날짜를 다시 부를 때 **아는 id 를 만나면 거기서 멈춘다.** 그 아래는 이미 들어 있다.
 * 안 그러면 하루가 1000줄을 넘길 때마다 그 날의 모든 쪽을 매번 다시 받는다.
 */
export async function loadKnownHistoryIds(
  kind: EnhancementKind,
  dateKey: string,
): Promise<Set<string>> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT id FROM enhancement_history WHERE kind = ? AND date_key = ?`,
    [kind, dateKey],
  )
  return new Set((values ?? []).map((row) => String(row.id)))
}

/** 키는 `checkKey` 가 만든다. 없는 날짜는 **없는 대로** 둔다. 안 부른 것과 빈 날은 다르다. */
export async function loadEnhancementChecks(
  dateKeys: readonly string[],
): Promise<Map<string, EnhancementCheck>> {
  if (dateKeys.length === 0) return new Map()
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT kind, date_key, next_cursor, settled
       FROM enhancement_history_checks
      WHERE date_key IN (${dateKeys.map(() => '?').join(', ')})`,
    [...dateKeys],
  )

  const checks = new Map<string, EnhancementCheck>()
  for (const row of values ?? []) {
    checks.set(checkKey(row.kind as EnhancementKind, String(row.date_key)), {
      nextCursor: typeof row.next_cursor === 'string' ? row.next_cursor : null,
      settled: row.settled === 1,
    })
  }
  return checks
}

/**
 * 한 칸을 적는다.
 *
 * @param settled 참이면 다시 안 부른다. **월드를 모르는 회차는 거짓으로 둔다** - 그 날짜의 지출을
 *   가릴 수가 없어 다음 회차가 다시 와야 한다.
 */
export async function markEnhancementChecked(
  kind: EnhancementKind,
  dateKey: string,
  nextCursor: string | null,
  settled: boolean,
  checkedAt: string,
): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(
    `INSERT INTO enhancement_history_checks (kind, date_key, next_cursor, settled, checked_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(kind, date_key) DO UPDATE SET
       next_cursor = excluded.next_cursor,
       settled = excluded.settled,
       checked_at = excluded.checked_at`,
    [kind, dateKey, nextCursor, settled ? 1 : 0, checkedAt],
  )
}
