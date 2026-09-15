/// <reference types="node" />
/**
 * **목이 아닌 진짜 SQLite 로 한 번 태우는 자리**.
 *
 * 옆의 `db.spec.ts` 는 가짜 포트로 어떤 문장이 나가는가 를 보고, `adapters/__tests__/rn-sqlite.test.ts`
 * 는 op-sqlite 의 모양 을 본다. 여기서 보는 것은 **그 문장이 진짜 엔진에서 통하는가** 다.
 * 제약(`NOT NULL`)은 목이 흉내 낼 줄 모르는 것이고, 그래서 메포·캐시 기타가 저장되지 않는 결함이
 * 3,900 개 테스트를 그대로 통과했다.
 *
 * 새 케이스를 더할 기준: **스키마 제약·트랜잭션·데이터 이관**처럼 엔진이 판정하는 것. 문장의
 * 차례·개수는 여기 말고 `db.spec.ts` 다(그쪽이 훨씬 싸다).
 */
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { getIncomeRecordsBetween, insertIncomeRecord, type IncomeRecord } from '../../income'
import { getSpendRecordsBetween } from '../../spend'
import { getAllBossDropRecords, replaceBossDropRecords } from '../../boss-drops'
import { getBossPartySettings, setBossPartySize } from '../../boss-party-settings'
import { getBossProfitRecords, upsertBossProfitRecord } from '../../boss-profit'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

