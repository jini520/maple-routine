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

  it('커넥션 열기에 실패하면 실패를 캐시하지 않고 다음 호출에서 재시도한다', async () => {
    createConnectionMock.mockRejectedValueOnce(new Error('open fail'))
    const { getBossProfitDb } = await import('../db')

    await expect(getBossProfitDb()).rejects.toThrow('open fail')

    const db = await getBossProfitDb()
    expect(db).toBe(fakeDb)
    expect(createConnectionMock).toHaveBeenCalledTimes(2)
  })

  it('여러 번 호출해도 커넥션과 SQLiteConnection 인스턴스를 한 번만 만든다(싱글턴)', async () => {
    const { getBossProfitDb } = await import('../db')

    const [first, second] = await Promise.all([getBossProfitDb(), getBossProfitDb()])

    expect(first).toBe(second)
    expect(createConnectionMock).toHaveBeenCalledTimes(1)
    expect(sqliteConnectionCtorMock).toHaveBeenCalledTimes(1)
  })
})

describe('closeBossProfitDb', () => {
  it('열린 적 있는 커넥션을 정상 종료하고, 다음 getBossProfitDb는 새로 연다', async () => {
    const { getBossProfitDb, closeBossProfitDb } = await import('../db')

    await getBossProfitDb()
    await closeBossProfitDb()

    expect(closeConnectionMock).toHaveBeenCalledWith('boss_profit', false)

    await getBossProfitDb()
    expect(createConnectionMock).toHaveBeenCalledTimes(2)
  })

  it('한 번도 연 적 없으면 아무것도 하지 않는다', async () => {
    const { closeBossProfitDb } = await import('../db')

    await closeBossProfitDb()

    expect(closeConnectionMock).not.toHaveBeenCalled()
  })

  it('종료 중 에러가 나도 던지지 않는다(리로드는 곧 진행돼야 하므로 best-effort)', async () => {
    closeConnectionMock.mockRejectedValue(new Error('close fail'))
    const { getBossProfitDb, closeBossProfitDb } = await import('../db')

    await getBossProfitDb()

    await expect(closeBossProfitDb()).resolves.toBeUndefined()
  })

  // closeConnection이 아직 끝나지 않은 도중 다른 곳에서 getBossProfitDb()를 동시에 호출해도,
  // 새 openBossProfitDb(→createConnection)를 시작하지 말고 기존(닫히는 중인) 커넥션을 그대로
  // 반환해야 한다 — 안 그러면 이 함수의 closeConnection과 그 동시 호출의 createConnection이
  // 뒤엉켜 네이티브에서 "Connection boss_profit already exists"가 날 수 있다.
  it('종료 중에 getBossProfitDb가 동시에 호출돼도 새 커넥션을 만들지 않는다(레이스 방지)', async () => {
    let resolveClose!: () => void
    closeConnectionMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve
        }),
    )
    const { getBossProfitDb, closeBossProfitDb } = await import('../db')

    await getBossProfitDb()
    expect(createConnectionMock).toHaveBeenCalledTimes(1)

    const closePromise = closeBossProfitDb()
    // closeBossProfitDb는 dbPromise를 await한 뒤에야 closeConnection을 호출하므로, resolveClose가
    // 할당될 때까지 마이크로태스크를 한 번 흘려보낸다 — 그 사이(닫는 도중)에 getBossProfitDb를 호출한다.
    await Promise.resolve()
    const concurrentGet = getBossProfitDb()

    resolveClose()
    await closePromise
    await concurrentGet

    expect(createConnectionMock).toHaveBeenCalledTimes(1)
  })
})
