/// <reference types="node" />
/**
 * 그날 이름 표(`character_dated_names`)에서 이름 찾기의 차례를 정하는 두 조회를 진짜 SQLite 로 태운다. 묶음과 `NULL` 비교는 엔진이
 * 판정하는 것이라 목으로는 못 본다.
 */
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { getNoValueThroughDates, getOcidsNamed, saveDatedName } from '../../character-dated-names'
import { closeBossProfitDb } from '../db'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite
const NOW = new Date('2026-11-10T03:00:00Z')

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

it('그 이름을 그날 이름으로 가졌던 ocid 를 한 번씩 준다', async () => {
  await saveDatedName('o-1', '2025-12-01', { name: '살름', worldName: '엘리시움' }, NOW)
  await saveDatedName('o-1', '2025-12-02', { name: '살름', worldName: '엘리시움' }, NOW)
  await saveDatedName('o-2', '2025-12-01', { name: '부캐', worldName: '엘리시움' }, NOW)

  await expect(getOcidsNamed('살름')).resolves.toEqual(['o-1'])
})

it('ocid 마다 값이 없던 가장 늦은 날을 주고, 물은 ocid 만 본다', async () => {
  await saveDatedName('o-1', '2025-06-01', { name: null, worldName: null }, NOW)
  await saveDatedName('o-1', '2025-07-23', { name: null, worldName: null }, NOW)
  await saveDatedName('o-1', '2025-08-01', { name: '살름', worldName: '엘리시움' }, NOW)
  await saveDatedName('o-2', '2025-05-01', { name: null, worldName: null }, NOW)

  await expect(getNoValueThroughDates(['o-1', 'o-3'])).resolves.toEqual(new Map([['o-1', '2025-07-23']]))
})