/**
 * **처음 만들어졌을 때의 `income_records`**. 수입이 메소뿐이라
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

/** 그 뒤 `ensureColumn` 이 붙여 온 칸들. **지금 기기의 테이블**이 이 모양이다. */
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
// 이 길뿐이고, **이 저장소가 처음 하는 종류의 마이그레이션**이라 잃을 것이 크다(수입 기록 전부).
describe('income_records.meso_amount 재작성 (이슈 #265)', () => {
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
  // 수입이 통째로 사라진다. 되살릴 API 가 0% 인 데이터다.
  it('기존 행을 한 건도 안 잃는다. 값까지 그대로다', async () => {
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
      category: 'item_sale',
      item: '앱솔 무기',
      itemKey: null,
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

  // 칸을 더한 커밋과 이 재작성이 또 갈린다. 수수료·통화·사냥 칸을 아직 못 받은 기기가 실제로
  // 있다. 지금 스키마의 칸 목록을 박아 두면 없는 칸을
  // `SELECT` 해 **그 자리에서 던진다**. 그 기기는 앱이 아예 안 열린다.
  it('칸이 모자란 옛 기기도 옮긴다. 없던 칸은 NULL 이다', async () => {
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
  it('ensureColumn 들보다 먼저 돈다. 옮긴 뒤엔 붙일 칸이 없다', async () => {
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

  // 재작성은 행을 통째로 옮기는 비싼 일이다. 메이린 UPDATE 들과 같은 성질을 가져야 한다.
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
 * 시트가 넘기는 드래프트는 `IncomeSheet.test.tsx` 가 붙들고 있고(`mesoAmount: null` ·
 * `pointAmount: 30000` …), 그 아래가 여기서 처음 진짜 DB 를 만난다.
 */
describe('기타를 메포·캐시로 적어도 저장된다 (목이 아닌 SQLite)', () => {
  const base = {
    ocid: null,
    earnedOn: '2026-08-28',
    category: 'etc',
    item: '이벤트 보상',
    itemKey: null,
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

  // 막혀 있던 것은 메포·캐시 하나뿐이었다. 고치면서 나머지가 조용히 상하지 않는지 함께 본다.
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
      category: 'hunting',
      item: '밤의 길 3',
      itemKey: 'tallahart_road_of_night_3',
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
        // **그때의** 캐릭터 메소 획득량. 칸이 하나 더 있다.
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

/**
 * **처음 만들어졌을 때의 `spend_records`** 에 `form` · `item_kind` 가 붙은 모양. key 칸이 생기기 전
 * 기기의 테이블이다.
 */
const OLD_SPEND_TABLE = `
  CREATE TABLE spend_records (
    id TEXT NOT NULL,
    ocid TEXT,
    spent_on TEXT NOT NULL,
    category TEXT NOT NULL,
    item TEXT,
    form TEXT,
    item_kind TEXT,
    quantity INTEGER,
    meso_amount INTEGER,
    tariff_meso INTEGER,
    point_amount INTEGER,
    point_per_100m_meso INTEGER,
    cash_amount INTEGER,
    memo TEXT,
    recorded_at TEXT NOT NULL,
    PRIMARY KEY (id)
  )
`

function userVersion(target: RealSqlite): number {
  return target.inspect((db) => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
}

// 이름만 저장된 옛 기록에 key 를 채운다. 이관은 버전 번호로 한 번씩 돈다.
describe('버전 이관: 가계부 기록에 key 를 채운다', () => {
  function seedOldDevice(): void {
    real.inspect((db) => {
      db.exec(OLD_SPEND_TABLE)
      const spend = db.prepare(
        `INSERT INTO spend_records (id, spent_on, category, item, form, item_kind, quantity, point_amount, point_per_100m_meso, meso_amount, recorded_at)
         VALUES (?, '2026-08-20', ?, ?, ?, ?, 1, NULL, NULL, 1000, '2026-08-20T00:00:00.000Z')`,
      )
      spend.run('buff', '버프', '세이람의 영약', null, null)
      // 버전 1 이 옮기는 옛 이름 둘. 옮긴 뒤의 이름으로 key 를 찾는다.
      spend.run('renamed-category', '상점·편의', '닉네임 변경', null, null)
      spend.run('renamed-item', '이벤트·BM', '미호로이드 교환권', null, null)
      // 에픽던전 리워드의 옛 모양 둘.
      spend.run('reward-joined', '컨텐츠', '하이마운틴 EXP 1단계, 솔 2단계', null, null)
      spend.run('reward-split', '컨텐츠', '악몽선경 2단계', '경험치', null)
      spend.run('purchase', '아이템 구매', '루즈 컨트롤 머신 마크', null, '소비')
      spend.run('removed', '컨텐츠', '없어진 항목', null, null)

      db.exec(OLD_INCOME_TABLE)
      for (const alter of OLD_INCOME_ALTERS) db.exec(alter)
      const income = db.prepare(
        `INSERT INTO income_records (id, earned_on, category, item, meso_amount, recorded_at)
         VALUES (?, '2026-08-20', ?, ?, 1000, '2026-08-20T00:00:00.000Z')`,
      )
      income.run('ground', '사냥', '밤의 길 3')
      income.run('typed-ground', '사냥', '츄츄 아일랜드')
      income.run('sale', '아이템 판매', '앱솔 무기')
    })
  }

  it('새 DB 는 이관할 것 없이 마지막 버전으로 선다', async () => {
    await getBossProfitDb()

    expect(userVersion(real)).toBe(4)
  })

  it('옛 지출 기록의 이름으로 갈래 · 항목 · 형태별 항목 · 종류 key 를 채운다', async () => {
    seedOldDevice()

    await getBossProfitDb()

    const rows = await getSpendRecordsBetween('2026-08-01', '2026-08-31')
    const byId = new Map(rows.map((row) => [row.id, row]))
    expect(byId.get('buff')).toMatchObject({ category: 'buff', item: '세이람의 영약', itemKey: 'seiram_elixir' })
    expect(byId.get('renamed-category')).toMatchObject({ category: 'event_bm', itemKey: 'nickname_change' })
    expect(byId.get('renamed-item')).toMatchObject({ item: '미호로이드', itemKey: 'mihoroid' })
    expect(byId.get('reward-joined')).toMatchObject({
      itemKey: null,
      formItemKeys: { exp: 'high_mountain_1', sol_erda: 'high_mountain_2' },
    })
    expect(byId.get('reward-split')).toMatchObject({ itemKey: null, formItemKeys: { exp: 'nightmare_paradise_2' } })
    expect(byId.get('purchase')).toMatchObject({ category: 'item_purchase', itemKey: null, itemKind: 'consumable' })
    expect(userVersion(real)).toBe(4)
  })

  // 못 찾은 이름은 지우지 않는다. key 만 비고 그때 이름으로 선다.
  it('못 찾는 항목은 key 만 비우고 행과 이름을 지킨다', async () => {
    seedOldDevice()

    await getBossProfitDb()

    const rows = await getSpendRecordsBetween('2026-08-01', '2026-08-31')
    expect(rows).toHaveLength(7)
    expect(rows.find((row) => row.id === 'removed')).toMatchObject({
      category: 'content',
      item: '없어진 항목',
      itemKey: null,
      formItemKeys: null,
    })
  })

  it('옛 수익 기록은 갈래 key 와 사냥터 key 를 채운다. 사냥터가 아닌 글자는 비운다', async () => {
    seedOldDevice()

    await getBossProfitDb()

    const rows = await getIncomeRecordsBetween('2026-08-01', '2026-08-31')
    const byId = new Map(rows.map((row) => [row.id, row]))
    expect(byId.get('ground')).toMatchObject({ category: 'hunting', item: '밤의 길 3', itemKey: 'tallahart_road_of_night_3' })
    expect(byId.get('typed-ground')).toMatchObject({ category: 'hunting', item: '츄츄 아일랜드', itemKey: null })
    expect(byId.get('sale')).toMatchObject({ category: 'item_sale', item: '앱솔 무기', itemKey: null })
  })

  // 부팅마다 다시 돌면 못 찾아 비워 둔 행을 매번 다시 찾는다. 버전이 오르면 다시 안 돈다.
  it('한 번 돈 이관은 다음 부팅에 다시 안 돈다', async () => {
    seedOldDevice()
    await getBossProfitDb()
    await closeBossProfitDb()
    real.inspect((db) => db.exec(`UPDATE spend_records SET item = '상점 이름', category = '상점·편의' WHERE id = 'buff'`))
    real.statements.length = 0

    await getBossProfitDb()

    expect(real.statements.some((statement) => statement.includes('상점·편의'))).toBe(false)
    expect(real.statements.some((statement) => statement.startsWith('BEGIN'))).toBe(false)
  })
})

// key 칸이 없던 드롭 기록 표. 가격 칸까지는 있던 기기다.
const OLD_DROP_TABLE = `
  CREATE TABLE boss_drop_records (
    ocid TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    period_key TEXT NOT NULL,
    drop_index INTEGER NOT NULL,
    category TEXT NOT NULL,
    item_name TEXT NOT NULL,
    slot TEXT,
    box_origin TEXT,
    ring_level INTEGER,
    quantity INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    price_state TEXT,
    price_meso INTEGER,
    price_share INTEGER,
    PRIMARY KEY (ocid, boss, difficulty, period_key, drop_index)
  )
`

describe('버전 이관: 드롭 기록에 아이템 key 를 채운다', () => {
  function seedOldDrops(): void {
    real.inspect((db) => {
      db.exec(OLD_DROP_TABLE)
      const drop = db.prepare(
        `INSERT INTO boss_drop_records (ocid, boss, difficulty, period_key, drop_index, category, item_name, slot, box_origin, ring_level, quantity, recorded_at)
         VALUES ('ocid-1', '루시드', '하드', '2026-09-10', ?, 'consumable', ?, ?, ?, ?, 1, '2026-09-11T00:00:00.000Z')`,
      )
      drop.run(0, '몽환의 벨트', '벨트', null, null)
      drop.run(1, '리스트레인트 링', null, '녹옥의 보스 반지 상자', 2)
      drop.run(2, '기타', null, '녹옥의 보스 반지 상자', 3)
      // 파일시스템에서 온 NFD 글자도 같은 이름이다.
      drop.run(3, '고통의 근원'.normalize('NFD'), null, '혼돈의 칠흑 장신구 상자', null)
      // 슬롯이 나뉘기 전의 옛 이름. 표에 없다.
      drop.run(4, '익셉셔널 해머', null, null, null)
    })
  }

  it('이름으로 아이템 key 와 상자 key 를 채운다', async () => {
    seedOldDrops()

    await getBossProfitDb()

    const rows = await getAllBossDropRecords(['ocid-1'])
    expect(rows.map((row) => [row.itemKey, row.boxOriginKey])).toEqual([
      ['dreamy_belt', null],
      ['restraint_ring', 'green_boss_ring_box'],
      ['other_ring', 'green_boss_ring_box'],
      ['source_of_suffering', 'chaos_pitch_black_accessory_box'],
      [null, null],
    ])
    expect(userVersion(real)).toBe(4)
  })

  // 못 찾은 이름은 지우지 않는다. key 만 비고 그때 이름과 가격이 남는다.
  it('못 찾는 이름은 key 만 비우고 행과 이름을 지킨다', async () => {
    seedOldDrops()

    await getBossProfitDb()

    const rows = await getAllBossDropRecords(['ocid-1'])
    expect(rows).toHaveLength(5)
    expect(rows[4]).toMatchObject({ itemKey: null, itemName: '익셉셔널 해머', boxOriginKey: null, boxOrigin: null })
  })
})

// 기본키에 보스 이름과 한글 난이도가 든 표 둘. 드롭 표는 위 OLD_DROP_TABLE 이다.
const OLD_PROFIT_TABLE = `
  CREATE TABLE boss_profit_records (
    ocid TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    cycle TEXT NOT NULL,
    period_key TEXT NOT NULL,
    party_size INTEGER NOT NULL,
    price_meso INTEGER NOT NULL,
    payout_meso INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    world TEXT,
    defeated_on TEXT,
    PRIMARY KEY (ocid, boss, difficulty, period_key)
  )
`

const OLD_PARTY_TABLE = `
  CREATE TABLE boss_party_settings (
    ocid TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    party_size INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (ocid, boss, difficulty)
  )
`

describe('버전 이관: 보스 기록 표의 기본키를 보스 key 로 다시 만든다', () => {
  function seedOldBossTables(): void {
    real.inspect((db) => {
      db.exec(OLD_PROFIT_TABLE)
      const profit = db.prepare(
        `INSERT INTO boss_profit_records (ocid, boss, difficulty, cycle, period_key, party_size, price_meso, payout_meso, recorded_at, world, defeated_on)
         VALUES ('ocid-1', ?, ?, ?, ?, 2, 1000, 500, '2026-09-11T00:00:00.000Z', '챌린저스2', ?)`,
      )
      // 옛 행에는 데이터 표기(`검은마법사`)와 API 원문(`블러디퀸`)이 섞여 있다.
      profit.run('루시드', '하드', 'weekly', '2026-09-10', '2026-09-12')
      profit.run('검은마법사', '익스트림', 'monthly', '2026-09', null)
      profit.run('블러디퀸', '카오스', 'weekly', '2026-09-10', null)
      // 보스 표에 없는 보스. 기본키를 못 채워 옮기지 않는다.
      profit.run('카이', '노멀', 'weekly', '2026-09-10', null)

      db.exec(OLD_PARTY_TABLE)
      const party = db.prepare(
        `INSERT INTO boss_party_settings (ocid, boss, difficulty, party_size, updated_at) VALUES ('ocid-1', ?, ?, ?, '2026-09-11T00:00:00.000Z')`,
      )
      party.run('시즌 보스 메이린', '하드', 1)
      party.run('카이', '노멀', 3)

      db.exec(OLD_DROP_TABLE)
      db.prepare(
        `INSERT INTO boss_drop_records (ocid, boss, difficulty, period_key, drop_index, category, item_name, quantity, recorded_at, price_state, price_meso, price_share)
         VALUES ('ocid-1', '루시드', '하드', '2026-09-10', 0, 'equipment', '몽환의 벨트', 1, '2026-09-11T00:00:00.000Z', 'entered', 9000, 2)`,
      ).run()
    })
  }

  it('수익 기록의 보스 이름으로 보스 key 를 채우고 난이도를 key 로 옮긴다. 이름 · 월드 · 날짜는 그대로다', async () => {
    seedOldBossTables()

    await getBossProfitDb()

    const rows = await getBossProfitRecords(['ocid-1'], ['2026-09-10', '2026-09'])
    expect(
      rows.map((row) => [row.bossKey, row.boss, row.difficulty, row.world, row.defeatedOn]).sort(),
    ).toEqual(
      [
        ['black_mage', '검은마법사', 'extreme', '챌린저스2', null],
        ['crimson_queen', '블러디퀸', 'chaos', '챌린저스2', null],
        ['lucid', '루시드', 'hard', '챌린저스2', '2026-09-12'],
      ].sort(),
    )
    expect(userVersion(real)).toBe(4)
  })

  it('파티 설정과 드롭 기록도 보스 key 로 옮기고, 드롭의 아이템 key 와 가격을 지킨다', async () => {
    seedOldBossTables()

    await getBossProfitDb()

    expect((await getBossPartySettings(['ocid-1'])).map(({ bossKey, difficulty, partySize }) => [bossKey, difficulty, partySize])).toEqual([
      ['meirin', 'hard', 1],
    ])
    const [drop] = await getAllBossDropRecords(['ocid-1'])
    expect(drop).toMatchObject({
      bossKey: 'lucid',
      boss: '루시드',
      difficulty: 'hard',
      itemKey: 'dreamy_belt',
      priceState: 'entered',
      priceMeso: 9000,
      priceShare: 2,
    })
  })

  // 새 기본키가 보스 key 라 이름 칸이 달라도 같은 행을 고친다.
  it('다시 만든 표는 보스 key 로 행을 가른다', async () => {
    seedOldBossTables()
    await getBossProfitDb()

    await upsertBossProfitRecord({
      ocid: 'ocid-1',
      bossKey: 'lucid',
      boss: '루시드',
      difficulty: 'hard',
      cycle: 'weekly',
      periodKey: '2026-09-10',
      partySize: 3,
      priceMeso: 1000,
      payoutMeso: 333,
      recordedAt: '2026-09-12T00:00:00.000Z',
      world: null,
    })
    await setBossPartySize('ocid-1', 'meirin', 'hard', 2, '2026-09-12T00:00:00.000Z')
    await replaceBossDropRecords('ocid-1', 'lucid', 'hard', '2026-09-10', [], '2026-09-12T00:00:00.000Z')

    const lucid = (await getBossProfitRecords(['ocid-1'], ['2026-09-10'])).filter((row) => row.bossKey === 'lucid')
    expect(lucid).toHaveLength(1)
    expect(lucid[0]).toMatchObject({ partySize: 3, world: '챌린저스2', defeatedOn: '2026-09-12' })
    expect((await getBossPartySettings(['ocid-1'])).map((setting) => setting.partySize)).toEqual([2])
    expect(await getAllBossDropRecords(['ocid-1'])).toEqual([])
  })

  it('새 DB 는 새 모양 표로 서고 옮길 것 없이 마지막 버전이다', async () => {
    await getBossProfitDb()

    const columns = real.inspect((db) =>
      (db.prepare('PRAGMA table_info(boss_profit_records)').all() as { name: string; pk: number }[])
        .filter((column) => column.pk > 0)
        .map((column) => column.name),
    )
    expect(columns).toEqual(['ocid', 'boss_key', 'difficulty', 'period_key'])
    expect(userVersion(real)).toBe(4)
  })
})
