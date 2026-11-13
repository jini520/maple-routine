/// <reference types="node" />
/**
 * 손입력 수입 어댑터를 진짜 SQLite 로 태운다. 수입은 가계부 기록 표 셋에 `entry_type = 'income'` 으로 살고, 사냥의
 * 계산 입력은 사냥 입력 표에 따로 든다. 넣은 모양이 그대로 되읽히는지와 조각 보관 셈을 본다.
 */
import { recordCharacterAccounts } from '../character-accounts'
import {
  assignLegacyIncomeAccounts,
  deleteIncomeRecord,
  getFragmentStorage,
  getIncomeRecordsBetween,
  getIncomeRecordsRevision,
  insertIncomeRecord,
  updateIncomeRecord,
  type IncomeRecord,
} from '../income'
import { __resetStoragePortsForTest, setSqlitePort } from '../ports'
import { closeBossProfitDb } from '../sqlite/db'
import { createRealSqlite, type RealSqlite } from '../sqlite/__tests__/node-sqlite-port'

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

let next = 0
/** 기록마다 다른 uuid 모양 id. */
function idOf(): string {
  next += 1
  return `7a2c0e2c-0000-4000-8000-${String(next).padStart(12, '0')}`
}

/** 경매장에서 판 장비. 수수료를 뗀 값과 뗀 몫을 함께 든다. */
const sale: IncomeRecord = {
  id: idOf(),
  ocid: 'ocid-1',
  earnedOn: '2026-08-20',
  category: 'item_sale',
  item: '앱솔 무기',
  itemKey: null,
  mesoAmount: 4_750_000_000,
  pointAmount: null,
  pointPer100mMeso: null,
  cashAmount: null,
  quantity: null,
  itemKind: 'equipment',
  saleFeePercent: 5,
  saleFeeMeso: 250_000_000,
  saleFeeAuto: true,
  hunt: null,
  recordedAt: '2026-08-20T12:00:00.000Z',
}

/** 계산기로 센 사냥. 소재 수가 품목의 수량으로 간다. */
const calculatorHunt: IncomeRecord = {
  ...sale,
  id: idOf(),
  category: 'hunting',
  item: null,
  itemKey: 'tallahart_road_of_night_3',
  mesoAmount: 900_000_000,
  itemKind: null,
  saleFeePercent: null,
  saleFeeMeso: null,
  saleFeeAuto: false,
  hunt: {
    mode: 'calculator',
    characterLevel: 285,
    missedMobs: 2,
    boosts: ['wealth', 'exp_coupon'],
    sojae: 8,
    fragments: 30,
    fragmentPrice: null,
    mesoRate: 120,
    unionTier: 2,
  },
}

describe('넣은 수입을 같은 모양으로 되읽는다', () => {
  it.each<[string, IncomeRecord]>([
    ['수수료를 뗀 장비 판매', sale],
    ['소비 아이템 판매. 판 개수를 든다', { ...sale, id: idOf(), itemKind: 'consumable', quantity: 10 }],
    ['계산기 사냥', calculatorHunt],
    [
      // 조각만 먹은 사냥은 친 메소가 0 이어도 수동이다. 0 과 빈 칸이 갈리는 자리다.
      '친 메소가 0 인 수동 사냥',
      { ...calculatorHunt, id: idOf(), mesoAmount: 0, hunt: { mode: 'manual', typedMeso: 0, fragments: 12, fragmentPrice: 0 } },
    ],
    ['계산 입력이 없던 옛 사냥', { ...calculatorHunt, id: idOf(), itemKey: null, item: '츄츄 아일랜드', hunt: null }],
    ['메이플 ID 에 붙은 기타', { ...sale, id: idOf(), ocid: null, accountId: 'maple-a', category: 'etc', itemKind: null }],
    [
      '메포 기타. 주인을 모르는 옛 기록이다',
      {
        ...sale,
        id: idOf(),
        ocid: null,
        category: 'etc',
        item: '이벤트 보상',
        itemKind: null,
        mesoAmount: null,
        pointAmount: 3_000,
        pointPer100mMeso: 1_200,
        quantity: 2,
        saleFeePercent: null,
        saleFeeMeso: null,
        saleFeeAuto: false,
      },
    ],
  ])('%s', async (_, record) => {
    await insertIncomeRecord(record)

    expect(await getIncomeRecordsBetween(record.earnedOn, record.earnedOn)).toEqual([record])
  })

  it('사냥은 품목 하나에 소재 수를 수량으로 두고, 계산 입력은 사냥 입력 표에 둔다', async () => {
    await insertIncomeRecord(calculatorHunt)

    expect(all('SELECT item_key, quantity FROM cashbook_entry_items')).toEqual([
      { item_key: 'tallahart_road_of_night_3', quantity: 8 },
    ])
    expect(all('SELECT missed_mobs, boosts, typed_meso, union_tier FROM cashbook_entry_hunt_inputs')).toEqual([
      { missed_mobs: 2, boosts: 'wealth,exp_coupon', typed_meso: null, union_tier: 2 },
    ])
  })
})

