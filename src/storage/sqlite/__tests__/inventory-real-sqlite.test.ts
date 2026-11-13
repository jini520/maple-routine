/// <reference types="node" />
/**
 * 인벤토리에 넣은 아이템을 진짜 SQLite 로 태운다. 남은 개수를 저장하지 않고 판매 · 조각 사용을 빼서 세는지, 수정 · 삭제가
 * 남은 개수만 바꾸는지, 남은 것보다 많이 가져가는 저장이 되돌아가는지 본다.
 */
import { FragmentShortageError } from '../../fragment-ledger'
import { getFragmentStorage, insertIncomeRecord, type IncomeRecord } from '../../income'
import {
  addInventoryItem,
  deleteInventoryRemaining,
  getInventoryItems,
  InventoryShortageError,
  setInventoryRemaining,
  SOL_ERDA_FRAGMENT_ITEM_KEY,
  type InventoryItem,
} from '../../inventory'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { insertSpendRecord, type SpendHexa, type SpendRecord } from '../../spend'
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

const NOW = new Date('2026-11-13T03:00:00.000Z')
const SCANIA = { accountId: 'maple-a', worldKey: 'scania' }

function itemSale(id: string, inventoryItemId: string, quantity: number | null): IncomeRecord {
  return {
    id,
    ocid: null,
    accountId: SCANIA.accountId,
    earnedOn: '2026-11-12',
    category: 'item_sale',
    item: null,
    itemKey: 'stone',
    mesoAmount: 1_000_000,
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
    quantity,
    itemKind: quantity === null ? 'equipment' : 'consumable',
    saleFeePercent: null,
    saleFeeMeso: null,
    saleFeeAuto: false,
    hunt: null,
    recordedAt: '2026-11-12T01:00:00.000Z',
    inventoryItemId,
  }
}

function hexa(id: string, uses: Pick<SpendHexa, 'storageUses' | 'otherUse'>): SpendRecord {
  const fragments = uses.storageUses.reduce((sum, use) => sum + use.fragments, uses.otherUse?.fragments ?? 0)
  return {
    id,
    ocid: 'ocid-a',
    spentOn: '2026-11-12',
    category: 'hexa_matrix',
    item: null,
    itemKey: 'hexa_stat',
    formItemKeys: null,
    itemKind: null,
    levelFrom: null,
    levelTo: null,
    quantity: null,
    mesoAmount: 0,
    tariffMeso: null,
    pointAmount: null,
    pointPer100mMeso: null,
    mesoMarketFeePercent: null,
    cashAmount: null,
    hexa: {
      fragmentCount: fragments,
      untradableFragmentCount: 0,
      fragmentPrice: null,
      activation: true,
      useStorage: true,
      storageAsSpend: false,
      ...uses,
    },
    recordedAt: '2026-11-12T02:00:00.000Z',
  }
}

function hexaTakingOther(id: string, fragments: number): SpendRecord {
  return hexa(id, { storageUses: [], otherUse: { ...SCANIA, fragments } })
}

async function only(itemKey: string): Promise<InventoryItem> {
  const items = (await getInventoryItems()).filter((item) => item.itemKey === itemKey)
  expect(items).toHaveLength(1)
  return items[0]!
}

