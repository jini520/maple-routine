/// <reference types="node" />
/**
 * 1.0.15 기기 변환의 보스 기록 단계를 진짜 SQLite 로 태운다. 1.0.14 의 표 셋에 줄을 심고 변환을 돌려, 새 표 셋의 줄이 변환
 * 규칙대로인지 본다. 변환은 줄을 지워 되돌릴 수 없어서, 규칙이 틀리면 사용자의 기록이 사라지거나 금액이 바뀐다.
 */
import { bossDifficultyIdOf } from '../../../lib/boss/bosses'
import { crystalPayoutMeso } from '../../../lib/boss/party-shares'
import { findItem } from '../../../lib/item-catalog'
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
const itemId = (key: string) => findItem(key)!.id

/** 1.0.14 의 표 셋에 줄을 심고 변환을 돌린다. 새 DB 는 처음 열 때 변환을 돌아서 이관 상한으로 막는다. */
async function convert(seed: string[]): Promise<void> {
  __setMigrationCeilingForTest(DB_VERSION)
  const db = await getBossProfitDbUngated()
  for (const statement of seed) await db.execute(statement)
  await runDeviceConversion(db)
}

function party(id: string, bossKey: string, difficulty: string, split = 'NULL, NULL, NULL, NULL, NULL, NULL, NULL'): string {
  return `INSERT INTO boss_parties (id, ocid, boss_key, difficulty, split_mode, party_size, my_share, shares_total,
            split_fee_percent, split_fee_auto, crystal_excluded, created_at, updated_at)
          VALUES ('${id}', 'o1', '${bossKey}', '${difficulty}', ${split}, '${AT}', '${AT}')`
}

function clearedPeriod(id: string, partyId: string, periodKey: string, split: string, extra = "'scania', 100000000, 40000000, '2026-11-20'"): string {
  return `INSERT INTO boss_party_periods (id, party_id, period_key, cycle, world_key, price_meso, payout_meso, defeated_date,
            clear_status, source, split_mode, party_size, my_share, shares_total, split_fee_percent, split_fee_auto,
            crystal_excluded, created_at, updated_at)
          VALUES ('${id}', '${partyId}', '${periodKey}', '${periodKey.length === 7 ? 'monthly' : 'weekly'}', ${extra},
                  'cleared', 'manual', ${split}, '${AT}', '${AT}')`
}

function openPeriod(id: string, partyId: string, periodKey: string): string {
  return `INSERT INTO boss_party_periods (id, party_id, period_key, cycle, clear_status, created_at, updated_at)
          VALUES ('${id}', '${partyId}', '${periodKey}', 'weekly', 'open', '${AT}', '${AT}')`
}

function drop(id: string, periodId: string, item: string, box: string | null, level: number | null, priced = 'NULL'): string {
  const entered = priced !== 'NULL'
  return `INSERT INTO boss_drops (id, period_id, sort_order, category, item_key, box_origin_key, ring_level, record_status,
            price_meso, priced_at, sale_fee_percent, sale_fee_auto, split_mode, party_size, my_share, shares_total,
            split_fee_percent, split_fee_auto, created_at, updated_at)
          VALUES ('${id}', '${periodId}', 0, 'consumable', '${item}', ${box === null ? 'NULL' : `'${box}'`},
                  ${level ?? 'NULL'}, '${entered ? 'completed' : 'pending'}', ${priced}, ${entered ? `'${AT}'` : 'NULL'},
                  NULL, NULL, ${entered ? "'even', 3, 1, NULL" : 'NULL, NULL, NULL, NULL'}, NULL, NULL, '${AT}', '${AT}')`
}

describe('보스 기록 단계: 분배 설정', () => {
  // 처치나 드롭이 먼저 만든 조합 줄은 분배 칸이 비어 있다. 서버 설정 표는 분배를 정한 줄만 든다.
  it('분배를 정한 줄만 옮기고, 비율은 % 의 1000 배로 반올림하며 제외는 숨긴 분배를 버린다', async () => {
    await convert([
      party('p-none', 'lotus', 'hard'),
      party('p-ratio', 'lotus', 'extreme', "'ratio', 2, 2, 3, 5, NULL, NULL"),
      party('p-excluded', 'zakum', 'chaos', "'even', 4, NULL, NULL, 3, 1, 1"),
    ])

    expect(
      all('SELECT id, boss_difficulty_id, split_type, party_size, split_share_millipercent, split_fee_percent, split_fee_follows_mvp_grade FROM boss_split_settings ORDER BY id'),
    ).toEqual([
      { id: 'p-excluded', boss_difficulty_id: bossDifficultyIdOf('zakum', 'chaos'), split_type: 'excluded', party_size: null, split_share_millipercent: null, split_fee_percent: null, split_fee_follows_mvp_grade: 1 },
      { id: 'p-ratio', boss_difficulty_id: bossDifficultyIdOf('lotus', 'extreme'), split_type: 'ratio', party_size: 2, split_share_millipercent: 66667, split_fee_percent: 5, split_fee_follows_mvp_grade: 0 },
    ])
  })
})

