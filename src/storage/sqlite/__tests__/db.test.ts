import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPlatformMock } = vi.hoisted(() => ({
  getPlatformMock: vi.fn(),
}))

const {
  initWebStoreMock,
  isConnectionMock,
  retrieveConnectionMock,
  createConnectionMock,
  closeConnectionMock,
  sqliteConnectionCtorMock,
} = vi.hoisted(() => ({
  initWebStoreMock: vi.fn(),
  isConnectionMock: vi.fn(),
  retrieveConnectionMock: vi.fn(),
  createConnectionMock: vi.fn(),
  closeConnectionMock: vi.fn(),
  sqliteConnectionCtorMock: vi.fn(),
}))

const { dbOpenMock, dbExecuteMock } = vi.hoisted(() => ({
  dbOpenMock: vi.fn(),
  dbExecuteMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: getPlatformMock },
}))

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {},
  SQLiteConnection: class {
    constructor(...args: unknown[]) {
      sqliteConnectionCtorMock(...args)
    }
    initWebStore = initWebStoreMock
    isConnection = isConnectionMock
    retrieveConnection = retrieveConnectionMock
    createConnection = createConnectionMock
    closeConnection = closeConnectionMock
  },
}))

const fakeDb = { open: dbOpenMock, execute: dbExecuteMock }

beforeEach(() => {
  vi.resetModules()
  getPlatformMock.mockReset().mockReturnValue('android')
  initWebStoreMock.mockReset().mockResolvedValue(undefined)
  isConnectionMock.mockReset().mockResolvedValue({ result: false })
  retrieveConnectionMock.mockReset().mockResolvedValue(fakeDb)
  createConnectionMock.mockReset().mockResolvedValue(fakeDb)
  closeConnectionMock.mockReset().mockResolvedValue(undefined)
  sqliteConnectionCtorMock.mockReset()
  dbOpenMock.mockReset().mockResolvedValue(undefined)
  dbExecuteMock.mockReset().mockResolvedValue({ changes: { changes: 0 } })
})

describe('getBossProfitDb', () => {
  it('네이티브 플랫폼에서는 initWebStore 없이 커넥션을 생성하고 테이블을 만든다', async () => {
    const { getBossProfitDb } = await import('../db')

    const db = await getBossProfitDb()

    expect(initWebStoreMock).not.toHaveBeenCalled()
    expect(createConnectionMock).toHaveBeenCalledWith(
      'boss_profit',
      false,
      'no-encryption',
      1,
      false,
    )
    expect(dbOpenMock).toHaveBeenCalled()
    expect(dbExecuteMock).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS boss_profit_records'),
    )
    expect(dbExecuteMock).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS boss_party_settings'),
    )
    expect(dbExecuteMock).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS boss_profit_period_checks'),
    )
    expect(db).toBe(fakeDb)
  })

  it('웹 플랫폼에서는 커넥션을 열기 전에 initWebStore를 먼저 호출한다', async () => {
    getPlatformMock.mockReturnValue('web')
    const { getBossProfitDb } = await import('../db')

    await getBossProfitDb()

    expect(initWebStoreMock).toHaveBeenCalled()
    expect(createConnectionMock).toHaveBeenCalled()
  })

  it('이전 페이지 로드의 stale 커넥션이 있으면 닫고 새로 createConnection한다(리로드 대응)', async () => {
    isConnectionMock.mockResolvedValue({ result: true })
    const { getBossProfitDb } = await import('../db')

    await getBossProfitDb()

    expect(closeConnectionMock).toHaveBeenCalledWith('boss_profit', false)
    expect(createConnectionMock).toHaveBeenCalledWith('boss_profit', false, 'no-encryption', 1, false)
    expect(retrieveConnectionMock).not.toHaveBeenCalled()
  })

  it('여러 번 호출해도 커넥션과 SQLiteConnection 인스턴스를 한 번만 만든다(싱글턴)', async () => {
    const { getBossProfitDb } = await import('../db')

    const [first, second] = await Promise.all([getBossProfitDb(), getBossProfitDb()])

    expect(first).toBe(second)
    expect(createConnectionMock).toHaveBeenCalledTimes(1)
    expect(sqliteConnectionCtorMock).toHaveBeenCalledTimes(1)
  })
})