describe('인벤토리 넣기', () => {
  it('같은 메이플 ID · 월드에 같은 아이템을 다시 넣으면 그 줄의 개수가 는다', async () => {
    await addInventoryItem({ ...SCANIA, itemKey: 'stone', itemKindKey: 'consumable', quantity: 3 }, NOW)
    await addInventoryItem({ ...SCANIA, itemKey: 'stone', itemKindKey: 'consumable', quantity: 2 }, NOW)

    expect(await only('stone')).toMatchObject({ quantity: 5, remaining: 5 })
  })

  it('주인이 다르면 같은 아이템이어도 줄이 따로 선다', async () => {
    await addInventoryItem({ ...SCANIA, itemKey: 'stone', itemKindKey: 'consumable', quantity: 1 }, NOW)
    await addInventoryItem({ accountId: 'maple-b', worldKey: 'scania', itemKey: 'stone', itemKindKey: 'consumable', quantity: 1 }, NOW)
    await addInventoryItem({ accountId: 'maple-a', worldKey: 'bera', itemKey: 'stone', itemKindKey: 'consumable', quantity: 1 }, NOW)

    expect(await getInventoryItems()).toHaveLength(3)
  })

  it('장비는 겹치지 않아 다시 넣으면 줄이 하나 더 생긴다', async () => {
    await addInventoryItem({ ...SCANIA, itemKey: 'belt', itemKindKey: 'equipment', quantity: 1 }, NOW)
    await addInventoryItem({ ...SCANIA, itemKey: 'belt', itemKindKey: 'equipment', quantity: 1 }, NOW)

    expect((await getInventoryItems()).map((item) => item.quantity)).toEqual([1, 1])
  })
})

describe('남은 개수', () => {
  it('넣은 개수에서 그 줄을 가리키는 판매의 수량을 뺀다. 장비 판매는 하나로 센다', async () => {
    await addInventoryItem({ ...SCANIA, itemKey: 'stone', itemKindKey: 'consumable', quantity: 10 }, NOW)
    await addInventoryItem({ ...SCANIA, itemKey: 'belt', itemKindKey: 'equipment', quantity: 1 }, NOW)
    const stone = await only('stone')
    const belt = await only('belt')

    await insertIncomeRecord(itemSale('sale-1', stone.id, 4))
    await insertIncomeRecord({ ...itemSale('sale-2', belt.id, null), itemKey: 'belt' })

    expect(await only('stone')).toMatchObject({ quantity: 10, used: 4, remaining: 6 })
    expect(await only('belt')).toMatchObject({ quantity: 1, used: 1, remaining: 0 })
  })

  it('기타 조각은 그 메이플 ID · 월드의 조각 사용을 빼고, 사냥 조각 보관은 그 사용을 빼지 않는다', async () => {
    await addInventoryItem({ ...SCANIA, itemKey: SOL_ERDA_FRAGMENT_ITEM_KEY, itemKindKey: 'etc', quantity: 30 }, NOW)

    await insertSpendRecord(hexaTakingOther('hexa-1', 12))

    expect(await only(SOL_ERDA_FRAGMENT_ITEM_KEY)).toMatchObject({ quantity: 30, used: 12, remaining: 18 })
    expect(await getFragmentStorage('ocid-a', '2026-11-12')).toBe(0)
  })

  it('남은 것보다 많이 파는 저장은 되돌아간다', async () => {
    await addInventoryItem({ ...SCANIA, itemKey: 'stone', itemKindKey: 'consumable', quantity: 2 }, NOW)
    const stone = await only('stone')

    await expect(insertIncomeRecord(itemSale('sale-1', stone.id, 3))).rejects.toBeInstanceOf(InventoryShortageError)

    expect(await only('stone')).toMatchObject({ used: 0, remaining: 2 })
  })

  it('기타 조각보다 많이 가져가는 헥사 강화는 되돌아간다', async () => {
    await addInventoryItem({ ...SCANIA, itemKey: SOL_ERDA_FRAGMENT_ITEM_KEY, itemKindKey: 'etc', quantity: 5 }, NOW)

    await expect(insertSpendRecord(hexaTakingOther('hexa-1', 6))).rejects.toBeInstanceOf(InventoryShortageError)

    expect(await only(SOL_ERDA_FRAGMENT_ITEM_KEY)).toMatchObject({ used: 0, remaining: 5 })
  })

  it('사냥 조각이 모자란 저장은 지금처럼 조각 장부의 오류로 되돌아간다', async () => {
    const huntOnly = hexa('hexa-1', { storageUses: [{ ocid: 'ocid-a', fragments: 3 }] })

    await expect(insertSpendRecord(huntOnly)).rejects.toBeInstanceOf(FragmentShortageError)
  })
})

