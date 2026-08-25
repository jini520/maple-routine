/// <reference types="node" />
import { readFileSync } from 'node:fs'

const isWebPlatformMock = jest.fn()
const initWebStoreMock = jest.fn()
const isConnectionMock = jest.fn()
const createConnectionMock = jest.fn()
const dbQueryMock = jest.fn()
const closeConnectionMock = jest.fn()
const dbOpenMock = jest.fn()
const dbExecuteMock = jest.fn()

// 포트 역전 후([[ADR-128]]) db.ts는 플러그인이 아니라 SqlitePort에만 의존한다 — 가로채는 지점이
// SQLite 플러그인 모듈 목에서 주입된 가짜 포트로 바뀌었을 뿐, 검증 대상(어떤
// 인자로 커넥션을 여는가·stale 커넥션을 닫는가·스키마와 마이그레이션을 도는가)은 그대로다.
// `retrieveConnection` 을 쓰지 않는다는 것은 이제 포트 표면에 그 연산이 없어 구조적으로 보장된다.
// ADR-069 결정 1: openBossProfitDb가 PRAGMA table_info로 world 컬럼 존재를 확인한다(SQLite에
// ADD COLUMN IF NOT EXISTS가 없다) — 기본값은 "이미 있음"으로 둬 기존 케이스가 ALTER를 타지 않게 한다.
const fakeDb = { open: dbOpenMock, execute: dbExecuteMock, query: dbQueryMock, run: jest.fn() }

beforeEach(async () => {
  jest.resetModules()
  isWebPlatformMock.mockReset().mockReturnValue(false)
  initWebStoreMock.mockReset().mockResolvedValue(undefined)
  isConnectionMock.mockReset().mockResolvedValue(false)
  createConnectionMock.mockReset().mockResolvedValue(fakeDb)
  dbQueryMock.mockReset().mockResolvedValue({ values: [{ name: 'world' }] })
  closeConnectionMock.mockReset().mockResolvedValue(undefined)
  dbOpenMock.mockReset().mockResolvedValue(undefined)
  dbExecuteMock.mockReset().mockResolvedValue({ changes: { changes: 0 } })

  // resetModules 뒤에 주입한다 — db.ts가 그때 새로 만들어지는 ports 인스턴스를 읽기 때문이다.
  const { setSqlitePort } = require('../../ports') as typeof import('../../ports')
  setSqlitePort({
    isWebPlatform: isWebPlatformMock,
    initWebStore: initWebStoreMock,
    isConnection: isConnectionMock,
    closeConnection: closeConnectionMock,
    createConnection: createConnectionMock,
  })
})

