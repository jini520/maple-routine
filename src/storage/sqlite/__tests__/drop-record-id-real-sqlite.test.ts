/// <reference types="node" />
/**
 * **드롭 기록의 식별자와 월드를 진짜 SQLite 로 태우는 자리.**
 *
 * 서버로 가격을 보낼 때 그 기록을 다시 가리킬 값이 필요한데, 지금 기본키의 조각 둘이 설계상 바뀐다.
 * `difficulty` 는 처치 난이도가 확정될 때 행이 옮겨지고, `drop_index` 는 그룹을 저장할 때마다 배열
 * 자리로 다시 매겨진다. 그래서 안 바뀌는 `drop_record_id` 를 둔다.
 *
 * **여기서 보는 것은 저장을 되풀이해도 그 값이 유지되는가** 다. 새로 만들면 서버에 같은 기록이
 * 계속 쌓인다. 목이 흉내 낼 수 있는 종류가 아니라 진짜 엔진으로 잰다.
 */
import { closeBossProfitDb, getBossProfitDb } from '../db'
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
  await replaceBossDropRecords('ocid-1', 'lucid', difficulty, '2026-10-02', drops, AT, WORLD)
}

describe('드롭 기록의 식별자', () => {
  it('저장하면 v4 uuid 가 붙는다', async () => {
    await save([drop('ring-a'), drop('ring-b')])

    const ids = await idsByItem()
    expect(ids['ring-a']).toMatch(V4)
    expect(ids['ring-b']).toMatch(V4)
    expect(ids['ring-a']).not.toBe(ids['ring-b'])
  })

  it('같은 그룹을 다시 저장해도 같은 아이템의 값이 유지된다', async () => {
    await save([drop('ring-a'), drop('ring-b')])
    const before = await idsByItem()

    // 가격을 넣어 다시 저장한다. 시트가 저장할 때마다 이 경로를 탄다.
    await save([drop('ring-a', { priceState: 'entered', priceMeso: 10 }), drop('ring-b')])

    expect(await idsByItem()).toEqual(before)
  })

  it('하나를 빼도 남은 것의 값이 안 바뀐다', async () => {
    // `drop_index` 가 배열 자리라 여기서 당겨진다. 그때 식별자가 따라 움직이면 서버에서
    // 가격이 엉뚱한 아이템에 붙는다.
    await save([drop('ring-a'), drop('ring-b'), drop('ring-c')])
    const before = await idsByItem()

    await save([drop('ring-b'), drop('ring-c')])
    const after = await idsByItem()

    expect(after['ring-b']).toBe(before['ring-b'])
    expect(after['ring-c']).toBe(before['ring-c'])
    expect(after['ring-a']).toBeUndefined()
  })

  it('새로 더한 아이템만 새 값을 받는다', async () => {
    await save([drop('ring-a')])
    const before = await idsByItem()

    await save([drop('ring-a'), drop('ring-b')])
    const after = await idsByItem()

    expect(after['ring-a']).toBe(before['ring-a'])
    expect(after['ring-b']).toMatch(V4)
    expect(after['ring-b']).not.toBe(before['ring-a'])
  })

  it('같은 아이템이 일반 드롭과 상자 결과로 둘 들어와도 서로 다른 값을 받는다', async () => {
    // 아이템 key 만으로 짝지으면 둘이 같은 값을 받아 서버에서 하나가 다른 하나를 덮는다.
    await save([drop('ring-a'), drop('ring-a', { boxOriginKey: 'box-1', boxOrigin: '상자' })])

    const rows = await getAllBossDropRecords(['ocid-1'])
    const ids = rows.map((row) => row.dropRecordId)
    expect(new Set(ids).size).toBe(2)
    expect(ids.every((one) => V4.test(one))).toBe(true)
  })

  it('난이도가 바뀌면 다른 그룹이라 새 값을 받는다', async () => {
    // 난이도 확정 이관은 행을 **옮기는** 것이고 이 경로가 아니다. 그 이관은 따로 uuid 를 물려준다.
    await save([drop('ring-a')], 'hard')
    const hard = await idsByItem()

    await save([drop('ring-a')], 'chaos')
    const rows = await getAllBossDropRecords(['ocid-1'])

    expect(rows).toHaveLength(2)
    expect(rows.filter((row) => row.difficulty === 'chaos')[0]?.dropRecordId).not.toBe(hard['ring-a'])
  })
})

describe('드롭 기록의 월드', () => {
  it('기록 시점의 월드를 자기 칸에 든다', async () => {
    await save([drop('ring-a')])

    const rows = await getAllBossDropRecords(['ocid-1'])
    expect(rows[0]).toMatchObject({ world: '챌린저스2', worldKey: 'challengers_2' })
  })

  it('모르면 NULL 이다', async () => {
    // 0 이나 빈 문자열로 채우면 "모름" 이 값으로 둔갑한다.
    await replaceBossDropRecords('ocid-1', 'lucid', 'hard', '2026-10-02', [drop('ring-a')], AT, NO_WORLD)

    const rows = await getAllBossDropRecords(['ocid-1'])
    expect(rows[0]).toMatchObject({ world: null, worldKey: null })
  })
})

describe('새 DB 의 표 모양', () => {
  it('기본키가 drop_record_id 하나이고 옛 다섯 칸에는 인덱스가 선다', async () => {
    await getBossProfitDb()

    const pk = real.inspect((db) =>
      (db.prepare('PRAGMA table_info(boss_drop_records)').all() as { name: string; pk: number }[])
        .filter((column) => column.pk > 0)
        .map((column) => column.name),
    )
    expect(pk).toEqual(['drop_record_id'])

    // 기본키가 곧 인덱스였던 조회가 전체 스캔이 되지 않게 한다.
    const indexed = real.inspect((db) =>
      (db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='boss_drop_records'").all() as {
        name: string
      }[]).map((row) => row.name),
    )
    expect(indexed).toContain('boss_drop_records_group')
  })
})
