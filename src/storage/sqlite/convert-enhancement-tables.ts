/**
 * 1.0.15 기기 변환의 강화 합계 · 월드 리프 · MVP 등급 단계. 세 표를 서버 표와 같은 칸으로 옮긴다.
 *
 * 월드와 MVP 등급을 새 게임 데이터의 줄 id 로 찾으므로 게임 데이터가 준비된 뒤에 돈다. 줄이 없는 새 DB 에서는 찾을 것이 없어 게임
 * 데이터 없이 돈다.
 */
import { findMvpGrade } from '../../lib/mvp/grades'
import { findWorld } from '../../lib/world/worlds'
import type { SqliteDbConnection } from '../ports'
import { ENHANCEMENT_TOTALS_BODY, ENHANCEMENT_TOTALS_DATE_INDEX } from './enhancement-tables'
import { CHARACTER_WORLD_LEAPS_BODY, MVP_GRADE_HISTORY_BODY } from './record-key-tables'

type Row = Record<string, unknown>

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)

/** 옮기는 표. 표 이름이 그대로라 옛 표를 `…_unconverted` 로 비켜 두고 새 표를 만든다. 서로 가리키지 않아 차례는 상관없다. */
const TABLES = [
  ['enhancement_totals', ENHANCEMENT_TOTALS_BODY],
  ['character_world_leaps', CHARACTER_WORLD_LEAPS_BODY],
  ['mvp_grade_history', MVP_GRADE_HISTORY_BODY],
] as const

const unconverted = (table: string): string => `${table}_unconverted`

async function rowsOf(db: SqliteDbConnection, sql: string): Promise<Row[]> {
  return ((await db.query(sql)).values ?? []) as Row[]
}

/**
 * 강화 합계를 옮긴다. 새 유일 기준(캐릭터 · 날짜 · 분류 · 이름)이 겹치는 줄은 횟수와 비용 셋을 먼저 적은 줄에 더한다. 옛 기준은
 * 장비 key 나 공백을 지운 이름이라 이름이 같은 줄이 둘일 수 있고, 둘 다 그날 쓴 메소다.
 */
async function convertEnhancementTotals(db: SqliteDbConnection): Promise<void> {
  for (const row of await rowsOf(db, `SELECT * FROM ${unconverted('enhancement_totals')} ORDER BY rowid`)) {
    await db.run(
      `INSERT INTO enhancement_totals
         (id, ocid, history_date, category, item_name, attempt_count, attempt_cost_meso, destroy_defence_cost_meso, world_id,
          superior_cost_meso, from_star, to_star, is_event_world, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (ocid, history_date, category, item_name) DO UPDATE SET
         attempt_count = attempt_count + excluded.attempt_count,
         attempt_cost_meso = attempt_cost_meso + excluded.attempt_cost_meso,
         destroy_defence_cost_meso = destroy_defence_cost_meso + excluded.destroy_defence_cost_meso,
         superior_cost_meso = superior_cost_meso + excluded.superior_cost_meso`,
      [
        row.id, row.ocid, row.history_date, row.enhancement_category, row.item_name, row.attempts, row.attempt_cost_meso,
        row.destroy_defence_cost_meso, findWorld(text(row.world_key))?.id ?? null, row.superior_cost_meso ?? 0, row.from_star,
        row.to_star, row.event_world, row.updated_at,
      ],
    )
  }
}

/**
 * 옛 ocid 에서 이어진 연결을 끝까지 따라간 ocid. 고리가 있으면 이미 지난 ocid 앞에서 멈춘다. 고리에서 계속 돌면 변환이 끝나지 않는다.
 *
 * @param next 옛 ocid → 이은 새 ocid
 */
function chainEndOf(next: ReadonlyMap<string, string>, from: string): string {
  const passed = new Set([from])
  let ocid = next.get(from)!
  for (let after = next.get(ocid); after !== undefined && !passed.has(after); after = next.get(ocid)) {
    passed.add(ocid)
    ocid = after
  }
  return ocid
}

/** 월드 리프를 옮긴다. A→B, B→C 처럼 이어진 줄은 모두 C 를 가리키게 모은다. 자기 자신을 가리키는 줄은 옮기지 않는다. */
async function convertWorldLeaps(db: SqliteDbConnection): Promise<void> {
  const rows = await rowsOf(db, `SELECT id, from_ocid, to_ocid FROM ${unconverted('character_world_leaps')} ORDER BY rowid`)
  const next = new Map(rows.map((row) => [row.from_ocid as string, row.to_ocid as string]))
  for (const row of rows) {
    const previous = row.from_ocid as string
    const ocid = chainEndOf(next, previous)
    if (ocid === previous) continue
    await db.run('INSERT INTO character_world_leaps (id, previous_ocid, ocid) VALUES (?, ?, ?)', [row.id, previous, ocid])
  }
}

/** MVP 등급 이력을 등급 줄 id 로 옮긴다. 등급이 비었거나 표에 없는 줄은 옮기지 않는다. 등급이 빈 기간은 없다. */
async function convertMvpGradeHistory(db: SqliteDbConnection): Promise<void> {
  for (const row of await rowsOf(db, `SELECT * FROM ${unconverted('mvp_grade_history')} ORDER BY rowid`)) {
    const gradeId = findMvpGrade(text(row.grade))?.id
    if (gradeId === undefined) continue
    await db.run('INSERT INTO mvp_grade_history (id, account_id, from_date, grade_id, updated_at) VALUES (?, ?, ?, ?, ?)', [
      row.id,
      row.account_id,
      row.from_date,
      gradeId,
      row.updated_at,
    ])
  }
}

/** 강화 합계 · 월드 리프 · MVP 등급 이력을 새 표로 옮기고 옛 표를 지운다. 기기 변환의 한 트랜잭션 안에서 돈다. */
export async function convertEnhancementTables(db: SqliteDbConnection): Promise<void> {
  for (const [table] of TABLES) await db.execute(`ALTER TABLE ${table} RENAME TO ${unconverted(table)}`)
  for (const [table, body] of TABLES) await db.execute(`CREATE TABLE ${table} ${body}`)

  await convertEnhancementTotals(db)
  await convertWorldLeaps(db)
  await convertMvpGradeHistory(db)

  for (const [table] of TABLES) await db.execute(`DROP TABLE ${unconverted(table)}`)
  // 날짜 인덱스는 이름이 같아 옛 표를 따라 비켜 있다가 함께 지워진다. 새 표에 다시 건다.
  await db.execute(ENHANCEMENT_TOTALS_DATE_INDEX)
}
