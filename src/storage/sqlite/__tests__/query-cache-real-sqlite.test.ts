/// <reference types="node" />
/**
 * 쿼리 캐시 사본을 진짜 SQLite 로 태운다. 저장기는 같은 키로 계속 다시 쓰므로 같은 키가 줄을 늘리면 안 된다.
 */
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { getQueryCache, removeQueryCache, setQueryCache } from '../../query-cache'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

beforeEach(async () => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  await getBossProfitDb()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

it('같은 키는 값을 덮고, 지우면 없다', async () => {
  await expect(getQueryCache('query-cache')).resolves.toBeNull()

  await setQueryCache('query-cache', '{"v":1}')
  await setQueryCache('query-cache', '{"v":2}')

  await expect(getQueryCache('query-cache')).resolves.toBe('{"v":2}')
  expect(real.inspect((db) => db.prepare('SELECT count(*) AS n FROM query_cache').get())).toEqual({ n: 1 })

  await removeQueryCache('query-cache')
  await expect(getQueryCache('query-cache')).resolves.toBeNull()
})
