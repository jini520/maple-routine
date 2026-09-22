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
import { getFragmentStorage, getIncomeRecordsBetween, insertIncomeRecord, type IncomeRecord } from '../../income'
import { getSpendRecordsBetween, insertSpendRecord, type SpendRecord } from '../../spend'
import { getAllBossDropRecords, replaceBossDropRecords } from '../../boss-drops'
import { getBossPartySettings, setBossPartySetting } from '../../boss-party-settings'
import { getBossProfitRecords, upsertBossProfitRecord, type BossProfitRecord } from '../../boss-profit'
import { getCharacterProfiles } from '../../character-profiles'
import { loadEnhancementHistory } from '../../enhancement-history'
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
      saleFeeAuto: false,
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
    saleFeeAuto: false,
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

// 칸을 더한 커밋 전에 테이블을 만든 기기는 CREATE 문이 칸을 안 붙인다. `ensureColumn` 이 붙여야 INSERT 가 통한다.
describe('심볼 강화의 레벨 두 칸', () => {
  const 심볼기록: SpendRecord = {
    id: 'symbol',
    ocid: null,
    spentOn: '2026-09-19',
    category: 'symbol',
    item: '소멸의 여로 Lv.3 → 7',
    itemKey: 'road_of_vanishing',
    formItemKeys: null,
    itemKind: null,
    levelFrom: 3,
    levelTo: 7,
    quantity: null,
    mesoAmount: 7_700_000,
    tariffMeso: null,
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
    memo: null,
    recordedAt: '2026-09-19T10:00:00.000Z',
  }

  it('새 DB 에 적고 그대로 되읽는다', async () => {
    await getBossProfitDb()

    await insertSpendRecord(심볼기록)

    expect(await getSpendRecordsBetween('2026-09-19', '2026-09-19')).toEqual([심볼기록])
  })

  it('레벨 칸이 없던 옛 기기의 테이블에도 적힌다. 옛 행의 두 칸은 NULL 이다', async () => {
    real.inspect((db) => {
      db.exec(OLD_SPEND_TABLE)
      db.exec(
        `INSERT INTO spend_records (id, spent_on, category, item, quantity, meso_amount, recorded_at)
         VALUES ('old', '2026-09-19', '버프', '세이람의 영약', 1, 2000000, '2026-09-19T00:00:00.000Z')`,
      )
    })

    await getBossProfitDb()
    await insertSpendRecord(심볼기록)

    const rows = await getSpendRecordsBetween('2026-09-19', '2026-09-19')
    expect(rows.find((row) => row.id === 'old')).toMatchObject({ levelFrom: null, levelTo: null })
    expect(rows.find((row) => row.id === 'symbol')).toMatchObject({ levelFrom: 3, levelTo: 7 })
  })
})

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

    expect(userVersion(real)).toBe(9)
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
    expect(userVersion(real)).toBe(9)
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
    expect(userVersion(real)).toBe(9)
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
    expect(userVersion(real)).toBe(9)
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
      crystalMyShare: null,
      crystalSharesTotal: null,
      splitFeePercent: null,
      recordedAt: '2026-09-12T00:00:00.000Z',
      world: null,
      worldKey: null,
    })
    await setBossPartySetting({ ocid: 'ocid-1', bossKey: 'meirin', difficulty: 'hard', partySize: 2, crystalMyShare: null, crystalSharesTotal: null, dropMyShare: null, dropSharesTotal: null, splitFeePercent: null, updatedAt: '2026-09-12T00:00:00.000Z' })
    await replaceBossDropRecords('ocid-1', 'lucid', 'hard', '2026-09-10', [], '2026-09-12T00:00:00.000Z')

    const lucid = (await getBossProfitRecords(['ocid-1'], ['2026-09-10'])).filter((row) => row.bossKey === 'lucid')
    expect(lucid).toHaveLength(1)
    expect(lucid[0]).toMatchObject({ partySize: 3, world: '챌린저스2', worldKey: 'challengers_2', defeatedOn: '2026-09-12' })
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
    expect(userVersion(real)).toBe(9)
  })
})

