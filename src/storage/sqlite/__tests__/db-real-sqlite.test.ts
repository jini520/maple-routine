/// <reference types="node" />
/**
 * **목이 아닌 진짜 SQLite 로 한 번 태우는 자리**(이슈 #265).
 *
 * 옆의 `db.spec.ts` 는 가짜 포트로 어떤 문장이 나가는가 를 보고, `adapters/__tests__/rn-sqlite.test.ts`
 * 는 op-sqlite 의 모양 을 본다. 여기서 보는 것은 **그 문장이 진짜 엔진에서 통하는가** 다 —
 * 제약(`NOT NULL`)은 목이 흉내 낼 줄 모르는 것이고, 그래서 메포·캐시 기타가 저장되지 않는 결함이
 * 3,900 개 테스트를 그대로 통과했다.
 *
 * 새 케이스를 더할 기준: **스키마 제약·트랜잭션·데이터 이관**처럼 엔진이 판정하는 것. 문장의
 * 차례·개수는 여기 말고 `db.spec.ts` 다(그쪽이 훨씬 싸다).
 */
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { getIncomeRecordsBetween, insertIncomeRecord, type IncomeRecord } from '../../income'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

/**
 * **처음 만들어졌을 때의 `income_records`** — 수입이 메소뿐이라
 * `meso_amount` 가 `NOT NULL` 이다. 실기기의 테이블은 이 DDL 로 만들어졌고, 그 뒤의 칸들은
 * 전부 `ensureColumn` 이 **뒤에 붙였다**(그래서 순서가 지금의 DDL 과 다르다).
 */
const OLD_INCOME_TABLE = `
  CREATE TABLE income_records (
    id TEXT NOT NULL,
    ocid TEXT,
    earned_on TEXT NOT NULL,
    category TEXT NOT NULL,
    item TEXT,
    meso_amount INTEGER NOT NULL,
    memo TEXT,
    recorded_at TEXT NOT NULL,
    PRIMARY KEY (id)
  )
`

/** 그 뒤 `ensureColumn` 이 붙여 온 칸들 — **지금 기기의 테이블**이 이 모양이다. */
const OLD_INCOME_ALTERS = [
  'sale_fee_percent INTEGER',
  'sale_fee_meso INTEGER',
  'point_amount INTEGER',
  'point_per_100m_meso INTEGER',
  'cash_amount INTEGER',
  'hunt_character_level INTEGER',
  'hunt_missed_mobs INTEGER',
  'hunt_boosts TEXT',
  'hunt_sojae INTEGER',
  'hunt_fragments INTEGER',
  'hunt_fragment_price INTEGER',
].map((column) => `ALTER TABLE income_records ADD COLUMN ${column}`)

function notNullOfMesoAmount(real: RealSqlite): number {
  return real.inspect((db) => {
    const columns = db.prepare('PRAGMA table_info(income_records)').all() as {
      name: string
      notnull: number
    }[]
    const mesoAmount = columns.find((column) => column.name === 'meso_amount')
    if (mesoAmount === undefined) throw new Error('meso_amount 칸이 없다')
    return mesoAmount.notnull
  })
}

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