describe('보스 기록 단계: 수익 건', () => {
  it('기간 값 · 월드 줄 id · 처치 칸 이름으로 옮기고, 처치하지 않은 줄은 처치 칸이 비어 있다', async () => {
    await convert([
      party('p1', 'lotus', 'hard'),
      clearedPeriod('pe-week', 'p1', '2026-11-19', "'even', 3, NULL, NULL, NULL, NULL, NULL"),
      party('p2', 'black_mage', 'hard'),
      clearedPeriod('pe-month', 'p2', '2026-11', "'even', 1, NULL, NULL, NULL, NULL, NULL", "NULL, 100000000, 100000000, NULL"),
    ])

    expect(
      all('SELECT id, period_code, world_id, crystal_price_meso, crystal_received_meso, cleared_date, clear_recorded_by, split_fee_follows_mvp_grade FROM boss_profit_entries ORDER BY id'),
    ).toEqual([
      { id: 'pe-month', period_code: 'M202611', world_id: null, crystal_price_meso: 100000000, crystal_received_meso: 100000000, cleared_date: null, clear_recorded_by: 'manual', split_fee_follows_mvp_grade: 1 },
      { id: 'pe-week', period_code: 'W202647', world_id: findWorld('scania')!.id, crystal_price_meso: 100000000, crystal_received_meso: 40000000, cleared_date: '2026-11-20', clear_recorded_by: 'manual', split_fee_follows_mvp_grade: 1 },
    ])
  })

  // 처치한 비율 분배는 그 처치를 계산한 요율이 있어야 한다. 옛 줄의 빈 요율은 3% 로 셌던 값이라, 등급 요율로 채우고 다시 센다.
  it('처치한 비율 분배의 빈 요율을 그 날 등급 요율로 채우고 받은 메소를 다시 센다. 균등의 빈 요율은 그대로 둔다', async () => {
    await convert([
      `INSERT INTO character_accounts (ocid, name, account_id, first_seen_date, last_seen_date) VALUES ('o1', '이름', 'a1', '2026-11-01', '2026-11-20')`,
      `INSERT INTO mvp_grade_history (account_id, from_date, grade, updated_at) VALUES ('a1', '2026-11-01', 'silver', '${AT}')`,
      party('p1', 'lotus', 'hard'),
      clearedPeriod('pe-ratio', 'p1', '2026-11-19', "'ratio', 2, 2, 3, NULL, NULL, NULL"),
      party('p2', 'lotus', 'extreme'),
      clearedPeriod('pe-even', 'p2', '2026-11-19', "'even', 3, NULL, NULL, NULL, NULL, NULL"),
    ])

    const [ratio, even] = all('SELECT split_fee_percent, crystal_received_meso FROM boss_profit_entries ORDER BY id DESC')
    expect(ratio).toEqual({
      split_fee_percent: 3,
      crystal_received_meso: crystalPayoutMeso(100000000, 2, { myShare: 66667, sharesTotal: 100000, splitFeePercent: 3 }),
    })
    expect(even).toEqual({ split_fee_percent: null, crystal_received_meso: 40000000 })
  })
})