// 장비 key 칸이 없던 강화 기록 표.
const OLD_ENHANCEMENT_TABLE = `
  CREATE TABLE enhancement_history (
    id TEXT NOT NULL,
    kind TEXT NOT NULL,
    date_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    character_name TEXT NOT NULL,
    target_item TEXT NOT NULL,
    item_level INTEGER,
    payload TEXT NOT NULL,
    cost_meso INTEGER,
    PRIMARY KEY (id)
  )
`

describe('버전 이관: 강화 기록에 장비 key 를 채운다', () => {
  function seedOldEnhancements(): void {
    real.inspect((db) => {
      db.exec(OLD_ENHANCEMENT_TABLE)
      const row = db.prepare(
        `INSERT INTO enhancement_history (id, kind, date_key, created_at, character_name, target_item, item_level, payload)
         VALUES (?, ?, '2026-09-04', ?, '낟낟', ?, ?, '{}')`,
      )
      row.run('a', 'starforce', '2026-09-04T07:00:01+09:00', '아케인셰이드 나이트햇', null)
      // 드롭 표와 key 를 맞춘 장비다.
      row.run('b', 'cube', '2026-09-04T07:00:02+09:00', '루즈 컨트롤 머신 마크', 160)
      // 장비 표에 없는 장비. key 가 비고 행은 남는다.
      row.run('c', 'cube', '2026-09-04T07:00:03+09:00', '골드 히어로즈 엠블렘', 100)
    })
  }

  it('API 이름으로 장비 key 를 채우고, 못 찾는 장비는 key 만 비운 채 행과 이름을 지킨다', async () => {
    seedOldEnhancements()

    await getBossProfitDb()

    const rows = await loadEnhancementHistory(['2026-09-04'])
    expect(rows.map((row) => [row.id, row.itemKey, row.targetItem])).toEqual([
      ['a', 'arcane_umbra_knight_hat', '아케인셰이드 나이트햇'],
      ['b', 'loose_control_machine_mark', '루즈 컨트롤 머신 마크'],
      ['c', null, '골드 히어로즈 엠블렘'],
    ])
    expect(userVersion(real)).toBe(9)
  })
})

// 월드 key 칸이 없던 버전 5 기기의 두 표. 수익 기록은 이미 보스 key 로 다시 만든 모양이다.
const V5_PROFIT_TABLE = `
  CREATE TABLE boss_profit_records (
    ocid TEXT NOT NULL,
    boss_key TEXT NOT NULL,
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
    PRIMARY KEY (ocid, boss_key, difficulty, period_key)
  )
`

const V5_PROFILE_TABLE = `
  CREATE TABLE character_profiles (
    ocid TEXT NOT NULL,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    world TEXT,
    level INTEGER,
    job_class TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (ocid)
  )
`

describe('버전 이관: 수익 기록 · 프로필에 월드 key 를 채운다', () => {
  function seedV5Device(): void {
    real.inspect((db) => {
      db.exec(V5_PROFIT_TABLE)
      const profit = db.prepare(
        `INSERT INTO boss_profit_records (ocid, boss_key, boss, difficulty, cycle, period_key, party_size, price_meso, payout_meso, recorded_at, world)
         VALUES (?, 'lucid', '루시드', 'hard', 'weekly', '2026-09-10', 1, 1000, 1000, '2026-09-11T00:00:00.000Z', ?)`,
      )
      profit.run('ocid-1', '엘리시움')
      profit.run('ocid-2', '챌린저스2')
      // 월드를 모르는 기록. key 도 비어 있어야 한다.
      profit.run('ocid-3', null)

      db.exec(V5_PROFILE_TABLE)
      const profile = db.prepare(
        `INSERT INTO character_profiles (ocid, name, image_url, world, level, job_class, updated_at)
         VALUES (?, ?, '', ?, 285, '레테', '2026-09-11T00:00:00.000Z')`,
      )
      profile.run('ocid-1', '낟낟', '엘리시움')
      profile.run('ocid-2', '지내우시', '챌린저스2')
      profile.run('ocid-3', '모름', null)
      db.exec('PRAGMA user_version = 5')
    })
  }

  it('월드 이름으로 월드 key 를 채우고, 월드를 모르는 행은 비워 둔다', async () => {
    seedV5Device()

    await getBossProfitDb()

    const records = await getBossProfitRecords(['ocid-1', 'ocid-2', 'ocid-3'], ['2026-09-10'])
    expect(records.map((record) => [record.ocid, record.world, record.worldKey]).sort()).toEqual([
      ['ocid-1', '엘리시움', 'elysium'],
      ['ocid-2', '챌린저스2', 'challengers_2'],
      ['ocid-3', null, null],
    ])
    const profiles = await getCharacterProfiles(['ocid-1', 'ocid-2', 'ocid-3'])
    expect([...profiles.values()].map((profile) => [profile.ocid, profile.world, profile.worldKey]).sort()).toEqual([
      ['ocid-1', '엘리시움', 'elysium'],
      ['ocid-2', '챌린저스2', 'challengers_2'],
      ['ocid-3', null, null],
    ])
    expect(userVersion(real)).toBe(9)
  })
})

