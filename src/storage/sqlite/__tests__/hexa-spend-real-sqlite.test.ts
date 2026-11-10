/// <reference types="node" />
/**
 * 헥사 강화 기록의 조각 칸과 강화 레벨 기억을 진짜 SQLite 로 태운다.
 */
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { getFragmentStorage, insertIncomeRecord, type IncomeRecord } from '../../income'
import { getRememberedLevels, rememberLevels } from '../../remembered-levels'
import {
  deleteSpendRecord,
  getLatestSpendFor,
  getSpendRecordsBetween,
  insertSpendRecord,
  updateSpendRecord,
  type SpendRecord,
} from '../../spend'
import { closeBossProfitDb, getBossProfitDb } from '../db'
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

const 선참: SpendRecord = {
  id: '3c1f2e4d-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  ocid: 'ocid-1',
  spentOn: '2026-10-30',
  category: 'hexa_matrix',
  item: null,
  itemKey: '매화검 본초 : 선참 VI',
  formItemKeys: null,
  itemKind: null,
  levelFrom: 25,
  levelTo: 28,
  quantity: null,
  mesoAmount: 2_160_000_000,
  tariffMeso: null,
  pointAmount: null,
  pointPer100mMeso: null,
  mesoMarketFeePercent: null,
  cashAmount: null,
  hexa: {
    fragmentCount: 345,
    untradableFragmentCount: 45,
    fragmentPrice: 7_200_000,
    activation: null,
    useStorage: false,
    storageAsSpend: false,
    storageUses: [],
  },
  recordedAt: '2026-10-30T03:00:00.000Z',
}

const 스탯: SpendRecord = {
  ...선참,
  id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
  itemKey: 'hexa_stat_2',
  levelFrom: null,
  levelTo: null,
  mesoAmount: 0,
  hexa: { ...선참.hexa!, fragmentCount: 340, untradableFragmentCount: 400, activation: false },
  recordedAt: '2026-10-30T03:01:00.000Z',
}

describe('헥사 기록의 조각 칸', () => {
  // 수정으로 다시 열면 필요 조각 · 교환 불가 · 개당 가격과 활성화 체크가 그대로 서야 한다.
  it('조각 칸 셋과 활성화 포함이 그대로 돌아온다. 활성화 거짓과 헥사 스킬의 null 이 갈린다', async () => {
    await insertSpendRecord(선참)
    await insertSpendRecord(스탯)

    const rows = await getSpendRecordsBetween('2026-10-30', '2026-10-30')
    expect(rows.map((row) => row.hexa)).toEqual([선참.hexa, 스탯.hexa])
  })

  it('다른 갈래 기록은 hexa 가 null 이다', async () => {
    await insertSpendRecord({ ...선참, category: 'etc', itemKey: null, item: '패스', levelFrom: null, levelTo: null, hexa: null })

    const [row] = await getSpendRecordsBetween('2026-10-30', '2026-10-30')
    expect(row?.hexa).toBeNull()
  })

  // 이미 가계부를 적은 기기의 품목 표는 CREATE 가 안 붙인다. 칸이 없으면 헥사 기록 저장이 던진다.
  it('칸이 없는 옛 품목 표를 열면 조각 칸과 보관 체크 칸이 붙는다', async () => {
    await getBossProfitDb()
    await closeBossProfitDb()
    real.inspect((db) => {
      for (const column of [
        'fragment_count',
        'untradable_fragment_count',
        'fragment_price_meso',
        'hexa_activation',
        'hexa_use_storage',
        'hexa_storage_as_spend',
      ]) {
        db.exec(`ALTER TABLE cashbook_entry_items DROP COLUMN ${column}`)
      }
    })

    await insertSpendRecord(선참)

    const [row] = await getSpendRecordsBetween('2026-10-30', '2026-10-30')
    expect(row?.hexa).toEqual(선참.hexa)
  })
})

