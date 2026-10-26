/// <reference types="node" />
/**
 * 가계부 손입력 두 표(`spend_records` · `income_records`)를 기록 표 셋으로 옮기는 버전 15 를 진짜 SQLite 로 태운다.
 *
 * 옛 행을 심고 버전 14 로 되돌린 뒤 다시 열어, 저장 함수로 되읽은 기록을 옛 값과 견준다. 손입력은 되살릴 API 가 없어
 * 한 건이라도 잃으면 끝이다.
 */
import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

import { getIncomeRecordsBetween } from '../../income'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { getSpendRecordsBetween } from '../../spend'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { DB_VERSION } from '../migrations'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

type Row = Record<string, unknown>

function all(sql: string): Row[] {
  return real.inspect((db) => db.prepare(sql).all() as Row[])
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** 버전 14 기기를 만든다. 옛 표에 행을 넣고 버전을 되돌린다. */
async function seedVersion14(seed: (db: DatabaseSync) => void): Promise<void> {
  await getBossProfitDb()
  await closeBossProfitDb()
  real.inspect((db) => {
    seed(db)
    db.exec('PRAGMA user_version = 14')
  })
}

const SPEND_COLUMNS =
  'id, ocid, spent_on, category, category_key, item, item_key, form_item_keys, item_kind_key, quantity, level_from, level_to, meso_amount, tariff_meso, point_amount, point_per_100m_meso, cash_amount, memo, recorded_at'
const INCOME_COLUMNS =
  'id, ocid, earned_on, category, category_key, item, item_key, meso_amount, sale_fee_percent, sale_fee_meso, sale_fee_auto, point_amount, point_per_100m_meso, cash_amount, quantity, item_kind_key, hunt_character_level, hunt_missed_mobs, hunt_boosts, hunt_sojae, hunt_fragments, hunt_fragment_price, hunt_meso_rate, hunt_typed_meso, hunt_union_tier, memo, recorded_at'

function seedDevice(db: DatabaseSync): void {
  db.exec(`INSERT INTO spend_records (${SPEND_COLUMNS}) VALUES
    ('mg1abc-x1', NULL, '2026-10-01', '버프', 'buff', '세이람의 영약', 'seiram_elixir', NULL, NULL, 2, NULL, NULL, 4000000, NULL, NULL, NULL, NULL, '메모', '2026-10-01T01:00:00.000Z'),
    ('mg1abc-x2', 'ocid-1', '2026-10-01', '컨텐츠', 'content', '하이마운틴 EXP 1단계, 솔 2단계', NULL, '{"exp":"high_mountain_1","sol_erda":"high_mountain_2"}', NULL, 1, NULL, NULL, NULL, NULL, 37501, 1180, NULL, NULL, '2026-10-01T02:00:00.000Z'),
    ('mg1abc-x3', 'ocid-1', '2026-10-02', '심볼 강화', 'symbol', '세르니움', 'cernium', NULL, NULL, NULL, 7, 10, 90000000, NULL, NULL, NULL, NULL, NULL, '2026-10-02T00:00:00.000Z'),
    ('mg1abc-x4', NULL, '2026-10-02', '아이템 구매', 'item_purchase', '앱솔랩스 아처슈즈', NULL, NULL, 'equipment', NULL, NULL, NULL, 1100000000, 100000000, NULL, NULL, NULL, NULL, '2026-10-02T01:00:00.000Z'),
    ('mg1abc-x5', NULL, '2026-10-03', '없어진 갈래', NULL, '옛 지출', NULL, NULL, NULL, NULL, NULL, NULL, 500, NULL, NULL, NULL, NULL, NULL, '2026-10-03T00:00:00.000Z')`)
  db.exec(`INSERT INTO income_records (${INCOME_COLUMNS}) VALUES
    ('mg1abc-y1', 'ocid-1', '2026-10-01', '사냥', 'hunting', '밤의 길 3', 'tallahart_road_of_night_3', 900000000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 285, 2, 'wealth', 8, 30, NULL, 120, NULL, 2, NULL, '2026-10-01T03:00:00.000Z'),
    ('mg1abc-y2', 'ocid-1', '2026-10-02', '사냥', 'hunting', NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 12, 0, NULL, 0, NULL, NULL, '2026-10-02T03:00:00.000Z'),
    ('mg1abc-y3', 'ocid-1', '2026-10-03', '아이템 판매', 'item_sale', '루즈 컨트롤 머신 마크', NULL, 950000000, 5, 50000000, 1, NULL, NULL, NULL, 10, 'consumable', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '판매', '2026-10-03T03:00:00.000Z'),
    ('mg1abc-y4', NULL, '2026-10-03', '솔 에르다 조각', 'sol_erda_fragment', NULL, NULL, 400000000, NULL, NULL, NULL, NULL, NULL, NULL, 20, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-03T04:00:00.000Z')`)
}

describe('버전 15: 가계부 손입력 두 표를 기록 표 셋으로 옮긴다', () => {
  it('새 DB 는 옮길 것 없이 마지막 버전으로 선다', async () => {
    await getBossProfitDb()

    expect(real.inspect((db) => (db.prepare('PRAGMA user_version').get() as Row).user_version)).toBe(DB_VERSION)
    expect(all('SELECT count(*) AS n FROM cashbook_entries')).toEqual([{ n: 0 }])
  })

  it('한 건도 안 잃고 값이 그대로다. id 는 새 uuid 이고 저장 시각이 차례를 지킨다', async () => {
    await seedVersion14(seedDevice)

    const spend = await getSpendRecordsBetween('2026-10-01', '2026-10-31')
    const income = await getIncomeRecordsBetween('2026-10-01', '2026-10-31')

    expect(spend.every((record) => UUID.test(record.id))).toBe(true)
    expect(income.every((record) => UUID.test(record.id))).toBe(true)
    const withoutId = <T extends { id: string }>(records: T[]) =>
      records.map((record) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'id')))
    expect(withoutId(spend)).toEqual([
      // key 가 있는 기록은 이름을 안 옮긴다. 화면은 key 로 이름을 찾는다.
      expect.objectContaining({ recordedAt: '2026-10-01T01:00:00.000Z', category: 'buff', item: null, itemKey: 'seiram_elixir', quantity: 2, mesoAmount: 4_000_000 }),
      expect.objectContaining({
        ocid: 'ocid-1',
        category: 'content',
        item: null,
        itemKey: null,
        formItemKeys: { exp: 'high_mountain_1', sol_erda: 'high_mountain_2' },
        pointAmount: 37_501,
        pointPer100mMeso: 1_180,
      }),
      expect.objectContaining({ category: 'symbol', itemKey: 'cernium', levelFrom: 7, levelTo: 10, mesoAmount: 90_000_000 }),
      expect.objectContaining({ category: 'item_purchase', item: '앱솔랩스 아처슈즈', itemKind: 'equipment', mesoAmount: 1_100_000_000, tariffMeso: 100_000_000 }),
      // 버전 2 가 key 를 못 찾은 갈래는 기타로 옮긴다. 버리면 그 지출이 사라진다.
      expect.objectContaining({ category: 'etc', item: '옛 지출', mesoAmount: 500 }),
    ])
    expect(withoutId(income)).toEqual([
      expect.objectContaining({
        category: 'hunting',
        item: null,
        itemKey: 'tallahart_road_of_night_3',
        mesoAmount: 900_000_000,
        quantity: null,
        hunt: {
          mode: 'calculator',
          characterLevel: 285,
          missedMobs: 2,
          boosts: ['wealth'],
          sojae: 8,
          fragments: 30,
          fragmentPrice: null,
          mesoRate: 120,
          unionTier: 2,
        },
      }),
      expect.objectContaining({ category: 'hunting', mesoAmount: 0, hunt: { mode: 'manual', typedMeso: 0, fragments: 12, fragmentPrice: 0 } }),
      expect.objectContaining({
        category: 'item_sale',
        item: '루즈 컨트롤 머신 마크',
        itemKind: 'consumable',
        quantity: 10,
        saleFeePercent: 5,
        saleFeeMeso: 50_000_000,
        saleFeeAuto: true,
      }),
      expect.objectContaining({ category: 'sol_erda_fragment', quantity: 20, mesoAmount: 400_000_000, hunt: null }),
    ])
  })

  it('에픽던전 형태 둘은 품목 둘로 나뉘고 금액은 단계 단가대로 나뉜다', async () => {
    await seedVersion14(seedDevice)
    await getBossProfitDb()

    expect(
      all(`SELECT i.form_key, i.amount_point FROM cashbook_entry_items i JOIN cashbook_entries e ON e.id = i.entry_id
           WHERE e.category_key = 'content' ORDER BY i.sort_order`),
    ).toEqual([
      { form_key: 'exp', amount_point: 7_501 },
      { form_key: 'sol_erda', amount_point: 30_000 },
    ])
  })

  it('옛 표는 그대로 남고, 이관은 한 번만 돈다', async () => {
    await seedVersion14(seedDevice)
    await getBossProfitDb()
    await closeBossProfitDb()
    await getBossProfitDb()

    expect(all('SELECT count(*) AS n FROM spend_records')).toEqual([{ n: 5 }])
    expect(all('SELECT count(*) AS n FROM income_records')).toEqual([{ n: 4 }])
    expect(all('SELECT count(*) AS n FROM cashbook_entries')).toEqual([{ n: 9 }])
  })

  /** 이관 전 사본의 경로. DB 파일 옆에 버전 이름을 붙여 둔다. */
  function backupPath(): string {
    const main = real.inspect((db) => (db.prepare('PRAGMA database_list').all() as Row[]).find((row) => row.name === 'main'))
    return String(main!.file).replace(/\.db$/, '-before-v15.db')
  }

  // 손입력은 되살릴 API 가 없다. 옮기다 무엇이 틀려도 옮기기 전 DB 를 통째로 되돌릴 수 있어야 한다.
  it('옮기기 전 DB 를 파일째 사본으로 남긴다. 새 DB 는 사본이 없다', async () => {
    await getBossProfitDb()
    expect(existsSync(backupPath())).toBe(false)
    await closeBossProfitDb()
    real.inspect((db) => {
      seedDevice(db)
      db.exec('PRAGMA user_version = 14')
    })

    await getBossProfitDb()

    const backup = new DatabaseSync(backupPath(), { readOnly: true })
    try {
      expect((backup.prepare('PRAGMA user_version').get() as Row).user_version).toBe(14)
      expect(backup.prepare('SELECT count(*) AS n FROM spend_records').get()).toEqual({ n: 5 })
      expect(backup.prepare('SELECT count(*) AS n FROM cashbook_entries').get()).toEqual({ n: 0 })
    } finally {
      backup.close()
    }
  })

  // 한 번 실패한 기기가 다음 부팅에 다시 옮길 때 사본이 반쯤 옮긴 DB 로 바뀌면 안 된다.
  it('옮기다 실패하면 버전 14 와 옛 표 그대로 되돌아가고, 다시 열어도 처음 사본을 덮지 않는다', async () => {
    await seedVersion14((db) => {
      seedDevice(db)
      db.exec(`UPDATE spend_records SET form_item_keys = '{깨진' WHERE id = 'mg1abc-x2'`)
    })

    await expect(getBossProfitDb()).rejects.toThrow()
    await expect(getBossProfitDb()).rejects.toThrow()

    expect(real.inspect((db) => (db.prepare('PRAGMA user_version').get() as Row).user_version)).toBe(14)
    expect(all('SELECT count(*) AS n FROM cashbook_entries')).toEqual([{ n: 0 }])
    expect(all('SELECT count(*) AS n FROM spend_records')).toEqual([{ n: 5 }])
    const backup = new DatabaseSync(backupPath(), { readOnly: true })
    try {
      expect(backup.prepare(`SELECT form_item_keys FROM spend_records WHERE id = 'mg1abc-x2'`).get()).toEqual({
        form_item_keys: '{깨진',
      })
    } finally {
      backup.close()
    }
  })
})