/** 이 버전까지 돈 기기로 되돌린다. 행을 넣은 뒤 부르면 다음 부팅에 그 뒤 버전이 그 행 위에서 돈다. */
async function rewindTo(version: number): Promise<void> {
  await closeBossProfitDb()
  real.inspect((db) => db.exec(`PRAGMA user_version = ${version}`))
}

// OTA 1.0.10 의 가격표에서 두 새 가격이 서로 바뀌어 있었다. 틀린 값으로 굳은 행만 고친다.
describe('버전 이관: 카링 노멀과 찬란한 흉성 노멀의 뒤바뀐 새 가격을 고친다', () => {
  function record(overrides: Partial<BossProfitRecord>): BossProfitRecord {
    return {
      ocid: 'ocid-1',
      bossKey: 'kaling',
      boss: '카링',
      difficulty: 'normal',
      cycle: 'weekly',
      periodKey: '2026-09-17',
      partySize: 1,
      priceMeso: 0,
      payoutMeso: 0,
      crystalMyShare: null,
      crystalSharesTotal: null,
      splitFeePercent: null,
      recordedAt: '2026-09-17T02:00:00.000Z',
      world: '엘리시움',
      worldKey: 'elysium',
      ...overrides,
    }
  }

  it('틀린 새 가격이 든 행을 인게임 가격과 그 분배액으로 다시 적는다', async () => {
    await getBossProfitDb()
    await upsertBossProfitRecord(record({ partySize: 2, priceMeso: 576_000_000, payoutMeso: 288_000_000 }))
    await upsertBossProfitRecord(
      record({
        bossKey: 'radiant_malefic_star',
        boss: '찬란한 흉성',
        partySize: 3,
        priceMeso: 593_000_000,
        payoutMeso: 197_666_666,
        crystalMyShare: null,
        crystalSharesTotal: null,
        splitFeePercent: null,
      }),
    )
    await rewindTo(7)

    await getBossProfitDb()

    const records = await getBossProfitRecords(['ocid-1'], ['2026-09-17'])
    expect(records.map((each) => [each.bossKey, each.priceMeso, each.payoutMeso]).sort()).toEqual([
      ['kaling', 593_000_000, 296_500_000],
      ['radiant_malefic_star', 576_000_000, 192_000_000],
    ])
    expect(userVersion(real)).toBe(9)
  })

  // 10시 전에 굳었거나 버전 7 이 되돌린 행이다. 사용자가 옛 가격 행은 두라고 했다.
  it('옛 가격이 든 행과 다른 난이도 · 보스는 안 건드린다', async () => {
    await getBossProfitDb()
    await upsertBossProfitRecord(record({ ocid: 'ocid-2', priceMeso: 678_000_000, payoutMeso: 678_000_000 }))
    await upsertBossProfitRecord(
      record({
        ocid: 'ocid-2',
        bossKey: 'radiant_malefic_star',
        boss: '찬란한 흉성',
        priceMeso: 625_000_000,
        payoutMeso: 625_000_000,
        crystalMyShare: null,
        crystalSharesTotal: null,
        splitFeePercent: null,
      }),
    )
    // 난이도가 다르면 같은 값이어도 안 건드린다.
    await upsertBossProfitRecord(
      record({ ocid: 'ocid-2', difficulty: 'hard', priceMeso: 576_000_000, payoutMeso: 576_000_000 }),
    )
    await rewindTo(7)

    await getBossProfitDb()

    const records = await getBossProfitRecords(['ocid-2'], ['2026-09-17'])
    expect(records.map((each) => [each.bossKey, each.difficulty, each.priceMeso, each.payoutMeso]).sort()).toEqual([
      ['kaling', 'hard', 576_000_000, 576_000_000],
      ['kaling', 'normal', 678_000_000, 678_000_000],
      ['radiant_malefic_star', 'normal', 625_000_000, 625_000_000],
    ])
  })
})