describe('고치기 · 지우기', () => {
  it('고치면 저장 시각은 그대로이고, 사냥을 수동으로 바꾸면 계산기 칸이 빈다', async () => {
    await insertIncomeRecord(calculatorHunt)

    const edited: IncomeRecord = {
      ...calculatorHunt,
      earnedOn: '2026-08-21',
      hunt: { mode: 'manual', typedMeso: 800_000_000, fragments: 0, fragmentPrice: null },
    }
    await updateIncomeRecord(edited)

    expect(await getIncomeRecordsBetween('2026-08-01', '2026-08-31')).toEqual([edited])
    expect(all('SELECT missed_mobs, typed_meso FROM cashbook_entry_hunt_inputs')).toEqual([
      { missed_mobs: null, typed_meso: 800_000_000 },
    ])
  })

  it('지우면 그 기록과 품목 · 사냥 입력이 함께 사라진다', async () => {
    await insertIncomeRecord(sale)
    await insertIncomeRecord(calculatorHunt)

    await deleteIncomeRecord(calculatorHunt.id)

    expect(await getIncomeRecordsBetween('2026-08-20', '2026-08-20')).toEqual([sale])
    expect(all('SELECT count(*) AS n FROM cashbook_entry_hunt_inputs')).toEqual([{ n: 0 }])
  })
})

describe('assignLegacyIncomeAccounts: 주인을 모르는 옛 수입을 메이플 ID 로 옮긴다', () => {
  // 사냥은 이미 캐릭터가 필수라 옛 기록도 옮기지 않는다. 수정으로 열면 캐릭터를 골라야 저장된다.
  it('넥슨 계정의 메이플 ID 가 하나면 고를 수 있는 분류의 옛 기록만 옮기고, 판은 옮긴 것이 있을 때만 오른다', async () => {
    await recordCharacterAccounts(
      [{ accountId: 'maple-a', characters: [{ ocid: 'ocid-1', name: '낟낟', world: '스카니아', worldKey: 'scania', jobClass: '히어로', level: 280 }] }],
      '2026-08-01',
      'account-a',
    )
    const etc: IncomeRecord = { ...sale, id: idOf(), ocid: null, category: 'etc', itemKind: null }
    const hunt: IncomeRecord = { ...calculatorHunt, id: idOf(), ocid: null }
    for (const record of [etc, hunt]) {
      await insertIncomeRecord(record)
      real.inspect((db) => db.prepare(`UPDATE cashbook_entries SET nexon_account_id = 'account-a' WHERE id = ?`).run(record.id))
    }
    const before = getIncomeRecordsRevision()

    await assignLegacyIncomeAccounts(['etc'])
    await assignLegacyIncomeAccounts(['etc'])

    expect(all('SELECT category_key, account_id, nexon_account_id FROM cashbook_entries ORDER BY category_key')).toEqual([
      { category_key: 'etc', account_id: 'maple-a', nexon_account_id: null },
      { category_key: 'hunting', account_id: null, nexon_account_id: 'account-a' },
    ])
    expect(getIncomeRecordsRevision()).toBe(before + 1)
  })
})

describe('getFragmentStorage: 캐릭터별 솔 에르다 조각 보관', () => {
  // 가격을 안 적은 사냥의 조각이 쌓이고, 정산 기록이 판 개수만큼 빠진다. 뒤 날짜에 판 조각은 앞 날짜에서도 없다.
  it('그 날과 뒤 모든 날의 남은 개수 가운데 가장 작은 값이고, 수정 중인 정산은 뺀다', async () => {
    await insertIncomeRecord(calculatorHunt)
    await insertIncomeRecord({
      ...calculatorHunt,
      id: idOf(),
      hunt: { mode: 'manual', typedMeso: 0, fragments: 20, fragmentPrice: 5_000_000 },
    })
    await insertIncomeRecord({ ...calculatorHunt, id: idOf(), ocid: 'ocid-2' })
    await insertIncomeRecord({ ...calculatorHunt, id: idOf(), earnedOn: '2026-08-25' })
    const settle: IncomeRecord = {
      ...sale,
      id: idOf(),
      category: 'sol_erda_fragment',
      item: null,
      itemKind: null,
      earnedOn: '2026-08-25',
      quantity: 50,
    }
    await insertIncomeRecord(settle)

    // 08-20 에 30, 08-25 에 30 을 더 보관하고 08-25 에 50 을 팔았다. 08-20 에 쓸 수 있는 것은 남은 10 이다.
    await expect(getFragmentStorage('ocid-1', '2026-08-20')).resolves.toBe(10)
    await expect(getFragmentStorage('ocid-1', '2026-08-25')).resolves.toBe(10)
    await expect(getFragmentStorage('ocid-1', '2026-08-20', settle.id)).resolves.toBe(30)
    await expect(getFragmentStorage('ocid-3', '2026-08-20')).resolves.toBe(0)
  })
})
