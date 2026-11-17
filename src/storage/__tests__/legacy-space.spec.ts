/// <reference types="node" />
/**
 * 옛 표를 다 지운 뒤 한 번 도는 공간 회수를 진짜 SQLite 로 태운다.
 *
 * `VACUUM` 은 트랜잭션 안에서 실패한다. 열린 쓰기 트랜잭션과 겹치면 회수가 조용히 빠지므로, 줄 선 트랜잭션 뒤에 도는지 본다.
 */
import { existsSync, writeFileSync } from 'node:fs'

import { reclaimLegacySpaceOnce } from '../legacy-space'
import { __resetStoragePortsForTest, setSqlitePort } from '../ports'
import { closeBossProfitDb, getBossProfitDb } from '../sqlite/db'
import { cashbookBackupPathOf } from '../sqlite/migrations'
import { inTransaction } from '../sqlite/transaction'
import { createRealSqlite, type RealSqlite } from '../sqlite/__tests__/node-sqlite-port'
import { installFakePreferences, type FakePreferences } from './fake-preferences'

const DONE_KEY = 'legacySpaceReclaimed'

let real: RealSqlite
let prefs: FakePreferences

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  prefs = installFakePreferences()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

/** 가계부 이관 전에 떠 둔 사본 파일 자리. DB 파일 경로에서 만든다. */
async function backupPath(): Promise<string> {
  const db = await getBossProfitDb()
  const { values } = await db.query('PRAGMA database_list')
  return cashbookBackupPathOf(String(values?.find((row) => row.name === 'main')?.file))
}

it('사본 파일을 지우고 VACUUM 한 뒤 표식을 둔다', async () => {
  const path = await backupPath()
  writeFileSync(path, 'copy')

  await reclaimLegacySpaceOnce()

  expect(existsSync(path)).toBe(false)
  expect(real.statements).toContain('VACUUM')
  expect(await prefs.get(DONE_KEY)).toBe('1')
})

it('사본 파일이 없어도 지운 것으로 보고 VACUUM 한다', async () => {
  await reclaimLegacySpaceOnce()

  expect(real.statements).toContain('VACUUM')
  expect(await prefs.get(DONE_KEY)).toBe('1')
})

it('표식이 있으면 다시 돌지 않는다', async () => {
  const path = await backupPath()
  writeFileSync(path, 'copy')
  await prefs.set(DONE_KEY, '1')

  await reclaimLegacySpaceOnce()

  expect(existsSync(path)).toBe(true)
  expect(real.statements).not.toContain('VACUUM')
})

it('실패하면 표식을 두지 않고 던지지 않아 다음 실행이 다시 돈다', async () => {
  jest.spyOn(real.port, 'removeFile').mockRejectedValueOnce(new Error('권한 없음'))

  await expect(reclaimLegacySpaceOnce()).resolves.toBeUndefined()
  expect(await prefs.get(DONE_KEY)).toBeNull()

  await reclaimLegacySpaceOnce()
  expect(await prefs.get(DONE_KEY)).toBe('1')
})

it('열린 쓰기 트랜잭션이 끝난 뒤에 VACUUM 한다', async () => {
  const db = await getBossProfitDb()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const writing = inTransaction(db, () => gate)

  const reclaiming = reclaimLegacySpaceOnce()
  await new Promise((resolve) => setImmediate(resolve))
  expect(real.statements).not.toContain('VACUUM')

  release()
  await writing
  await reclaiming

  expect(real.statements.indexOf('VACUUM')).toBeGreaterThan(real.statements.lastIndexOf('COMMIT'))
  expect(await prefs.get(DONE_KEY)).toBe('1')
})