// 조각 가격 칸이 0 과 빈 칸을 못 가르던 때의 기록. 이번 한 번만 0 도 안 적은 가격으로 옮긴다.
describe('버전 이관: 사냥 기록의 조각 가격 0 을 안 적은 가격으로 옮긴다', () => {
  const hunt: IncomeRecord = {
    id: '',
    ocid: 'ocid-adele',
    earnedOn: '2026-09-10',
    category: 'hunting',
    item: null,
    itemKey: null,
    mesoAmount: 1_000_000_000,
    saleFeePercent: null,
    saleFeeMeso: null,
    saleFeeAuto: false,
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
    quantity: null,
    hunt: { mode: 'manual', typedMeso: 1_000_000_000, fragments: 80, fragmentPrice: 0 },
    memo: null,
    recordedAt: '2026-09-10T05:00:00.000Z',
  }

  async function seed(): Promise<void> {
    await getBossProfitDb()
    // 체크를 켜고 적은 기록. 가격은 언제나 0 이었다.
    await insertIncomeRecord({ ...hunt, id: 'checked' })
    real.inspect((db) => db.exec(`UPDATE income_records SET hunt_fragments_deferred = 1 WHERE id = 'checked'`))
    // 체크를 안 켜고 가격을 비운 기록.
    await insertIncomeRecord({ ...hunt, id: 'unchecked', hunt: { ...hunt.hunt!, fragments: 40 } as IncomeRecord['hunt'] })
    // 가격을 적은 기록.
    await insertIncomeRecord({
      ...hunt,
      id: 'sold',
      mesoAmount: 1_080_000_000,
      hunt: { mode: 'manual', typedMeso: 1_000_000_000, fragments: 10, fragmentPrice: 8_000_000 },
    })
    // 계산기 도입 전 행. 사냥 칸이 전부 비어 있다.
    await insertIncomeRecord({ ...hunt, id: 'legacy', item: '엘리시움', hunt: null })
    await rewindTo(8)
  }

  it('가격 0 을 NULL 로 옮기고, 적은 가격과 옛 행은 그대로 둔다. 금액도 그대로다', async () => {
    await seed()

    await getBossProfitDb()

    const rows = await getIncomeRecordsBetween('2026-09-10', '2026-09-10')
    const byId = new Map(rows.map((row) => [row.id, row]))
    expect(byId.get('checked')?.hunt?.fragmentPrice).toBeNull()
    expect(byId.get('unchecked')?.hunt?.fragmentPrice).toBeNull()
    expect(byId.get('sold')?.hunt?.fragmentPrice).toBe(8_000_000)
    expect(byId.get('legacy')?.hunt).toBeNull()
    expect(rows.map((row) => [row.id, row.mesoAmount]).sort()).toEqual([
      ['checked', 1_000_000_000],
      ['legacy', 1_000_000_000],
      ['sold', 1_080_000_000],
      ['unchecked', 1_000_000_000],
    ])
    expect(userVersion(real)).toBe(9)
  })

  it('옮긴 두 기록의 조각이 보관에 들고, 이관 뒤에 0 으로 적은 조각은 안 든다', async () => {
    await seed()

    await getBossProfitDb()
    await insertIncomeRecord({ ...hunt, id: 'zero-after', hunt: { ...hunt.hunt!, fragments: 5 } as IncomeRecord['hunt'] })

    await expect(getFragmentStorage('ocid-adele', '2026-09-10')).resolves.toBe(120)
  })
})