describe('수정 · 삭제', () => {
  it('수정은 남은 개수를 고치고 판 기록은 그대로 둔다', async () => {
    await addInventoryItem({ ...SCANIA, itemKey: 'stone', itemKindKey: 'consumable', quantity: 10 }, NOW)
    const stone = await only('stone')
    await insertIncomeRecord(itemSale('sale-1', stone.id, 4))

    await setInventoryRemaining(stone.id, 3, NOW)

    expect(await only('stone')).toMatchObject({ quantity: 7, used: 4, remaining: 3 })
  })

  it('삭제는 남은 것만 지운다. 판 것이 있으면 줄이 남고, 없으면 줄을 지운다', async () => {
    await addInventoryItem({ ...SCANIA, itemKey: 'stone', itemKindKey: 'consumable', quantity: 10 }, NOW)
    await addInventoryItem({ ...SCANIA, itemKey: 'scroll', itemKindKey: 'consumable', quantity: 2 }, NOW)
    const stone = await only('stone')
    const scroll = await only('scroll')
    await insertIncomeRecord(itemSale('sale-1', stone.id, 4))

    await deleteInventoryRemaining(stone.id, NOW)
    await deleteInventoryRemaining(scroll.id, NOW)

    expect(await getInventoryItems()).toEqual([expect.objectContaining({ id: stone.id, quantity: 4, used: 4, remaining: 0 })])
  })

  it('남은 개수를 다 지운 줄에 같은 아이템을 다시 넣으면 그 줄이 다시 찬다', async () => {
    await addInventoryItem({ ...SCANIA, itemKey: 'stone', itemKindKey: 'consumable', quantity: 10 }, NOW)
    const stone = await only('stone')
    await insertIncomeRecord(itemSale('sale-1', stone.id, 4))
    await deleteInventoryRemaining(stone.id, NOW)

    await addInventoryItem({ ...SCANIA, itemKey: 'stone', itemKindKey: 'consumable', quantity: 2 }, NOW)

    expect(await only('stone')).toMatchObject({ id: stone.id, quantity: 6, remaining: 2 })
  })
})

describe('버전 21 이관', () => {
  it('옛 조각 사용 줄을 사냥 조각 줄로 옮기고 rowid 차례를 지킨다', async () => {
    await getBossProfitDb()
    await closeBossProfitDb()
    real.inspect((db) => {
      db.exec('DROP TABLE cashbook_entry_fragment_uses')
      db.exec(`CREATE TABLE cashbook_entry_fragment_uses (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL REFERENCES cashbook_entries(id) ON DELETE CASCADE,
        ocid TEXT NOT NULL,
        fragments INTEGER NOT NULL)`)
      db.exec(`INSERT INTO cashbook_entries (id, entry_type, category_key, entry_date, created_at, updated_at, ocid)
        VALUES ('hexa-1', 'spend', 'hexa_matrix', '2026-11-12', '2026-11-12T01:00:00.000Z', '2026-11-12T01:00:00.000Z', 'ocid-a')`)
      db.exec(`INSERT INTO cashbook_entry_fragment_uses (id, entry_id, ocid, fragments)
        VALUES ('u-2', 'hexa-1', 'ocid-b', 5), ('u-1', 'hexa-1', 'ocid-a', 7)`)
      db.exec(`PRAGMA user_version = ${DB_VERSION - 1}`)
    })

    await getBossProfitDb()

    const rows = real.inspect((db) =>
      db.prepare('SELECT id, fragment_source, ocid, account_id, fragments FROM cashbook_entry_fragment_uses ORDER BY rowid').all(),
    )
    expect(rows).toEqual([
      { id: 'u-2', fragment_source: 'hunt', ocid: 'ocid-b', account_id: null, fragments: 5 },
      { id: 'u-1', fragment_source: 'hunt', ocid: 'ocid-a', account_id: null, fragments: 7 },
    ])
  })
})