describe('getBossProfitDb', () => {
  it('네이티브 플랫폼에서는 initWebStore 없이 커넥션을 생성하고 테이블을 만든다', async () => {
    const { getBossProfitDb } = require('../db') as typeof import('../db')

    const db = await getBossProfitDb()

    expect(initWebStoreMock).not.toHaveBeenCalled()
    expect(createConnectionMock).toHaveBeenCalledWith('boss_profit', 'no-encryption', 1)
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
    // [[ADR-170]] 결정 2 · [[ADR-166]] — 가계부가 손으로 적는 둘.
    expect(dbExecuteMock).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS income_records'),
    )
    expect(dbExecuteMock).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS spend_records'),
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
    const { getBossProfitDb } = require('../db') as typeof import('../db')

    await getBossProfitDb()

    expect(dbExecuteMock).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE boss_party_settings SET boss = '시즌 보스 메이린' WHERE boss = '메이린'/),
    )
    expect(dbExecuteMock).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE boss_profit_records SET boss = '시즌 보스 메이린' WHERE boss = '메이린'/),
    )
  })

  it('웹 플랫폼에서는 커넥션을 열기 전에 initWebStore를 먼저 호출한다', async () => {
    isWebPlatformMock.mockReturnValue(true)
    const { getBossProfitDb } = require('../db') as typeof import('../db')

    await getBossProfitDb()

    expect(initWebStoreMock).toHaveBeenCalled()
    expect(createConnectionMock).toHaveBeenCalled()
  })

  it('이전 페이지 로드의 stale 커넥션이 있으면 닫고 새로 createConnection한다(리로드 대응)', async () => {
    isConnectionMock.mockResolvedValue(true)
    const { getBossProfitDb } = require('../db') as typeof import('../db')

    await getBossProfitDb()

    expect(closeConnectionMock).toHaveBeenCalledWith('boss_profit')
    expect(createConnectionMock).toHaveBeenCalledWith('boss_profit', 'no-encryption', 1)
  })

  it('커넥션 열기에 실패하면 실패를 캐시하지 않고 다음 호출에서 재시도한다', async () => {
    createConnectionMock.mockRejectedValueOnce(new Error('open fail'))
    const { getBossProfitDb } = require('../db') as typeof import('../db')

    await expect(getBossProfitDb()).rejects.toThrow('open fail')

    const db = await getBossProfitDb()
    expect(db).toBe(fakeDb)
    expect(createConnectionMock).toHaveBeenCalledTimes(2)
  })

  // 커넥션 매니저 인스턴스 자체를 한 번만 만드는 것은 이제 어댑터(capacitor-sqlite)의
  // 몫이다 — db.ts가 지는 계약은 "같은 이름 커넥션을 두 번 열지 않는다" 하나로 남는다.
  it('여러 번 호출해도 커넥션을 한 번만 만든다(싱글턴)', async () => {
    const { getBossProfitDb } = require('../db') as typeof import('../db')

    const [first, second] = await Promise.all([getBossProfitDb(), getBossProfitDb()])

    expect(first).toBe(second)
    expect(createConnectionMock).toHaveBeenCalledTimes(1)
  })

  // ADR-050 결정 2: 예기치 않은 리로드(탭 링크 기본 동작 누출, WebKit 콘텐츠 프로세스 사망 시
  // Capacitor의 자동 reload) 뒤에는 stale한 네이티브 커넥션이 남아 첫 호출이 에러 없이 멈출 수
  // 있다. reject 경로에만 복구가 있으면 그 죽은 커넥션이 dbPromise에 영구 캐시돼 앱을 재시작할
  // 때까지 모든 조회가 실패한다.
  it('커넥션 열기가 응답하지 않으면 타임아웃으로 실패하고 다음 호출에서 다시 연다', async () => {
    jest.useFakeTimers()
    try {
      dbOpenMock.mockReturnValueOnce(new Promise(() => {}))
      const { getBossProfitDb } = require('../db') as typeof import('../db')

      const pending = getBossProfitDb()
      const rejection = expect(pending).rejects.toThrow(/시간 초과/)
      await jest.advanceTimersByTimeAsync(60_000)
      await rejection
    } finally {
      jest.useRealTimers()
    }

    const { getBossProfitDb } = require('../db') as typeof import('../db')
    const db = await getBossProfitDb()

    expect(db).toBe(fakeDb)
    expect(createConnectionMock).toHaveBeenCalledTimes(2)
  })

  it('타임아웃 안에 열리면 정상 동작하며 타임아웃 에러를 남기지 않는다', async () => {
    jest.useFakeTimers()
    try {
      const { getBossProfitDb } = require('../db') as typeof import('../db')

      const pending = getBossProfitDb()
      await jest.advanceTimersByTimeAsync(60_000)

      await expect(pending).resolves.toBe(fakeDb)
    } finally {
      jest.useRealTimers()
    }
  })
})

