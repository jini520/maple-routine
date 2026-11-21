/// <reference types="node" />
/**
 * 1.0.15 기기 변환의 강화 합계 · 월드 리프 · MVP 등급 단계를 진짜 SQLite 로 태운다. 1.0.14 의 세 표에 줄을 심고 변환을 돌려, 새 표의
 * 줄이 변환 규칙대로인지 본다. 변환은 줄을 지워 되돌릴 수 없어서, 규칙이 틀리면 강화 지출이 빠지거나 부풀고 MVP 할인이 사라진다.
 */
import { findMvpGrade } from '../../../lib/mvp/grades'
import { findWorld } from '../../../lib/world/worlds'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDbUngated } from '../db'
import { runDeviceConversion } from '../device-conversion'
import { __setMigrationCeilingForTest, DB_VERSION } from '../migrations'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
})

afterEach(async () => {
  __setMigrationCeilingForTest(null)
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

type Row = Record<string, unknown>

function all(sql: string): Row[] {
  return real.inspect((db) => db.prepare(sql).all() as Row[])
}

const AT = '2026-11-20T00:00:00.000Z'

/** 줄 하나를 넣는 문장. 칸 이름과 값을 그대로 적는다. */
function insert(table: string, row: Record<string, string | number | null>): string {
  const values = Object.values(row).map((value) =>
    value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${value.replace(/'/g, "''")}'`,
  )
  return `INSERT INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${values.join(', ')})`
}

/** 1.0.14 의 강화 합계 한 줄. 기본은 엘리시움 캐릭터의 큐브 한 번이다. */
function total(id: string, fields: Record<string, string | number | null> = {}): string {
  return insert('enhancement_totals', {
    id,
    nexon_account_id: 'account-main',
    history_date: '2026-10-20',
    character_name: '낟낟',
    ocid: 'o1',
    account_id: 'maple-1',
    world_key: 'elysium',
    enhancement_type: 'cube',
    enhancement_category: 'cube_reset',
    item_group: 'key:arcane_umbra_knuckle',
    item_key: 'arcane_umbra_knuckle',
    item_name: '아케인셰이드 클로',
    attempts: 1,
    attempt_cost_meso: 500_000,
    destroy_defence_cost_meso: 0,
    superior_cost_meso: 0,
    from_star: null,
    to_star: null,
    event_world: 0,
    updated_at: AT,
    ...fields,
  })
}

function leap(from: string, to: string): string {
  return insert('character_world_leaps', { id: `leap-${from}`, from_ocid: from, to_ocid: to, linked_at: AT })
}

function grade(id: string, fromDate: string, key: string | null): string {
  return insert('mvp_grade_history', { id, account_id: 'maple-1', from_date: fromDate, grade: key, updated_at: AT })
}

/** 1.0.14 의 표에 줄을 심고 변환을 돈다. 새 DB 는 처음 열 때 변환을 돌아서 이관 상한으로 막는다. */
async function convert(seed: string[]): Promise<void> {
  __setMigrationCeilingForTest(DB_VERSION)
  const db = await getBossProfitDbUngated()
  for (const statement of seed) await db.execute(statement)
  await runDeviceConversion(db, { backup: false })
}

describe('강화 합계', () => {
  // 서버 표와 같은 칸으로 옮긴다. 넥슨 계정 · 이름 · 메이플 ID · API 종류 · 장비 묶음 칸은 없앤다.
  it('바뀐 칸으로 옮기고 월드를 줄 id 로 적으며, 표에 없는 월드는 비운다', async () => {
    await convert([
      total('t-cube', { event_world: 1, world_key: 'special' }),
      total('t-star', {
        enhancement_type: 'starforce', enhancement_category: 'starforce', attempts: 3, attempt_cost_meso: 9_000_000,
        destroy_defence_cost_meso: 1_000_000, superior_cost_meso: 37_015_800, from_star: 17, to_star: 21, world_key: 'challengers_2',
      }),
      total('t-pre-leap', { history_date: '2026-10-21', world_key: null, event_world: null }),
      total('t-gone-world', { history_date: '2026-10-22', world_key: 'retired_world' }),
    ])

    expect(
      all(`SELECT id, ocid, history_date, category, item_name, attempt_count, attempt_cost_meso, destroy_defence_cost_meso, world_id,
                  superior_cost_meso, from_star, to_star, is_event_world FROM enhancement_totals ORDER BY id`),
    ).toEqual([
      {
        id: 't-cube', ocid: 'o1', history_date: '2026-10-20', category: 'cube_reset', item_name: '아케인셰이드 클로', attempt_count: 1,
        attempt_cost_meso: 500_000, destroy_defence_cost_meso: 0, world_id: findWorld('special')!.id, superior_cost_meso: 0,
        from_star: null, to_star: null, is_event_world: 1,
      },
      {
        id: 't-gone-world', ocid: 'o1', history_date: '2026-10-22', category: 'cube_reset', item_name: '아케인셰이드 클로',
        attempt_count: 1, attempt_cost_meso: 500_000, destroy_defence_cost_meso: 0, world_id: null, superior_cost_meso: 0,
        from_star: null, to_star: null, is_event_world: 0,
      },
      {
        id: 't-pre-leap', ocid: 'o1', history_date: '2026-10-21', category: 'cube_reset', item_name: '아케인셰이드 클로',
        attempt_count: 1, attempt_cost_meso: 500_000, destroy_defence_cost_meso: 0, world_id: null, superior_cost_meso: 0,
        from_star: null, to_star: null, is_event_world: null,
      },
      {
        id: 't-star', ocid: 'o1', history_date: '2026-10-20', category: 'starforce', item_name: '아케인셰이드 클로', attempt_count: 3,
        attempt_cost_meso: 9_000_000, destroy_defence_cost_meso: 1_000_000, world_id: findWorld('challengers_2')!.id,
        superior_cost_meso: 37_015_800, from_star: 17, to_star: 21, is_event_world: 0,
      },
    ])
  })

  // 옛 기준은 장비 key 나 공백을 지운 이름이라 이름이 같은 줄이 둘일 수 있다. 하나만 남기면 그날 쓴 메소가 빠진다.
  it('새 유일 기준이 겹치는 줄은 횟수와 비용 셋을 먼저 적은 줄에 더해 한 줄로 합친다', async () => {
    await convert([
      total('t-first', { enhancement_type: 'starforce', enhancement_category: 'starforce', from_star: 15, to_star: 17 }),
      total('t-second', {
        enhancement_type: 'starforce', enhancement_category: 'starforce', item_group: 'name:아케인셰이드클로', item_key: null,
        attempts: 2, attempt_cost_meso: 700_000, destroy_defence_cost_meso: 300_000, superior_cost_meso: 10, from_star: 17, to_star: 18,
      }),
    ])

    expect(
      all('SELECT id, attempt_count, attempt_cost_meso, destroy_defence_cost_meso, superior_cost_meso, from_star, to_star FROM enhancement_totals'),
    ).toEqual([
      {
        id: 't-first', attempt_count: 3, attempt_cost_meso: 1_200_000, destroy_defence_cost_meso: 300_000, superior_cost_meso: 10,
        from_star: 15, to_star: 17,
      },
    ])
  })
})

describe('월드 리프', () => {
  // 서버는 리프 줄이 캐릭터 줄을 가리킨다. 기기도 한 캐릭터의 리프 줄이 모두 그 캐릭터의 지금 ocid 를 가리켜야 같은 모양이다.
  it('이어진 줄은 끝 ocid 로 모으고, 자기 자신을 가리키는 줄은 옮기지 않는다', async () => {
    await convert([leap('a', 'b'), leap('b', 'c'), leap('x', 'y'), leap('self', 'self')])

    expect(all('SELECT id, previous_ocid, ocid FROM character_world_leaps ORDER BY previous_ocid')).toEqual([
      { id: 'leap-a', previous_ocid: 'a', ocid: 'c' },
      { id: 'leap-b', previous_ocid: 'b', ocid: 'c' },
      { id: 'leap-x', previous_ocid: 'x', ocid: 'y' },
    ])
  })

  // 고리에서 계속 따라가면 변환이 끝나지 않는다.
  it('고리가 있어도 끝나고, 이미 지난 ocid 앞에서 멈춘다', async () => {
    await convert([leap('a', 'b'), leap('b', 'a')])

    expect(all('SELECT previous_ocid, ocid FROM character_world_leaps ORDER BY previous_ocid')).toEqual([
      { previous_ocid: 'a', ocid: 'b' },
      { previous_ocid: 'b', ocid: 'a' },
    ])
  })
})

describe('MVP 등급', () => {
  // 등급이 빈 기간은 없다. 표에 없는 등급은 수수료와 할인을 구할 수 없다.
  it('등급을 줄 id 로 옮기고, 등급이 비었거나 표에 없는 줄은 지운다', async () => {
    await convert([grade('g-gold', '2026-09-03', 'gold'), grade('g-empty', '2026-08-01', null), grade('g-gone', '2026-10-01', 'platinum')])

    expect(all('SELECT id, account_id, from_date, grade_id, updated_at FROM mvp_grade_history')).toEqual([
      { id: 'g-gold', account_id: 'maple-1', from_date: '2026-09-03', grade_id: findMvpGrade('gold')!.id, updated_at: AT },
    ])
  })
})

describe('변환 뒤 DB 열기', () => {
  // 변환 뒤의 표에는 옛 칸이 없어, 열 때마다 도는 칸 보강이 옛 칸을 더하면 DB 가 열리지 않거나 옛 칸이 되살아난다.
  it('다시 열어도 옛 칸을 더하지 않고 날짜 인덱스가 새 표에 서 있다', async () => {
    await convert([total('t-1')])
    await closeBossProfitDb()
    __setMigrationCeilingForTest(null)
    real.statements.length = 0

    await getBossProfitDbUngated()

    expect(real.statements.filter((statement) => /ALTER TABLE (enhancement_totals|character_world_leaps|mvp_grade_history)/.test(statement))).toEqual([])
    expect(all(`SELECT tbl_name FROM sqlite_master WHERE type = 'index' AND name = 'enhancement_totals_date'`)).toEqual([
      { tbl_name: 'enhancement_totals' },
    ])
    expect(all('PRAGMA table_info(enhancement_totals)').map((column) => column.name)).not.toContain('item_group')
  })
})
