/// <reference types="node" />
/**
 * 트랜잭션 도우미를 진짜 SQLite 로 태운다. 앱을 켤 때 계정 칸 채우기와 강화 합계 옮기기가 같은 연결에서 동시에 트랜잭션을
 * 열어, 뒤의 것이 `cannot start a transaction within a transaction` 으로 실패했다(실기기).
 */
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { inTransaction } from '../transaction'
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

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

it('같은 연결에서 동시에 연 트랜잭션은 차례로 돌아 둘 다 적힌다', async () => {
  const db = await getBossProfitDb()
  await db.execute('CREATE TABLE t (v TEXT)')

  await Promise.all(
    ['a', 'b'].map((v) =>
      inTransaction(db, async () => {
        await tick()
        await db.run('INSERT INTO t (v) VALUES (?)', [v])
      }),
    ),
  )

  const { values } = await db.query('SELECT v FROM t ORDER BY v')
  expect(values).toEqual([{ v: 'a' }, { v: 'b' }])
})

// 앞의 것이 던져 되돌려져도 차례가 막히지 않아야 한다.
it('앞 트랜잭션이 실패해도 뒤 트랜잭션은 돈다', async () => {
  const db = await getBossProfitDb()
  await db.execute('CREATE TABLE t (v TEXT)')

  const results = await Promise.allSettled([
    inTransaction(db, async () => {
      await db.run('INSERT INTO t (v) VALUES (?)', ['x'])
      throw new Error('boom')
    }),
    inTransaction(db, () => db.run('INSERT INTO t (v) VALUES (?)', ['y'])),
  ])

  expect(results.map((result) => result.status)).toEqual(['rejected', 'fulfilled'])
  expect((await db.query('SELECT v FROM t')).values).toEqual([{ v: 'y' }])
})