describe('보관에서 가져온 조각', () => {
  const 보관사용: SpendRecord = {
    ...선참,
    id: '5e2a7c1d-3b4f-4a6e-9c8d-7f1e2a3b4c5d',
    mesoAmount: 0,
    hexa: {
      ...선참.hexa!,
      fragmentPrice: null,
      useStorage: true,
      storageAsSpend: false,
      storageUses: [
        { ocid: 'ocid-1', fragments: 100 },
        { ocid: 'ocid-2', fragments: 200 },
      ],
    },
  }

  /** 가격을 안 적은 사냥. 그 조각이 캐릭터 보관이 된다. */
  function hunt(ocid: string, earnedOn: string, fragments: number, id: string): IncomeRecord {
    return {
      id,
      ocid,
      earnedOn,
      category: 'hunting',
      item: null,
      itemKey: null,
      mesoAmount: 100_000_000,
      pointAmount: null,
      pointPer100mMeso: null,
      cashAmount: null,
      quantity: null,
      itemKind: null,
      saleFeePercent: null,
      saleFeeMeso: null,
      saleFeeAuto: false,
      hunt: { mode: 'manual', typedMeso: 100_000_000, fragments, fragmentPrice: null },
      recordedAt: `${earnedOn}T01:00:00.000Z`,
    }
  }

  // 수정으로 다시 열면 두 체크가 저장한 대로 서야 한다. 곱할 개수가 없어 가격 없이 저장한 기록도 헥사 기록이다.
  it('두 체크와 캐릭터별 배분이 그대로 돌아오고, 가격 없는 기록도 헥사 기록으로 읽힌다', async () => {
    await insertSpendRecord(보관사용)

    const [row] = await getSpendRecordsBetween('2026-10-30', '2026-10-30')
    expect(row?.hexa).toEqual(보관사용.hexa)
  })

  it('고치면 배분을 갈아 끼우고, 기록을 지우면 배분도 함께 지워진다', async () => {
    await insertSpendRecord(보관사용)
    const edited = { ...보관사용, hexa: { ...보관사용.hexa!, storageUses: [{ ocid: 'ocid-2', fragments: 300 }] } }
    await updateSpendRecord(edited)

    const [row] = await getSpendRecordsBetween('2026-10-30', '2026-10-30')
    expect(row?.hexa?.storageUses).toEqual([{ ocid: 'ocid-2', fragments: 300 }])

    await deleteSpendRecord(보관사용.id)
    expect(real.inspect((db) => db.prepare('SELECT COUNT(*) AS n FROM cashbook_entry_fragment_uses').get())).toEqual({ n: 0 })
  })

  // 배분을 저장해 두므로 보관은 그 기록이 가져간 개수를 뺀다. 나중에 보관한 조각을 앞선 날짜의 강화에 쓸 수 없다.
  it('보관은 헥사 기록이 가져간 개수를 빼고, 고른 날 뒤의 헥사 기록과 수정 중인 기록은 안 뺀다', async () => {
    await insertIncomeRecord(hunt('ocid-1', '2026-10-29', 150, '1a1a1a1a-0000-4000-8000-000000000001'))
    await insertSpendRecord(보관사용)
    await insertSpendRecord({
      ...보관사용,
      id: '5e2a7c1d-3b4f-4a6e-9c8d-000000000002',
      spentOn: '2026-11-02',
      hexa: { ...보관사용.hexa!, storageUses: [{ ocid: 'ocid-1', fragments: 40 }] },
    })

    await expect(getFragmentStorage('ocid-1', '2026-10-30')).resolves.toBe(50)
    await expect(getFragmentStorage('ocid-1', '2026-11-02')).resolves.toBe(10)
    await expect(getFragmentStorage('ocid-1', '2026-10-30', 보관사용.id)).resolves.toBe(150)
    await expect(getFragmentStorage('ocid-2', '2026-10-30')).resolves.toBe(-200)
  })
})

describe('getLatestSpendFor: 그 대상의 가장 최근 기록', () => {
  it('날짜가 늦은 것이고, 날짜가 같으면 늦게 저장한 것이다', async () => {
    await insertSpendRecord({ ...선참, id: 'a0000000-0000-4000-8000-000000000001', spentOn: '2026-10-31', levelFrom: 28, levelTo: 29 })
    await insertSpendRecord(선참)
    await insertSpendRecord({
      ...선참,
      id: 'a0000000-0000-4000-8000-000000000002',
      spentOn: '2026-10-31',
      levelFrom: 29,
      levelTo: 30,
      recordedAt: '2026-10-31T05:00:00.000Z',
    })

    const latest = await getLatestSpendFor('ocid-1', 'hexa_matrix', '매화검 본초 : 선참 VI')
    expect(latest?.levelTo).toBe(30)
  })

  it('다른 캐릭터 · 다른 대상의 기록은 안 본다', async () => {
    await insertSpendRecord({ ...선참, ocid: 'ocid-2' })

    await expect(getLatestSpendFor('ocid-1', 'hexa_matrix', '매화검 본초 : 선참 VI')).resolves.toBeNull()
  })
})

describe('강화 레벨 기억', () => {
  // 사용자가 친 값을 믿는다. 넥슨 레벨이 기억을 덮으면 앱이 실제보다 앞서 적힌 기록을 지운 셈이 된다.
  it('fill 은 기억이 없는 대상만 채우고, overwrite 는 갈아 끼운다', async () => {
    await rememberLevels('ocid-1', 'hexa', { 선참: 25 }, 'overwrite')
    await rememberLevels('ocid-1', 'hexa', { 선참: 28, 만참: 19 }, 'fill')

    await expect(getRememberedLevels('ocid-1', 'hexa')).resolves.toEqual({ 선참: 25, 만참: 19 })

    await rememberLevels('ocid-1', 'hexa', { 선참: 28 }, 'overwrite')
    await expect(getRememberedLevels('ocid-1', 'hexa')).resolves.toEqual({ 선참: 28, 만참: 19 })
  })

  it('캐릭터와 갈래(심볼 · 헥사)가 갈린다', async () => {
    await rememberLevels('ocid-1', 'symbol', { cernium: 7 }, 'overwrite')
    await rememberLevels('ocid-2', 'hexa', { cernium: 3 }, 'overwrite')

    await expect(getRememberedLevels('ocid-1', 'hexa')).resolves.toEqual({})
    await expect(getRememberedLevels('ocid-1', 'symbol')).resolves.toEqual({ cernium: 7 })
  })
})