// ADR-052 결정 2: 삭제 대상 테이블 목록의 단일 진실 공급원은 db.ts의 테이블 정의 배열 하나다.
// 정의 배열을 순회해 CREATE하므로 구조적으로 drift가 어렵지만, 배열을 거치지 않고 db.execute에
// CREATE 문을 직접 끼워 넣는 경우까지 잡기 위해 소스 자체를 읽어 대조한다 — 여기서 누락되면
// 캐시 데이터 삭제·용량 계산이 그 테이블을 조용히 빠뜨린다(boss_drop_records가 그랬다).
describe('BOSS_PROFIT_TABLE_NAMES', () => {
  it('db.ts가 만드는 모든 테이블이 export된 이름 목록에 들어 있다', async () => {
    const { BOSS_PROFIT_TABLE_NAMES } = require('../db') as typeof import('../db')

    const source = readFileSync((__dirname + '/../db.ts'), 'utf-8')
    const createdTables = [...source.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(
      (match) => match[1],
    )

    expect([...createdTables].sort()).toEqual([...BOSS_PROFIT_TABLE_NAMES].sort())
  })
})

describe('closeBossProfitDb', () => {
  it('열린 적 있는 커넥션을 정상 종료하고, 다음 getBossProfitDb는 새로 연다', async () => {
    const { getBossProfitDb, closeBossProfitDb } = require('../db') as typeof import('../db')

    await getBossProfitDb()
    await closeBossProfitDb()

    expect(closeConnectionMock).toHaveBeenCalledWith('boss_profit')

    await getBossProfitDb()
    expect(createConnectionMock).toHaveBeenCalledTimes(2)
  })

  it('한 번도 연 적 없으면 아무것도 하지 않는다', async () => {
    const { closeBossProfitDb } = require('../db') as typeof import('../db')

    await closeBossProfitDb()

    expect(closeConnectionMock).not.toHaveBeenCalled()
  })

  it('종료 중 에러가 나도 던지지 않는다(리로드는 곧 진행돼야 하므로 best-effort)', async () => {
    closeConnectionMock.mockRejectedValue(new Error('close fail'))
    const { getBossProfitDb, closeBossProfitDb } = require('../db') as typeof import('../db')

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
    const { getBossProfitDb, closeBossProfitDb } = require('../db') as typeof import('../db')

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

  // ADR-117 결정 5: 여는 쪽에는 타임아웃이 있는데(withOpenTimeout, 10초) 닫는 쪽은 맨몸이었다.
  // 네이티브 closeConnection이 응답하지 않으면 이 함수가 영원히 resolve하지 않고, 이 뒤에 오는
  // 리로드(라이브 업데이트 set · 페이지 리로드)가 실행되지 못한다 — 그것이 곧 "주황
  // 스플래시 무한" 증상이다. 실기기에서 SQLite 네이티브 호출이 응답 없이 멈춘 사례가 둘 있다
  // ([[ADR-008]] 2026-07-17 정정, [[ADR-050]] 결정 2).
  //
  // 가짜 타이머는 케이스 안에서만 켠다 — 파일 전역으로 켜면 위 레이스 케이스가 의존하는
  // 마이크로태스크 순서가 흔들린다.
  it('닫기가 응답하지 않아도 5초 타임아웃으로 끝난다 — 던지지 않는다(best-effort)', async () => {
    jest.useFakeTimers()
    try {
      closeConnectionMock.mockImplementation(() => new Promise<void>(() => {}))
      const { getBossProfitDb, closeBossProfitDb } = require('../db') as typeof import('../db')

      await getBossProfitDb()

      let settled = false
      const closePromise = closeBossProfitDb().then(() => {
        settled = true
      })
      await jest.advanceTimersByTimeAsync(5_000)

      await expect(closePromise).resolves.toBeUndefined()
      expect(settled).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })

  it('닫기가 타임아웃돼도 dbPromise를 비워 다음 getBossProfitDb가 새로 연다', async () => {
    jest.useFakeTimers()
    try {
      closeConnectionMock.mockImplementation(() => new Promise<void>(() => {}))
      const { getBossProfitDb, closeBossProfitDb } = require('../db') as typeof import('../db')

      await getBossProfitDb()
      expect(createConnectionMock).toHaveBeenCalledTimes(1)

      const closePromise = closeBossProfitDb()
      await jest.advanceTimersByTimeAsync(5_000)
      await closePromise

      await getBossProfitDb()
      expect(createConnectionMock).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  // 상한이 조용히 줄어드는 것을 막는다 — 이 값은 적용 경로에서 사용자가 무반응을 견디는 시간이다.
  it('4.9초에는 아직 끝나지 않고, 5초를 넘겨야 끝난다', async () => {
    jest.useFakeTimers()
    try {
      closeConnectionMock.mockImplementation(() => new Promise<void>(() => {}))
      const { getBossProfitDb, closeBossProfitDb } = require('../db') as typeof import('../db')

      await getBossProfitDb()

      let settled = false
      void closeBossProfitDb().then(() => {
        settled = true
      })

      await jest.advanceTimersByTimeAsync(4_900)
      expect(settled).toBe(false)

      await jest.advanceTimersByTimeAsync(200)
      expect(settled).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })

  it('한 번도 연 적 없으면 타이머조차 걸지 않는다', async () => {
    jest.useFakeTimers()
    try {
      const { closeBossProfitDb } = require('../db') as typeof import('../db')

      await closeBossProfitDb()

      expect(jest.getTimerCount()).toBe(0)
      expect(closeConnectionMock).not.toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })
})

// ADR-069 결정 1: 이미 만들어진 DB에는 CREATE TABLE IF NOT EXISTS가 컬럼을 더해주지 않는다.
// SQLite에 ADD COLUMN IF NOT EXISTS가 없으므로 PRAGMA로 확인하고 없을 때만 ALTER한다.
describe('world 컬럼 마이그레이션 (ADR-069 결정 1)', () => {
  it('컬럼이 없으면 ALTER TABLE로 더한다', async () => {
    isConnectionMock.mockResolvedValue(false)
    dbQueryMock.mockResolvedValue({ values: [{ name: 'ocid' }, { name: 'boss' }] })

    const { getBossProfitDb } = require('../db') as typeof import('../db')
    await getBossProfitDb()

    expect(dbExecuteMock).toHaveBeenCalledWith('ALTER TABLE boss_profit_records ADD COLUMN world TEXT')
  })

  it('이미 있으면 ALTER하지 않는다 — 매번 열려도 안전한 no-op이다', async () => {
    isConnectionMock.mockResolvedValue(false)
    dbQueryMock.mockResolvedValue({ values: [{ name: 'world' }] })

    const { getBossProfitDb } = require('../db') as typeof import('../db')
    await getBossProfitDb()

    // **컬럼을 지목해 센다.** `ADD COLUMN` 전체를 세면 같은 `ensureColumn` 을 쓰는 다른 컬럼이
    // 늘어날 때마다 이 테스트가 엉뚱하게 깨진다(실제로 [[ADR-124]] 가격 컬럼에서 그랬다).
    const altered = dbExecuteMock.mock.calls.some(([sql]) => String(sql).includes('ADD COLUMN world'))
    expect(altered).toBe(false)
  })
})

// [[ADR-124]] 결정 4 — 가격 세 컬럼도 같은 사정이다. 이미 드롭을 기록해 둔 사용자의 DB에는
// `boss_drop_records` 가 이미 있으므로 CREATE 로는 컬럼이 붙지 않는다.
describe('가격 컬럼 마이그레이션 (ADR-124 결정 4)', () => {
  it('없으면 price_state·price_meso·price_share 를 ALTER 로 더한다', async () => {
    isConnectionMock.mockResolvedValue(false)
    dbQueryMock.mockResolvedValue({ values: [{ name: 'ocid' }] })

    const { getBossProfitDb } = require('../db') as typeof import('../db')
    await getBossProfitDb()

    expect(dbExecuteMock).toHaveBeenCalledWith(
      'ALTER TABLE boss_drop_records ADD COLUMN price_state TEXT',
    )
    expect(dbExecuteMock).toHaveBeenCalledWith(
      'ALTER TABLE boss_drop_records ADD COLUMN price_meso INTEGER',
    )
    expect(dbExecuteMock).toHaveBeenCalledWith(
      'ALTER TABLE boss_drop_records ADD COLUMN price_share INTEGER',
    )
  })

  it('이미 있으면 더하지 않는다', async () => {
    isConnectionMock.mockResolvedValue(false)
    dbQueryMock.mockResolvedValue({
      values: [{ name: 'price_state' }, { name: 'price_meso' }, { name: 'price_share' }],
    })

    const { getBossProfitDb } = require('../db') as typeof import('../db')
    await getBossProfitDb()

    const altered = dbExecuteMock.mock.calls.filter(([sql]) => String(sql).includes('ADD COLUMN price_'))
    expect(altered).toEqual([])
  })
})

// [[ADR-172]] — 처치 날짜(`defeated_on`)도 나중에 더한 컬럼이다. `world` 와 같은 사정이라
// 여기 없으면 **이미 보스를 기록해 둔 기기에서만** 조용히 UPDATE 가 실패한다(새 기기는 멀쩡하다).
describe('defeated_on 컬럼 마이그레이션 ([[ADR-172]])', () => {
  it('없으면 ALTER 로 더한다', async () => {
    isConnectionMock.mockResolvedValue(false)
    dbQueryMock.mockResolvedValue({ values: [{ name: 'ocid' }] })

    const { getBossProfitDb } = require('../db') as typeof import('../db')
    await getBossProfitDb()

    expect(dbExecuteMock).toHaveBeenCalledWith(
      'ALTER TABLE boss_profit_records ADD COLUMN defeated_on TEXT',
    )
  })

  it('이미 있으면 더하지 않는다', async () => {
    isConnectionMock.mockResolvedValue(false)
    dbQueryMock.mockResolvedValue({ values: [{ name: 'defeated_on' }] })

    const { getBossProfitDb } = require('../db') as typeof import('../db')
    await getBossProfitDb()

    const altered = dbExecuteMock.mock.calls.some(([sql]) =>
      String(sql).includes('ADD COLUMN defeated_on'),
    )
    expect(altered).toBe(false)
  })
})

// **테이블을 세운 커밋과 컬럼을 더한 커밋이 갈렸다.** `spend_records` 는 `form` 없이 만들어졌고
// (177c195b) 「지출 항목 고르기를 두 단계로」(89e806fa)가 뒤늦게 그 컬럼을 CREATE 문에만 더했다 —
// 그 사이에 앱을 켠 기기는 `form` 없는 테이블을 들고 있어 **INSERT 가 통째로 실패한다**(실기
// 재현 2026-08-25 — 지출이 하나도 안 적혔다). [[ADR-069]] 결정 1 이 적어 둔 함정 그대로다.
describe('form 컬럼 마이그레이션 ([[ADR-069]] 결정 1)', () => {
  it('없으면 ALTER 로 더한다', async () => {
    isConnectionMock.mockResolvedValue(false)
    dbQueryMock.mockResolvedValue({ values: [{ name: 'id' }, { name: 'spent_on' }] })

    const { getBossProfitDb } = require('../db') as typeof import('../db')
    await getBossProfitDb()

    expect(dbExecuteMock).toHaveBeenCalledWith('ALTER TABLE spend_records ADD COLUMN form TEXT')
  })

  it('이미 있으면 안 더한다 — 매번 열려도 안전한 no-op 이다', async () => {
    isConnectionMock.mockResolvedValue(false)
    dbQueryMock.mockResolvedValue({ values: [{ name: 'form' }] })

    const { getBossProfitDb } = require('../db') as typeof import('../db')
    await getBossProfitDb()

    const altered = dbExecuteMock.mock.calls.some(([sql]) => String(sql).includes('ADD COLUMN form'))
    expect(altered).toBe(false)
  })
})