// SQLite 는 `ALTER TABLE` 로 기존 칸의 `NOT NULL` 을 못 뗀다. 테이블을 다시 쓰는 것이
// 유일한 길이고, **이 저장소가 처음 하는 종류의 마이그레이션**이라 잃을 것이 크다(수입 기록 전부).
describe('income_records.meso_amount 재작성 (이슈 #265 · ADR-176)', () => {
  it('처음 만드는 DB 는 처음부터 nullable 이다', async () => {
    await getBossProfitDb()

    expect(notNullOfMesoAmount(real)).toBe(0)
  })

  it('옛 스키마(NOT NULL)로 만들어진 DB 를 열면 nullable 이 된다', async () => {
    real.inspect((db) => {
      db.exec(OLD_INCOME_TABLE)
      for (const alter of OLD_INCOME_ALTERS) db.exec(alter)
    })
    expect(notNullOfMesoAmount(real)).toBe(1)

    await getBossProfitDb()

    expect(notNullOfMesoAmount(real)).toBe(0)
  })

  // **이 결정의 진짜 위험이다.** 재작성은 DROP 을 포함하므로, 옮기다 어긋나면 사용자가 손으로 적은
  // 수입이 통째로 사라진다 — 되살릴 API 가 0% 인 데이터다.
  it('기존 행을 한 건도 안 잃는다 — 값까지 그대로다', async () => {
    real.inspect((db) => {
      db.exec(OLD_INCOME_TABLE)
      for (const alter of OLD_INCOME_ALTERS) db.exec(alter)
      db.prepare(
        `INSERT INTO income_records
           (id, ocid, earned_on, category, item, meso_amount, memo, recorded_at,
            sale_fee_percent, sale_fee_meso)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('a1', 'ocid-1', '2026-08-20', '아이템 판매', '앱솔 무기', 4_850_000_000, '메모', '2026-08-20T12:00:00.000Z', 5, 250_000_000)
      db.prepare(
        `INSERT INTO income_records (id, ocid, earned_on, category, item, meso_amount, memo, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('a2', null, '2026-08-21', '기타', null, 12_000_000, null, '2026-08-21T09:30:00.000Z')
    })

    await getBossProfitDb()

    const rows = await getIncomeRecordsBetween('2026-08-01', '2026-08-31')
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.id === 'a1')).toEqual<IncomeRecord>({
      id: 'a1',
      ocid: 'ocid-1',
      earnedOn: '2026-08-20',
      category: '아이템 판매',
      item: '앱솔 무기',
      mesoAmount: 4_850_000_000,
      saleFeePercent: 5,
      saleFeeMeso: 250_000_000,
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
      hunt: null,
      quantity: null,
      memo: '메모',
      recordedAt: '2026-08-20T12:00:00.000Z',
    })
    expect(rows.find((row) => row.id === 'a2')?.mesoAmount).toBe(12_000_000)
  })

  // 칸을 더한 커밋과 이 재작성이 또 갈린다 — 수수료·통화·사냥 칸을 아직 못 받은 기기가 실제로
  // 있다. 지금 스키마의 칸 목록을 박아 두면 없는 칸을
  // `SELECT` 해 **그 자리에서 던진다** — 그 기기는 앱이 아예 안 열린다.
  it('칸이 모자란 옛 기기도 옮긴다 — 없던 칸은 NULL 이다', async () => {
    real.inspect((db) => {
      db.exec(OLD_INCOME_TABLE)
      db.prepare(
        `INSERT INTO income_records (id, ocid, earned_on, category, item, meso_amount, memo, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('old', null, '2026-08-19', '사냥', '츄츄 아일랜드', 900_000_000, null, '2026-08-19T00:00:00.000Z')
    })

    await getBossProfitDb()

    const rows = await getIncomeRecordsBetween('2026-08-01', '2026-08-31')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'old',
      item: '츄츄 아일랜드',
      mesoAmount: 900_000_000,
      saleFeePercent: null,
      pointAmount: null,
      // 계산 입력이 없으니 옛 모양(금액을 직접 치는 시트)으로 연다.
      hunt: null,
      quantity: null,
    })
    expect(notNullOfMesoAmount(real)).toBe(0)
  })

  // 차례가 뒤집히면 **방금 ALTER 로 붙인 칸을 다시 만드는** 헛일이 된다.
  // 재작성이 만드는 테이블은 지금의 DDL 전체라, 먼저 돌면 **income_records 에 ALTER 가 한 번도
  // 안 나가는 것**이 그 차례의 증거다.
  it('ensureColumn 들보다 먼저 돈다 — 옮긴 뒤엔 붙일 칸이 없다', async () => {
    real.inspect((db) => {
      db.exec(OLD_INCOME_TABLE)
    })

    await getBossProfitDb()

    expect(
      real.statements.filter((statement) =>
        statement.startsWith('ALTER TABLE income_records ADD COLUMN'),
      ),
    ).toEqual([])
  })

  // 재작성은 행을 통째로 옮기는 비싼 일이다. 메이린 UPDATE 들과 같은 성질을 가져야 한다 —
  // **이미 됐으면 아무 일도 안 한다**.
  it('두 번째 부팅에서는 한 문장도 안 나간다', async () => {
    real.inspect((db) => {
      db.exec(OLD_INCOME_TABLE)
      for (const alter of OLD_INCOME_ALTERS) db.exec(alter)
    })

    await getBossProfitDb()
    expect(real.statements.some((statement) => statement.includes('income_records_rebuild'))).toBe(
      true,
    )

    await closeBossProfitDb()
    real.statements.length = 0
    await getBossProfitDb()

    expect(real.statements.some((statement) => statement.includes('income_records_rebuild'))).toBe(
      false,
    )
    expect(real.statements.some((statement) => statement.startsWith('BEGIN'))).toBe(false)
  })
})

/**
 * 이슈 #265 의 재현 그 자체다. 시트가 넘기는 드래프트는 `IncomeSheet.test.tsx` 가 붙들고 있고
 * (`mesoAmount: null` · `pointAmount: 30000` …), **그 아래가 여기서 처음 진짜 DB 를 만난다.**
 */
describe('기타를 메포·캐시로 적어도 저장된다 (목이 아닌 SQLite)', () => {
  const base = {
    ocid: null,
    earnedOn: '2026-08-28',
    category: '기타',
    item: '이벤트 보상',
    saleFeePercent: null,
    saleFeeMeso: null,
    hunt: null,
    quantity: null,
    memo: null,
    recordedAt: '2026-08-28T10:00:00.000Z',
  } as const

  it('메포 `기타`', async () => {
    await getBossProfitDb()

    await insertIncomeRecord({
      ...base,
      id: 'point',
      mesoAmount: null,
      pointAmount: 30_000,
      pointPer100mMeso: 1_200,
      cashAmount: null,
    })

    const rows = await getIncomeRecordsBetween('2026-08-28', '2026-08-28')
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'point',
        mesoAmount: null,
        pointAmount: 30_000,
        pointPer100mMeso: 1_200,
        cashAmount: null,
      }),
    ])
  })

  it('캐시 `기타`', async () => {
    await getBossProfitDb()

    await insertIncomeRecord({
      ...base,
      id: 'cash',
      mesoAmount: null,
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: 15_000,
    })

    const rows = await getIncomeRecordsBetween('2026-08-28', '2026-08-28')
    expect(rows).toEqual([
      expect.objectContaining({ id: 'cash', mesoAmount: null, cashAmount: 15_000 }),
    ])
  })

  // 막혀 있던 것은 메포·캐시 하나뿐이었다 — 고치면서 나머지가 조용히 상하지 않는지 함께 본다.
  it('메소 `기타`와 사냥은 그대로다', async () => {
    await getBossProfitDb()

    await insertIncomeRecord({
      ...base,
      id: 'meso',
      mesoAmount: 250_000_000,
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
    })
    await insertIncomeRecord({
      ...base,
      id: 'hunt',
      category: '사냥',
      item: '탈라하트 밤의 길 3',
      mesoAmount: 1_800_000_000,
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
      hunt: {
        mode: 'calculator',
        characterLevel: 294,
        missedMobs: 1,
        boosts: ['union-wealth'],
        sojae: 4,
        fragments: 83,
        fragmentPrice: 2_500_000,
        // **그때의** 캐릭터 메소 획득량 — 칸이 하나 더 있다.
        mesoRate: 149,
      },
    })

    const rows = await getIncomeRecordsBetween('2026-08-28', '2026-08-28')
    expect(rows.find((row) => row.id === 'meso')?.mesoAmount).toBe(250_000_000)
    expect(rows.find((row) => row.id === 'hunt')?.hunt).toEqual({
      mode: 'calculator',
      characterLevel: 294,
      missedMobs: 1,
      boosts: ['union-wealth'],
      sojae: 4,
      fragments: 83,
      fragmentPrice: 2_500_000,
      mesoRate: 149,
    })
  })
})
