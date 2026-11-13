/// <reference types="node" />
/**
 * 솔 에르다 조각 장부를 진짜 SQLite 로 태운다. 장부를 바꾸는 저장이 같은 검사를 거치는지, 사냥 기록을 고쳐 모자라게
 * 되면 헥사 강화를 다른 보관으로 옮기고 그래도 모자라면 막는지 본다.
 */
import fc from 'fast-check'

import { allocateHexaStorage } from '../../../lib/cashbook/hexa-matrix'
import { FragmentShortageError, readFragmentMoves } from '../../fragment-ledger'
import { getHuntFragmentFloor } from '../../fragment-moves'
import {
  deleteIncomeRecord,
  getFragmentStorage,
  getIncomeRecordsBetween,
  insertIncomeRecord,
  updateIncomeRecord,
  type IncomeRecord,
} from '../../income'
import { addInventoryItem, SOL_ERDA_FRAGMENT_ITEM_KEY } from '../../inventory'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { getSpendRecordsBetween, insertSpendRecord, type SpendRecord } from '../../spend'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

async function open(): Promise<void> {
  real = createRealSqlite()
  setSqlitePort(real.port)
}

async function close(): Promise<void> {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
}

beforeEach(open)
afterEach(close)

/** 가격을 안 적은 사냥. 그 조각이 캐릭터 보관이 된다. */
function hunt(id: string, ocid: string, earnedOn: string, fragments: number): IncomeRecord {
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

/** 개당 700만에 5% 수수료를 떼고 판 정산. */
function settle(id: string, ocid: string, earnedOn: string, quantity: number): IncomeRecord {
  const gross = quantity * 7_000_000
  const fee = Math.floor((gross * 5) / 100)
  return {
    ...hunt(id, ocid, earnedOn, 0),
    category: 'sol_erda_fragment',
    mesoAmount: gross - fee,
    quantity,
    saleFeePercent: 5,
    saleFeeMeso: fee,
    saleFeeAuto: true,
    hunt: null,
  }
}

/** 보관을 쓴 헥사 강화. 금액은 지출 체크와 개당 가격으로 저장할 때 센 값이다. */
function hexa(
  id: string,
  ocid: string,
  spentOn: string,
  input: { fragments: number; uses: { ocid: string; fragments: number }[]; asSpend: boolean; price: number | null },
): SpendRecord {
  const taken = input.uses.reduce((sum, use) => sum + use.fragments, 0)
  const priced = input.asSpend ? input.fragments : input.fragments - taken
  return {
    id,
    ocid,
    spentOn,
    category: 'hexa_matrix',
    item: null,
    itemKey: '헥사 스탯 Ⅰ',
    formItemKeys: null,
    itemKind: null,
    levelFrom: null,
    levelTo: null,
    quantity: null,
    mesoAmount: priced * (input.price ?? 0),
    tariffMeso: null,
    pointAmount: null,
    pointPer100mMeso: null,
    mesoMarketFeePercent: null,
    cashAmount: null,
    hexa: {
      fragmentCount: input.fragments,
      untradableFragmentCount: 0,
      fragmentPrice: input.price,
      activation: true,
      useStorage: true,
      storageAsSpend: input.asSpend,
      storageUses: input.uses,
    },
    recordedAt: `${spentOn}T02:00:00.000Z`,
  }
}

const SEPT = ['2026-09-01', '2026-09-30'] as const
/** 옮길 다른 캐릭터가 없다. */
const ONLY_SELF = { candidatesOf: (ocid: string): string[] => [ocid] }
/** a 의 헥사 강화는 b 의 보관으로 옮길 수 있다. */
const A_THEN_B = { candidatesOf: (ocid: string): string[] => (ocid === 'a' ? ['a', 'b'] : [ocid]) }

/** 시안의 장부. 9/17 사냥 100 을 9/18 정산 20 · 9/19 헥사 20(지출 체크 켬) · 9/20 헥사 60(가격 없음)이 다 가져갔다. */
async function mockupLedger(): Promise<void> {
  await insertIncomeRecord(hunt('hunt-17', 'a', '2026-09-17', 100))
  await insertIncomeRecord(settle('settle-18', 'a', '2026-09-18', 20))
  await insertSpendRecord(hexa('hexa-19', 'a', '2026-09-19', { fragments: 20, uses: [{ ocid: 'a', fragments: 20 }], asSpend: true, price: 7_200_000 }))
  await insertSpendRecord(hexa('hexa-20', 'a', '2026-09-20', { fragments: 60, uses: [{ ocid: 'a', fragments: 60 }], asSpend: false, price: null }))
}

async function spendOf(id: string): Promise<SpendRecord | undefined> {
  return (await getSpendRecordsBetween(...SEPT)).find((record) => record.id === id)
}

async function incomeOf(id: string): Promise<IncomeRecord | undefined> {
  return (await getIncomeRecordsBetween(...SEPT)).find((record) => record.id === id)
}

describe('모든 저장이 같은 장부 검사를 거친다', () => {
  // 폼이 쓸 수 있는 개수까지만 받지만, 폼을 연 사이에 장부가 바뀌면 저장이 직접 막아야 쓸 수 없는 조각을 쓴 기록이 안 남는다.
  it('뒤 날짜의 남은 개수보다 많이 파는 정산은 던지고 아무것도 남기지 않는다', async () => {
    await insertIncomeRecord(hunt('hunt-01', 'a', '2026-09-01', 100))
    await insertIncomeRecord(settle('settle-12', 'a', '2026-09-12', 80))

    await expect(insertIncomeRecord(settle('settle-08', 'a', '2026-09-08', 30))).rejects.toBeInstanceOf(FragmentShortageError)
    expect(await incomeOf('settle-08')).toBeUndefined()
  })

  // 정산 · 헥사 폼의 길은 옮길 곳을 넘기지 않는다. 폼을 연 사이에 장부가 바뀌었으면 그 저장만 실패한다.
  it('옮길 곳을 넘기지 않은 저장은 모자라면 옮기지 않고 던진다', async () => {
    await mockupLedger()

    await expect(updateIncomeRecord(hunt('hunt-17', 'a', '2026-09-17', 0))).rejects.toBeInstanceOf(FragmentShortageError)
    expect((await incomeOf('hunt-17'))?.hunt).toMatchObject({ fragments: 100 })
  })

  it('같은 저장을 다시 하면 줄어드는 날이 없어 그대로 받는다', async () => {
    await mockupLedger()
    const same = (await incomeOf('hunt-17'))!

    await expect(updateIncomeRecord(same, ONLY_SELF)).resolves.toBeUndefined()
    expect((await spendOf('hexa-20'))?.hexa?.storageUses).toEqual([{ ocid: 'a', fragments: 60 }])
  })
})

describe('사냥 기록을 고쳐 모자라면 헥사 강화를 다른 보관으로 옮긴다', () => {
  // 다른 캐릭터에 쓸 수 있는 보관이 있으면 가져온 개수가 그대로라 금액이 안 바뀐다. 그래서 묻지 않고 옮긴다.
  it('같은 메이플 ID · 같은 월드의 다른 캐릭터 보관으로 옮기고 금액은 그대로다', async () => {
    await insertIncomeRecord(hunt('hunt-a', 'a', '2026-09-17', 60))
    await insertIncomeRecord(hunt('hunt-b', 'b', '2026-09-10', 60))
    await insertSpendRecord(hexa('hexa-20', 'a', '2026-09-20', { fragments: 100, uses: [{ ocid: 'a', fragments: 60 }], asSpend: false, price: 7_200_000 }))

    await deleteIncomeRecord('hunt-a', A_THEN_B)

    expect(await incomeOf('hunt-a')).toBeUndefined()
    expect(await spendOf('hexa-20')).toMatchObject({ mesoAmount: 40 * 7_200_000, hexa: { storageUses: [{ ocid: 'b', fragments: 60 }] } })
    await expect(getFragmentStorage('b', '2026-09-10')).resolves.toBe(0)
  })

  it('강화한 캐릭터의 메이플 ID · 월드의 기타 조각으로 다른 캐릭터 보관보다 먼저 옮긴다', async () => {
    await insertIncomeRecord(hunt('hunt-a', 'a', '2026-09-17', 60))
    await insertIncomeRecord(hunt('hunt-b', 'b', '2026-09-10', 40))
    await insertSpendRecord(hexa('hexa-20', 'a', '2026-09-20', { fragments: 100, uses: [{ ocid: 'a', fragments: 60 }], asSpend: false, price: 7_200_000 }))
    await addInventoryItem({ accountId: 'maple-a', worldKey: 'scania', itemKey: SOL_ERDA_FRAGMENT_ITEM_KEY, itemKindKey: 'etc', quantity: 30 }, new Date())
    const ownerOf = (ocid: string) => (ocid === 'a' ? { accountId: 'maple-a', worldKey: 'scania' } : null)

    await deleteIncomeRecord('hunt-a', { ...A_THEN_B, ownerOf })

    expect(await spendOf('hexa-20')).toMatchObject({
      mesoAmount: 40 * 7_200_000,
      hexa: { storageUses: [{ ocid: 'b', fragments: 30 }], otherUse: { accountId: 'maple-a', worldKey: 'scania', fragments: 30 } },
    })
    await expect(getFragmentStorage('b', '2026-09-10')).resolves.toBe(10)
  })

  // 판 조각은 정산에 적힌 캐릭터의 보관에서 나온 것이라 옮길 곳이 없다. 고친 날짜에 더 가까워도 건너뛴다.
  it('정산은 옮기지 않고 그 뒤의 헥사 강화를 옮긴다', async () => {
    await insertIncomeRecord(hunt('hunt-a', 'a', '2026-09-17', 100))
    await insertIncomeRecord(hunt('hunt-b', 'b', '2026-09-10', 100))
    await insertIncomeRecord(settle('settle-18', 'a', '2026-09-18', 20))
    await insertSpendRecord(hexa('hexa-20', 'a', '2026-09-20', { fragments: 60, uses: [{ ocid: 'a', fragments: 60 }], asSpend: true, price: 7_200_000 }))

    await updateIncomeRecord(hunt('hunt-a', 'a', '2026-09-17', 50), A_THEN_B)

    expect(await incomeOf('settle-18')).toMatchObject({ quantity: 20, mesoAmount: 133_000_000, saleFeeMeso: 7_000_000 })
    expect(await spendOf('hexa-20')).toMatchObject({
      mesoAmount: 60 * 7_200_000,
      hexa: { storageUses: [{ ocid: 'a', fragments: 30 }, { ocid: 'b', fragments: 30 }] },
    })
  })
})

describe('옮기고도 모자라면 사냥 기록을 저장하지 않는다', () => {
  it('정산 · 헥사 강화를 줄이지 않고 던지며, 사냥 기록도 그대로다', async () => {
    await mockupLedger()

    await expect(deleteIncomeRecord('hunt-17', ONLY_SELF)).rejects.toBeInstanceOf(FragmentShortageError)

    expect((await incomeOf('hunt-17'))?.hunt).toMatchObject({ fragments: 100 })
    expect(await incomeOf('settle-18')).toMatchObject({ quantity: 20 })
    expect((await spendOf('hexa-19'))?.hexa?.storageUses).toEqual([{ ocid: 'a', fragments: 20 }])
    expect(await spendOf('hexa-20')).toMatchObject({ mesoAmount: 0, hexa: { storageUses: [{ ocid: 'a', fragments: 60 }], fragmentPrice: null } })
  })

  // 일부만 옮겨지면 그것도 쓰지 않는다. 옮긴 것만 남으면 사용자가 저장하지 않은 기록이 바뀐다.
  it('일부만 옮길 수 있으면 옮긴 것까지 되돌린다', async () => {
    await insertIncomeRecord(hunt('hunt-a', 'a', '2026-09-17', 60))
    await insertIncomeRecord(hunt('hunt-b', 'b', '2026-09-10', 30))
    await insertSpendRecord(hexa('hexa-20', 'a', '2026-09-20', { fragments: 100, uses: [{ ocid: 'a', fragments: 60 }], asSpend: false, price: 7_200_000 }))

    await expect(deleteIncomeRecord('hunt-a', A_THEN_B)).rejects.toBeInstanceOf(FragmentShortageError)

    expect(await incomeOf('hunt-a')).toBeDefined()
    expect((await spendOf('hexa-20'))?.hexa?.storageUses).toEqual([{ ocid: 'a', fragments: 60 }])
    await expect(getFragmentStorage('b', '2026-09-10')).resolves.toBe(30)
  })
})

describe('getHuntFragmentFloor: 사냥 기록의 최소 개수', () => {
  // 시안의 장부에 b 의 보관 30 을 더한다. 사냥 100 중 100 을 가져갔고 30 은 b 로 옮길 수 있어 70 이 경계다.
  it('그 개수로는 저장되고 하나 적으면 막히는 경계다', async () => {
    await mockupLedger()
    await insertIncomeRecord(hunt('hunt-b', 'b', '2026-09-10', 30))
    const stored = (await incomeOf('hunt-17'))!

    await expect(getHuntFragmentFloor(stored, A_THEN_B)).resolves.toBe(70)
    await expect(getHuntFragmentFloor(stored, ONLY_SELF)).resolves.toBe(100)

    await expect(updateIncomeRecord(hunt('hunt-17', 'a', '2026-09-17', 69), A_THEN_B)).rejects.toBeInstanceOf(FragmentShortageError)
    await expect(updateIncomeRecord(hunt('hunt-17', 'a', '2026-09-17', 70), A_THEN_B)).resolves.toBeUndefined()
  })

  it('가져간 개수가 최소 개수이고, 보관이 아닌 기록과 새 기록은 0 이다', async () => {
    await insertIncomeRecord(hunt('hunt-a', 'a', '2026-09-17', 60))
    await insertIncomeRecord(settle('settle-18', 'a', '2026-09-18', 20))
    const sold: IncomeRecord = { ...hunt('hunt-sold', 'a', '2026-09-01', 50), hunt: { mode: 'manual', typedMeso: 100_000_000, fragments: 50, fragmentPrice: 7_000_000 } }
    await insertIncomeRecord(sold)

    await expect(getHuntFragmentFloor((await incomeOf('hunt-a'))!, ONLY_SELF)).resolves.toBe(20)
    await expect(getHuntFragmentFloor(sold, ONLY_SELF)).resolves.toBe(0)
    await expect(getHuntFragmentFloor(hunt('hunt-new', 'a', '2026-09-20', 10), ONLY_SELF)).resolves.toBe(0)
  })
})

describe('무작위 차례의 쓰기(fast-check)', () => {
  const OCIDS = ['a', 'b'] as const
  const candidatesOf = (ocid: string): string[] => [ocid, ...OCIDS.filter((each) => each !== ocid)]
  const dateOf = (day: number): string => `2026-09-${String(day).padStart(2, '0')}`

  const opArb = fc.oneof(
    fc.record({ op: fc.constant('hunt' as const), who: fc.nat(1), day: fc.integer({ min: 1, max: 20 }), n: fc.integer({ min: 1, max: 100 }) }),
    fc.record({ op: fc.constant('settle' as const), who: fc.nat(1), day: fc.integer({ min: 1, max: 20 }), n: fc.integer({ min: 1, max: 100 }) }),
    fc.record({ op: fc.constant('hexa' as const), who: fc.nat(1), day: fc.integer({ min: 1, max: 20 }), n: fc.integer({ min: 1, max: 150 }), asSpend: fc.boolean() }),
    fc.record({ op: fc.constant('edit' as const), pick: fc.nat(), n: fc.integer({ min: 0, max: 100 }), day: fc.integer({ min: 1, max: 20 }) }),
    fc.record({ op: fc.constant('remove' as const), pick: fc.nat() }),
  )

  /** 지금 장부가 캐릭터마다 날마다 0 이상인가. */
  async function everyDayHeld(): Promise<boolean> {
    const moves = await readFragmentMoves(await getBossProfitDb())
    return OCIDS.every((ocid) => {
      const mine = moves.filter((move) => move.ocid === ocid)
      return mine.every((move) => mine.reduce((sum, each) => (each.date <= move.date ? sum + each.delta : sum), 0) >= 0)
    })
  }

  /** 사냥 수정이 바꾸면 안 되는 것. 정산의 판 개수 · 금액과 헥사 강화의 금액 · 보관에서 가져온 개수다. */
  async function soldAndSpent(): Promise<string> {
    const settles = (await getIncomeRecordsBetween(...SEPT))
      .filter((record) => record.category === 'sol_erda_fragment')
      .map((record) => [record.id, record.quantity, record.mesoAmount])
    const hexas = (await getSpendRecordsBetween(...SEPT)).map((record) => [
      record.id,
      record.mesoAmount,
      (record.hexa?.storageUses ?? []).reduce((sum, use) => sum + use.fragments, record.hexa?.otherUse?.fragments ?? 0),
    ])
    return JSON.stringify([settles, hexas])
  }

  // 사냥 기록을 고치고 지우는 사이에 정산 · 헥사가 끼어도, 저장이 끝날 때마다 장부가 날마다 0 이상이어야 한다.
  it('폼과 같은 개수로 적고 고치면, 어떤 차례로 적어도 장부가 날마다 0 이상이고 사냥 수정은 정산 · 헥사 금액을 바꾸지 않는다', async () => {
    await close()
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 14 }), async (ops) => {
        await open()
        try {
          const hunts: string[] = []
          for (const [index, step] of ops.entries()) {
            const id = `r${index}`
            if (step.op === 'hunt') {
              await insertIncomeRecord(hunt(id, OCIDS[step.who]!, dateOf(step.day), step.n))
              hunts.push(id)
            } else if (step.op === 'settle') {
              const ocid = OCIDS[step.who]!
              const sold = Math.min(step.n, await getFragmentStorage(ocid, dateOf(step.day)))
              if (sold > 0) await insertIncomeRecord(settle(id, ocid, dateOf(step.day), sold))
            } else if (step.op === 'hexa') {
              const ocid = OCIDS[step.who]!
              const storages = await Promise.all(
                candidatesOf(ocid).map(async (each) => ({ ocid: each, stored: await getFragmentStorage(each, dateOf(step.day)) })),
              )
              const { uses } = allocateHexaStorage({ fragments: step.n, untradable: 0, storages })
              await insertSpendRecord(hexa(id, ocid, dateOf(step.day), { fragments: step.n, uses, asSpend: step.asSpend, price: 1_000_000 }))
            } else if (hunts.length > 0) {
              const target = hunts[step.pick % hunts.length]!
              const untouched = await soldAndSpent()
              const ledger = JSON.stringify(await readFragmentMoves(await getBossProfitDb()))
              try {
                if (step.op === 'edit') {
                  const record = (await incomeOf(target))!
                  const hunted = { mode: 'manual', typedMeso: 0, fragments: step.n, fragmentPrice: null } as const
                  await updateIncomeRecord({ ...record, earnedOn: dateOf(step.day), hunt: hunted }, { candidatesOf })
                } else {
                  await deleteIncomeRecord(target, { candidatesOf })
                  hunts.splice(hunts.indexOf(target), 1)
                }
              } catch (error) {
                if (!(error instanceof FragmentShortageError)) throw error
                // 막힌 저장은 옮긴 것까지 아무것도 남기지 않는다.
                if (JSON.stringify(await readFragmentMoves(await getBossProfitDb())) !== ledger) return false
              }
              if ((await soldAndSpent()) !== untouched) return false
            }
            if (!(await everyDayHeld())) return false
          }
          return true
        } finally {
          await close()
        }
      }),
      { numRuns: 40 },
    )
    await open()
  })
})
