import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPlatformMock
} = vi.hoisted(() => ({
  getPlatformMock: vi.fn(),
}))

const {
  initWebStoreMock,
  isConnectionMock,
  retrieveConnectionMock,
  createConnectionMock,
  dbQueryMock,
  closeConnectionMock,
  sqliteConnectionCtorMock,
} = vi.hoisted(() => ({
  initWebStoreMock: vi.fn(),
  isConnectionMock: vi.fn(),
  retrieveConnectionMock: vi.fn(),
  createConnectionMock: vi.fn(),
  dbQueryMock: vi.fn(),
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

// ADR-069 결정 1: openBossProfitDb가 PRAGMA table_info로 world 컬럼 존재를 확인한다(SQLite에
// ADD COLUMN IF NOT EXISTS가 없다) — 기본값은 "이미 있음"으로 둬 기존 케이스가 ALTER를 타지 않게 한다.
const fakeDb = { open: dbOpenMock, execute: dbExecuteMock, query: dbQueryMock }

beforeEach(() => {
  vi.resetModules()
  getPlatformMock.mockReset().mockReturnValue('android')
  initWebStoreMock.mockReset().mockResolvedValue(undefined)
  isConnectionMock.mockReset().mockResolvedValue({ result: false })
  retrieveConnectionMock.mockReset().mockResolvedValue(fakeDb)
  createConnectionMock.mockReset().mockResolvedValue(fakeDb)
  dbQueryMock.mockReset().mockResolvedValue({ values: [{ name: 'world' }] })
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
    expect(dbExecuteMock).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS boss_drop_records'),
    )
    expect(db).toBe(fakeDb)
  })

  // 메이린 카드 표시명을 API content_name('시즌 보스 메이린')과 통일하며 boss 식별 키를 바꿨다
  // (2026-07-22) — 기존에 저장된 파티 설정·수익 기록이 새 키를 못 찾는 고아 데이터가 되지
  // 않도록, 열 때마다 옛 키를 새 키로 옮겨준다(이미 옮겨졌으면 WHERE절에 걸리는 행이 없어
  // no-op).
  it('boss_party_settings/boss_profit_records의 옛 boss 키(메이린)를 새 키(시즌 보스 메이린)로 마이그레이션한다', async () => {
    const { getBossProfitDb } = await import('../db')

    await getBossProfitDb()

    expect(dbExecuteMock).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE boss_party_settings SET boss = '시즌 보스 메이린' WHERE boss = '메이린'/),
    )
    expect(dbExecuteMock).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE boss_profit_records SET boss = '시즌 보스 메이린' WHERE boss = '메이린'/),
    )
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

  // ADR-050 결정 2: 예기치 않은 리로드(탭 링크 기본 동작 누출, WebKit 콘텐츠 프로세스 사망 시
  // Capacitor의 자동 reload) 뒤에는 stale한 네이티브 커넥션이 남아 첫 호출이 에러 없이 멈출 수
  // 있다. reject 경로에만 복구가 있으면 그 죽은 커넥션이 dbPromise에 영구 캐시돼 앱을 재시작할
  // 때까지 모든 조회가 실패한다.
  it('커넥션 열기가 응답하지 않으면 타임아웃으로 실패하고 다음 호출에서 다시 연다', async () => {
    vi.useFakeTimers()
    try {
      dbOpenMock.mockReturnValueOnce(new Promise(() => {}))
      const { getBossProfitDb } = await import('../db')

      const pending = getBossProfitDb()
      const rejection = expect(pending).rejects.toThrow(/시간 초과/)
      await vi.advanceTimersByTimeAsync(60_000)
      await rejection
    } finally {
      vi.useRealTimers()
    }

    const { getBossProfitDb } = await import('../db')
    const db = await getBossProfitDb()

    expect(db).toBe(fakeDb)
    expect(createConnectionMock).toHaveBeenCalledTimes(2)
  })

  it('타임아웃 안에 열리면 정상 동작하며 타임아웃 에러를 남기지 않는다', async () => {
    vi.useFakeTimers()
    try {
      const { getBossProfitDb } = await import('../db')

      const pending = getBossProfitDb()
      await vi.advanceTimersByTimeAsync(60_000)

      await expect(pending).resolves.toBe(fakeDb)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ADR-052 결정 2: 삭제 대상 테이블 목록의 단일 진실 공급원은 db.ts의 테이블 정의 배열 하나다.
// 정의 배열을 순회해 CREATE하므로 구조적으로 drift가 어렵지만, 배열을 거치지 않고 db.execute에
// CREATE 문을 직접 끼워 넣는 경우까지 잡기 위해 소스 자체를 읽어 대조한다 — 여기서 누락되면
// 캐시 데이터 삭제·용량 계산이 그 테이블을 조용히 빠뜨린다(boss_drop_records가 그랬다).
describe('BOSS_PROFIT_TABLE_NAMES', () => {
  it('db.ts가 만드는 모든 테이블이 export된 이름 목록에 들어 있다', async () => {
    const { BOSS_PROFIT_TABLE_NAMES } = await import('../db')

    const source = readFileSync(new URL('../db.ts', import.meta.url), 'utf-8')
    const createdTables = [...source.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(
      (match) => match[1],
    )

    expect([...createdTables].sort()).toEqual([...BOSS_PROFIT_TABLE_NAMES].sort())
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

// ADR-069 결정 1: 이미 만들어진 DB에는 CREATE TABLE IF NOT EXISTS가 컬럼을 더해주지 않는다.
// SQLite에 ADD COLUMN IF NOT EXISTS가 없으므로 PRAGMA로 확인하고 없을 때만 ALTER한다.
describe('world 컬럼 마이그레이션 (ADR-069 결정 1)', () => {
  it('컬럼이 없으면 ALTER TABLE로 더한다', async () => {
    getPlatformMock.mockReturnValue('ios')
    isConnectionMock.mockResolvedValue({ result: false })
    dbQueryMock.mockResolvedValue({ values: [{ name: 'ocid' }, { name: 'boss' }] })

    const { getBossProfitDb } = await import('../db')
    await getBossProfitDb()

    expect(dbExecuteMock).toHaveBeenCalledWith('ALTER TABLE boss_profit_records ADD COLUMN world TEXT')
  })

  it('이미 있으면 ALTER하지 않는다 — 매번 열려도 안전한 no-op이다', async () => {
    getPlatformMock.mockReturnValue('ios')
    isConnectionMock.mockResolvedValue({ result: false })
    dbQueryMock.mockResolvedValue({ values: [{ name: 'world' }] })

    const { getBossProfitDb } = await import('../db')
    await getBossProfitDb()

    const altered = dbExecuteMock.mock.calls.some(([sql]) => String(sql).includes('ADD COLUMN'))
    expect(altered).toBe(false)
  })
})