describe('보스 기록 단계: 드롭', () => {
  // 상자를 적지 않으므로 직접 떨군 연마석과 상자에서 나온 연마석을 가를 것이 아이템 줄뿐이다.
  it('반지는 레벨 줄로, 상자 연마석은 상자용 줄로, 상자로만 주는 난이도의 상자 칸 빈 연마석도 상자용 줄로 옮긴다', async () => {
    await convert([
      party('p-kalos', 'guardian_kalos', 'chaos'),
      clearedPeriod('pe-kalos', 'p-kalos', '2026-11-19', "'even', 1, NULL, NULL, NULL, NULL, NULL"),
      drop('d-ring', 'pe-kalos', 'restraint_ring', 'life_boss_ring_box', 4),
      drop('d-box-whetstone', 'pe-kalos', 'life_whetstone', 'life_boss_ring_box', null),
      drop('d-direct-whetstone', 'pe-kalos', 'life_whetstone', null, null),
      party('p-kaling', 'kaling', 'hard'),
      clearedPeriod('pe-kaling', 'p-kaling', '2026-11-19', "'even', 1, NULL, NULL, NULL, NULL, NULL"),
      drop('d-old-whetstone', 'pe-kaling', 'life_whetstone', null, null),
    ])

    expect(all('SELECT id, profit_entry_id, item_id FROM boss_drops ORDER BY id')).toEqual([
      { id: 'd-box-whetstone', profit_entry_id: 'pe-kalos', item_id: itemId('life_whetstone_from_box') },
      { id: 'd-direct-whetstone', profit_entry_id: 'pe-kalos', item_id: itemId('life_whetstone') },
      { id: 'd-old-whetstone', profit_entry_id: 'pe-kaling', item_id: itemId('life_whetstone_from_box') },
      { id: 'd-ring', profit_entry_id: 'pe-kalos', item_id: itemId('restraint_ring_lv4') },
    ])
  })

  // 2026-10-19 전의 균등 기록은 내 비율 칸이 차 있어 비율 식으로 센다. 변환이 그 칸을 비우므로 받은 메소를 저장해 지난 금액을 지킨다.
  it('가격을 적은 드롭은 옛 식으로 센 받은 메소를 적고, 균등의 내 비율 칸을 비운다', async () => {
    await convert([
      party('p1', 'lotus', 'hard'),
      clearedPeriod('pe1', 'p1', '2026-11-19', "'even', 3, NULL, NULL, NULL, NULL, NULL"),
      drop('d1', 'pe1', 'restraint_ring', 'white_boss_ring_box', 3, '900000000'),
    ])

    expect(
      all('SELECT price_status, sale_price_meso, sale_received_meso, split_type, party_size, split_share_millipercent, sale_fee_follows_mvp_grade, split_fee_follows_mvp_grade FROM boss_drops'),
    ).toEqual([
      { price_status: 'entered', sale_price_meso: 900000000, sale_received_meso: 300000000, split_type: 'even', party_size: 3, split_share_millipercent: null, sale_fee_follows_mvp_grade: 0, split_fee_follows_mvp_grade: 0 },
    ])
  })
})

describe('보스 기록 단계: 지우는 것', () => {
  // 서버 표에 없는 보스 · 아이템을 가리키는 기록은 올릴 수 없다. 아이템 표에 줄을 더해 살리지 않는다(사용자 확인 2026-11-18).
  it('모르는 보스의 기록과 모르는 아이템의 드롭을 지우고, 드롭이 다 지워져 빈 처치 전 줄도 지운다', async () => {
    await convert([
      party('p-gone', 'unknown_boss', 'hard', "'even', 2, NULL, NULL, NULL, 1, NULL"),
      clearedPeriod('pe-gone', 'p-gone', '2026-11-19', "'even', 2, NULL, NULL, NULL, NULL, NULL"),
      party('p1', 'lotus', 'hard'),
      openPeriod('pe-open', 'p1', '2026-11-19'),
      drop('d-other-ring', 'pe-open', 'other_ring', null, null),
    ])

    expect(all('SELECT count(*) AS n FROM boss_split_settings')).toEqual([{ n: 0 }])
    expect(all('SELECT count(*) AS n FROM boss_profit_entries')).toEqual([{ n: 0 }])
    expect(all('SELECT count(*) AS n FROM boss_drops')).toEqual([{ n: 0 }])
  })

  it('한 수익 건에 같은 아이템 줄이 둘이면 먼저 적은 줄만 남긴다', async () => {
    await convert([
      party('p1', 'lotus', 'hard'),
      clearedPeriod('pe1', 'p1', '2026-11-19', "'even', 1, NULL, NULL, NULL, NULL, NULL"),
      drop('d-first', 'pe1', 'restraint_ring', 'white_boss_ring_box', 4),
      drop('d-second', 'pe1', 'restraint_ring', 'white_boss_ring_box', 4).replace(`'${AT}', '${AT}')`, `'2026-11-21T00:00:00.000Z', '${AT}')`),
    ])

    expect(all('SELECT id FROM boss_drops')).toEqual([{ id: 'd-first' }])
  })

  // DB 를 열 때 도는 칸 보강과 인덱스는 옛 표의 칸을 쓴다. 변환 뒤에 돌면 없는 표를 만지다 DB 가 열리지 않는다.
  it('변환한 DB 를 다시 열어도 옛 표를 다시 만들지 않고 열린다', async () => {
    await convert([party('p1', 'lotus', 'hard'), clearedPeriod('pe1', 'p1', '2026-11-19', "'even', 1, NULL, NULL, NULL, NULL, NULL")])
    await closeBossProfitDb()
    __setMigrationCeilingForTest(null)

    await getBossProfitDbUngated()

    const tables = all(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'boss_%' ORDER BY name`).map((row) => row.name)
    expect(tables).toEqual(['boss_drops', 'boss_profit_entries', 'boss_split_settings'])
    expect(all(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'boss_drops_period'`)).toEqual([])
    expect(all('SELECT id FROM boss_profit_entries')).toEqual([{ id: 'pe1' }])
  })

  it('옛 표 셋을 지우고 새 표 셋만 남긴다', async () => {
    await convert([])

    const tables = all(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'boss_%' ORDER BY name`).map((row) => row.name)
    expect(tables).toEqual(['boss_drops', 'boss_profit_entries', 'boss_split_settings'])
  })
})
