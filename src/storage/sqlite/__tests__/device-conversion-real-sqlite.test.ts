/// <reference types="node" />
/**
 * 1.0.15 기기 변환을 진짜 SQLite 로 태운다. 단계를 한 트랜잭션으로 돌리고 마친 번호를 같은 트랜잭션에 적는지, 사본을 한 번만
 * 뜨는지를 엔진에서 본다. 변환은 줄을 지워 되돌릴 수 없어서, 반만 바뀐 표나 덮인 사본이 남으면 사용자의 기록을 되살릴 수 없다.
 */
import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDbUngated } from '../db'
import { __setMigrationCeilingForTest, DB_VERSION } from '../migrations'
import {
  DEVICE_CONVERSION_VERSION,
  DeviceConversionError,
  deviceConversionVersionOf,
  runDeviceConversion,
  type DeviceConversionStep,
} from '../device-conversion'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
})

afterEach(async () => {
  __setMigrationCeilingForTest(null)
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

type Row = Record<string, unknown>

function all(sql: string): Row[] {
  return real.inspect((db) => db.prepare(sql).all() as Row[])
}

function tableExists(name: string): boolean {
  return all(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${name}'`).length > 0
}

/**
 * 1.0.14 에서 올라온 기기처럼 기기 변환을 하나도 돌지 않은 DB. 새 DB 는 처음 열 때 곧바로 변환을 돌아서, 이관 상한을 걸어
 * 그것을 막는다.
 */
async function openUnconverted() {
  __setMigrationCeilingForTest(DB_VERSION)
  return getBossProfitDbUngated()
}

/** 변환 전 사본의 경로. DB 파일 옆에 판 이름을 붙여 둔다. */
function backupPath(): string {
  const main = real.inspect((db) => (db.prepare('PRAGMA database_list').all() as Row[]).find((row) => row.name === 'main'))
  return String(main!.file).replace(/\.db$/, '-before-1.0.15.db')
}

describe('기기 변환 단계를 돌리는 차례', () => {
  // 새 기기에 따로 만드는 표 정의를 두지 않는다. 같은 단계를 돌아야 올라온 기기와 표가 같은 정의로 선다.
  it('새로 설치한 DB 는 처음 열 때 모든 단계를 돌고 사본을 뜨지 않으며, 다시 부르면 트랜잭션을 열지 않는다', async () => {
    const db = await getBossProfitDbUngated()
    expect(await deviceConversionVersionOf(db)).toBe(DEVICE_CONVERSION_VERSION)
    expect(existsSync(backupPath())).toBe(false)

    real.statements.length = 0
    await runDeviceConversion(db)
    expect(real.statements).not.toContain('BEGIN')
  })

  it('변환 전 DB 는 모든 단계를 돌아 마지막 번호를 적는다', async () => {
    const db = await openUnconverted()
    expect(await deviceConversionVersionOf(db)).toBe(0)

    await runDeviceConversion(db)

    expect(await deviceConversionVersionOf(db)).toBe(DEVICE_CONVERSION_VERSION)
  })

  // 단계마다 따로 적으면 앞 단계만 바뀐 표가 남는다. 그 표는 key 로 읽는 코드와 id 로 읽는 코드 어느 쪽도 읽지 못한다.
  it('단계가 던지면 앞 단계의 변경과 번호가 함께 되돌아가고, 다시 돌면 끝까지 간다', async () => {
    const db = await openUnconverted()
    let broken = true
    const steps: DeviceConversionStep[] = [
      (conn) => conn.execute('CREATE TABLE converted_first (id TEXT)'),
      async () => {
        if (broken) throw new Error('둘째 단계가 던진다')
      },
    ]

    await expect(runDeviceConversion(db, { steps: steps })).rejects.toThrow()
    expect(await deviceConversionVersionOf(db)).toBe(0)
    expect(tableExists('converted_first')).toBe(false)

    broken = false
    await runDeviceConversion(db, { steps: steps })
    expect(await deviceConversionVersionOf(db)).toBe(2)
    expect(tableExists('converted_first')).toBe(true)
  })

  // 개발 빌드는 PR 마다 단계가 늘어난다. 끝낸 단계를 다시 돌면 이미 바뀐 표를 옛 모양으로 읽으려다 던진다.
  it('적힌 번호 뒤의 단계만 돈다', async () => {
    const db = await openUnconverted()
    const ran: number[] = []
    const step = (n: number): DeviceConversionStep => async () => {
      ran.push(n)
    }
    await runDeviceConversion(db, { steps: [step(1)] })

    await runDeviceConversion(db, { steps: [step(1), step(2), step(3)] })

    expect(ran).toEqual([1, 2, 3])
    expect(await deviceConversionVersionOf(db)).toBe(3)
  })

  // 실패를 사용 로그로 보낼 때 어느 단계에서 멈췄는지가 고칠 곳을 알려 준다.
  it('던진 단계의 번호를 알린다', async () => {
    const db = await openUnconverted()
    const steps: DeviceConversionStep[] = [
      async () => {},
      async () => {
        throw new Error('둘째 단계가 던진다')
      },
    ]

    const error = await runDeviceConversion(db, { steps: steps }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(DeviceConversionError)
    expect((error as DeviceConversionError).step).toBe(2)
  })
})

describe('변환 전 사본', () => {
  // 변환은 줄을 지운다. 변환 코드에 잘못이 있어도 변환 전 DB 를 통째로 되돌릴 수 있어야 한다.
  it('돌 단계가 있으면 변환 전 DB 를 파일째 떠 두고, 돌 단계가 없으면 뜨지 않는다', async () => {
    const db = await openUnconverted()
    await db.execute(`CREATE TABLE before_conversion (id TEXT)`)
    await db.execute(`INSERT INTO before_conversion (id) VALUES ('a')`)

    await runDeviceConversion(db, { steps: [(conn) => conn.execute('DELETE FROM before_conversion')] })

    const backup = new DatabaseSync(backupPath(), { readOnly: true })
    try {
      expect(backup.prepare('SELECT count(*) AS n FROM before_conversion').get()).toEqual({ n: 1 })
    } finally {
      backup.close()
    }
  })

  it('번호가 이미 끝이면 사본을 뜨지 않는다', async () => {
    const db = await openUnconverted()
    await runDeviceConversion(db, { steps: [] })

    expect(existsSync(backupPath())).toBe(false)
  })

  // 한 번 실패한 기기가 다시 돌 때 사본이 반쯤 바뀐 DB 로 바뀌면 안 된다. 개발 빌드에서 단계가 늘어도 첫 사본이 남는다.
  it('사본이 이미 있으면 덮지 않는다', async () => {
    const db = await openUnconverted()
    await db.execute(`CREATE TABLE before_conversion (id TEXT)`)
    await db.execute(`INSERT INTO before_conversion (id) VALUES ('a')`)
    await runDeviceConversion(db, { steps: [async () => {}] })
    await db.execute(`INSERT INTO before_conversion (id) VALUES ('b')`)

    await runDeviceConversion(db, { steps: [async () => {}, async () => {}] })

    const backup = new DatabaseSync(backupPath(), { readOnly: true })
    try {
      expect(backup.prepare('SELECT count(*) AS n FROM before_conversion').get()).toEqual({ n: 1 })
    } finally {
      backup.close()
    }
  })
})

describe('변환 단계', () => {
  // 버전 13 이 이 표를 지우게 된 것은 그 버전을 지난 기기가 생긴 뒤라, 그 기기에는 빈 표가 남아 있다.
  it('버전 13 을 먼저 지난 기기에 남은 빈 표 boss_profit_period_checks 를 지운다', async () => {
    const db = await openUnconverted()
    await db.execute('CREATE TABLE boss_profit_period_checks (id TEXT)')

    await runDeviceConversion(db)

    expect(tableExists('boss_profit_period_checks')).toBe(false)
  })
})
