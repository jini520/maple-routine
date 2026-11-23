/// <reference types="node" />
/**
 * **드롭 기록의 id 와 월드를 진짜 SQLite 로 태우는 자리.**
 *
 * 드롭 그룹을 저장하면 그룹의 줄을 다시 적는다. 기기와 서버는 드롭 줄을 id 로 주고받아서, 저장할 때마다 id 를 새로 만들면
 * 동기화가 같은 드롭을 지우고 다시 올린다.
 *
 * **여기서 보는 것은 저장을 되풀이해도 그 값이 유지되는가** 다. 목이 흉내 낼 수 있는 종류가 아니라 진짜 엔진으로 잰다.
 */
import { closeBossProfitDb } from '../db'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { getAllBossDropRecords, replaceBossDropRecords, NO_WORLD } from '../../boss-drops'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'
import type { RecordedDrop } from '../../../types/drops'

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

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const AT = '2026-10-08T00:00:00.000Z'
const WORLD = { name: '챌린저스2', key: 'challengers_2' }

function drop(itemKey: string, over: Partial<RecordedDrop> = {}): RecordedDrop {
  return { dropRecordId: null, category: 'equipment', itemKey, itemName: itemKey, quantity: 1, ...over }
}

/** 아이템 key 로 찾은 식별자. 비교를 읽히게 하려고 지도로 만든다. */
async function idsByItem(ocid = 'ocid-1'): Promise<Record<string, string>> {
  const rows = await getAllBossDropRecords([ocid])
  return Object.fromEntries(rows.map((row) => [row.itemKey ?? row.itemName, row.dropRecordId]))
}

async function save(drops: RecordedDrop[], difficulty = 'hard'): Promise<void> {
  await replaceBossDropRecords('ocid-1', 'lucid', difficulty, '2026-10-01', drops, AT, WORLD)
}

describe('드롭 기록의 식별자', () => {
  it('저장하면 v4 uuid 가 붙는다', async () => {
    await save([drop('life_whetstone'), drop('dreamy_belt')])

    const ids = await idsByItem()
    expect(ids['life_whetstone']).toMatch(V4)
    expect(ids['dreamy_belt']).toMatch(V4)
    expect(ids['life_whetstone']).not.toBe(ids['dreamy_belt'])
  })

  it('같은 그룹을 다시 저장해도 같은 아이템의 값이 유지된다', async () => {
    await save([drop('life_whetstone'), drop('dreamy_belt')])
    const before = await idsByItem()

    // 가격을 넣어 다시 저장한다. 시트가 저장할 때마다 이 경로를 탄다.
    await save([drop('life_whetstone', { priceState: 'entered', priceMeso: 10 }), drop('dreamy_belt')])

    expect(await idsByItem()).toEqual(before)
  })

  it('하나를 빼도 남은 것의 값이 안 바뀐다', async () => {
    // `drop_index` 가 배열 자리라 여기서 당겨진다. 그때 식별자가 따라 움직이면 서버에서
    // 가격이 엉뚱한 아이템에 붙는다.
    await save([drop('life_whetstone'), drop('dreamy_belt'), drop('magic_eyepatch')])
    const before = await idsByItem()

    await save([drop('dreamy_belt'), drop('magic_eyepatch')])
    const after = await idsByItem()

    expect(after['dreamy_belt']).toBe(before['dreamy_belt'])
    expect(after['magic_eyepatch']).toBe(before['magic_eyepatch'])
    expect(after['life_whetstone']).toBeUndefined()
  })

  it('새로 더한 아이템만 새 값을 받는다', async () => {
    await save([drop('life_whetstone')])
    const before = await idsByItem()

    await save([drop('life_whetstone'), drop('dreamy_belt')])
    const after = await idsByItem()

    expect(after['life_whetstone']).toBe(before['life_whetstone'])
    expect(after['dreamy_belt']).toMatch(V4)
    expect(after['dreamy_belt']).not.toBe(before['life_whetstone'])
  })

  it('같은 아이템이 일반 드롭과 상자 결과로 둘 들어와도 서로 다른 값을 받는다', async () => {
    // 아이템 key 만으로 짝지으면 둘이 같은 값을 받아 서버에서 하나가 다른 하나를 덮는다.
    await save([drop('life_whetstone'), drop('life_whetstone', { boxOriginKey: 'life_boss_ring_box', boxOrigin: '상자' })])

    const rows = await getAllBossDropRecords(['ocid-1'])
    const ids = rows.map((row) => row.dropRecordId)
    expect(new Set(ids).size).toBe(2)
    expect(ids.every((one) => V4.test(one))).toBe(true)
  })

  it('난이도가 바뀌면 다른 그룹이라 새 값을 받는다', async () => {
    // 난이도 확정 이관은 행을 **옮기는** 것이고 이 경로가 아니다. 그 이관은 따로 uuid 를 물려준다.
    await save([drop('life_whetstone')], 'hard')
    const hard = await idsByItem()

    await save([drop('life_whetstone')], 'normal')
    const rows = await getAllBossDropRecords(['ocid-1'])

    expect(rows).toHaveLength(2)
    expect(rows.filter((row) => row.difficulty === 'normal')[0]?.dropRecordId).not.toBe(hard['life_whetstone'])
  })
})

describe('드롭 기록의 월드', () => {
  it('모르면 NULL 이다', async () => {
    // 0 이나 빈 문자열로 채우면 "모름" 이 값으로 둔갑한다.
    await replaceBossDropRecords('ocid-1', 'lucid', 'hard', '2026-10-01', [drop('life_whetstone')], AT, NO_WORLD)

    const rows = await getAllBossDropRecords(['ocid-1'])
    expect(rows[0]).toMatchObject({ world: null, worldKey: null })
  })
})
