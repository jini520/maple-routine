// 순수 규칙(`capacitor-sqlite-open.test.ts`)이 지키는 것은 "어느 파일을 여는가" 이고, 이 파일이
// 지키는 것은 **어댑터가 포트 계약을 지키는가** 다. 특히 `query` 의 반환 모양 — op-sqlite 는 `rows`
// 로 주고 `db.ts`·`storage/boss-*.ts` 는 `values` 를 읽으므로, 안 감싸면 타입 에러 없이 모든 조회가
// 빈 결과가 되고 화면에는 기록이 사라진 것으로 보인다.
//
// 그래서 목으로 흉내 내는 것은 SQLite 의 동작이 아니라 **op-sqlite 가 우리에게 주는 모양**뿐이다
// (`open()` 이 받는 옵션, `execute()` 가 돌려주는 `{ rows }`). 상상한 DB 엔진을 검증하지 않도록
// 실제 계약 검사는 아래 «db.ts 와 맞물리는가» 가 `src/storage/sqlite` 의 진짜 코드로 한다.
//
// jest 기본 플랫폼은 ios 다(`jest-expo`) — data.md 가 유일하게 미검증으로 남긴 쪽, 즉 틀리면
// 데이터가 안 보이는 쪽이 검사된다. android 경로 선택은 순수 테스트가 덮는다.

// `mock` 접두사는 필수다 — `jest.mock` 팩토리가 위로 끌어올려지므로 babel 이 그 접두사가 붙은
// 것만 바깥 변수 참조로 허용한다. 팩토리가 **호출되는** 시점에만 읽히도록 전부 화살표 함수 안에서
// 참조한다(팩토리 반환값에 직접 쓰면 TDZ 다).
interface MockDb {
  options: Record<string, unknown>
  statements: { statement: string; values?: unknown[] }[]
  closed: boolean
}

const mockOpened: MockDb[] = []
let mockRowsFor: (statement: string) => Record<string, unknown>[] = () => []

jest.mock('@op-engineering/op-sqlite', () => ({
  __esModule: true,
  ANDROID_DATABASE_PATH: '/data/user/0/com.mapleroutine.app/databases/',
  IOS_DOCUMENT_PATH: '/var/mobile/Containers/Data/Application/ABC/Documents',
  open: (options: Record<string, unknown>) => {
    const db: MockDb = { options, statements: [], closed: false }
    mockOpened.push(db)
    return {
      execute: async (statement: string, values?: unknown[]) => {
        db.statements.push({ statement, values })
        return { rows: mockRowsFor(statement), rowsAffected: 0 }
      },
      closeAsync: async () => {
        db.closed = true
      },
    }
  },
}))

import { IOS_DOCUMENT_PATH } from '@op-engineering/op-sqlite'
import { BOSS_PROFIT_TABLE_NAMES, closeBossProfitDb, getBossProfitDb } from '../../sqlite/db'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'

import { rnSqlitePort } from '../rn-sqlite'

beforeEach(() => {
  mockOpened.length = 0
  mockRowsFor = () => []
})

afterEach(async () => {
  await rnSqlitePort.closeConnection('boss_profit')
})

describe('rnSqlitePort', () => {
  it('웹 폴백이 없다 — RN 에는 웹 타깃이 없다', async () => {
    expect(rnSqlitePort.isWebPlatform()).toBe(false)
    await expect(rnSqlitePort.initWebStore()).resolves.toBeUndefined()
  })

  // 이 전환에서 가장 중요한 한 줄이다 — 이 옵션이 곧 "Capacitor 가 남기고 간 파일을 연다"이다.
  it('Capacitor 가 쓰던 파일을 연다 (iOS)', async () => {
    const db = await rnSqlitePort.createConnection('boss_profit', 'no-encryption', 1)
    await db.open()

    expect(mockOpened).toHaveLength(1)
    expect(mockOpened[0].options).toEqual({
      name: 'boss_profitSQLite.db',
      location: IOS_DOCUMENT_PATH,
    })
  })

  it('열려 있는 동안만 isConnection 이 참이다', async () => {
    expect(await rnSqlitePort.isConnection('boss_profit')).toBe(false)

    const db = await rnSqlitePort.createConnection('boss_profit', 'no-encryption', 1)
    await db.open()
    expect(await rnSqlitePort.isConnection('boss_profit')).toBe(true)

    await rnSqlitePort.closeConnection('boss_profit')
    expect(await rnSqlitePort.isConnection('boss_profit')).toBe(false)
    expect(mockOpened[0].closed).toBe(true)
  })

  it('조회 결과를 values 로 감싼다', async () => {
    mockRowsFor = () => [{ ocid: 'abc123', payout_meso: 1_500_000 }]
    const db = await rnSqlitePort.createConnection('boss_profit', 'no-encryption', 1)
    await db.open()

    expect(await db.query('SELECT * FROM boss_profit_records WHERE ocid = ?', ['abc123'])).toEqual(
      { values: [{ ocid: 'abc123', payout_meso: 1_500_000 }] },
    )
  })

  it('결과가 없으면 빈 values 다 (없는 것이지 조회가 안 된 것이 아니다)', async () => {
    const db = await rnSqlitePort.createConnection('boss_profit', 'no-encryption', 1)
    await db.open()

    expect(await db.query('SELECT * FROM boss_profit_records')).toEqual({ values: [] })
  })

  it('바인딩 값을 그대로 넘긴다', async () => {
    const db = await rnSqlitePort.createConnection('boss_profit', 'no-encryption', 1)
    await db.open()

    // ADR-124: NULL 은 '미입력'이고 0 과 다르다 — 바인딩에서 뭉개지면 거짓 기록이 된다.
    await db.run('INSERT INTO boss_drop_records VALUES (?, ?, ?)', ['abc123', null, 0])

    expect(mockOpened[0].statements.at(-1)?.values).toEqual(['abc123', null, 0])
  })
})

// `db.ts` 는 이 step 에서 한 글자도 안 고쳤다(당시엔 `packages/core` 에 있었고 웹 앱과 공유했다).
// 그래서 어댑터가 계약을 지키는지는 목이 아니라 **그 진짜 코드를 돌려** 확인한다 — 특히
// `ensureColumn` 은 `PRAGMA table_info` 결과를 `values` 로 읽으므로, 감싸는 모양이 어긋나면
// "컬럼이 없다"로 읽혀 매 부팅마다 ALTER 를 시도한다.
describe('db.ts 와 맞물리는가', () => {
  beforeEach(() => {
    setSqlitePort(rnSqlitePort)
  })

  afterEach(async () => {
    await closeBossProfitDb()
    __resetStoragePortsForTest()
  })

  it('옛 스키마 DB 에는 빠진 컬럼을 더한다 (ADR-069 결정 1)', async () => {
    mockRowsFor = (statement) =>
      statement.startsWith('PRAGMA table_info') ? [{ name: 'ocid' }] : []

    await getBossProfitDb()

    const executed = mockOpened[0].statements.map((entry) => entry.statement.trim())
    expect(executed.filter((statement) => statement.startsWith('ALTER TABLE'))).toEqual([
      'ALTER TABLE boss_profit_records ADD COLUMN world TEXT',
      'ALTER TABLE boss_profit_records ADD COLUMN defeated_on TEXT',
      'ALTER TABLE boss_drop_records ADD COLUMN price_state TEXT',
      'ALTER TABLE boss_drop_records ADD COLUMN price_meso INTEGER',
      'ALTER TABLE boss_drop_records ADD COLUMN price_share INTEGER',
      'ALTER TABLE spend_records ADD COLUMN form TEXT',
      // 「아이템 구매」의 종류([[ADR-173]] 정정 1) — `form` 이 겪은 그 사정이다.
      'ALTER TABLE spend_records ADD COLUMN item_kind TEXT',
      // [[ADR-170]] 정정 9 — 수입 테이블도 수수료 칸 없이 만들어진 기기가 있다.
      'ALTER TABLE income_records ADD COLUMN sale_fee_percent INTEGER',
      'ALTER TABLE income_records ADD COLUMN sale_fee_meso INTEGER',
      // 수입에도 통화가 있다([[ADR-170]] 정정 15) — 지출과 **같은 칸 이름**이다.
      'ALTER TABLE income_records ADD COLUMN point_amount INTEGER',
      'ALTER TABLE income_records ADD COLUMN point_per_100m_meso INTEGER',
      'ALTER TABLE income_records ADD COLUMN cash_amount INTEGER',
      'ALTER TABLE income_records ADD COLUMN quantity INTEGER',
      // 사냥 계산 입력 일곱([[ADR-175]] 결정 9 + [[ADR-177]] 결정 8).
      'ALTER TABLE income_records ADD COLUMN hunt_character_level INTEGER',
      'ALTER TABLE income_records ADD COLUMN hunt_missed_mobs INTEGER',
      'ALTER TABLE income_records ADD COLUMN hunt_boosts TEXT',
      'ALTER TABLE income_records ADD COLUMN hunt_sojae INTEGER',
      'ALTER TABLE income_records ADD COLUMN hunt_fragments INTEGER',
      'ALTER TABLE income_records ADD COLUMN hunt_fragment_price INTEGER',
      'ALTER TABLE income_records ADD COLUMN hunt_meso_rate INTEGER',
      'ALTER TABLE income_records ADD COLUMN hunt_typed_meso INTEGER',
    ])
  })

  // 판별력: `query` 가 `{ rows }` 를 그대로 돌려주면 `values` 가 undefined 라 여기서도 ALTER 가 나간다.
  it('컬럼이 이미 있으면 더하지 않는다', async () => {
    mockRowsFor = (statement) =>
      statement.startsWith('PRAGMA table_info')
        ? [
            { name: 'world' },
            { name: 'defeated_on' },
            { name: 'price_state' },
            { name: 'price_meso' },
            { name: 'price_share' },
            { name: 'form' },
            { name: 'item_kind' },
            { name: 'sale_fee_percent' },
            { name: 'sale_fee_meso' },
            { name: 'point_amount' },
            { name: 'point_per_100m_meso' },
            { name: 'cash_amount' },
        { name: 'quantity' },
            { name: 'hunt_character_level' },
            { name: 'hunt_missed_mobs' },
            { name: 'hunt_boosts' },
            { name: 'hunt_sojae' },
            { name: 'hunt_fragments' },
            { name: 'hunt_fragment_price' },
            { name: 'hunt_meso_rate' },
            { name: 'hunt_typed_meso' },
          ]
        : []

    await getBossProfitDb()

    const executed = mockOpened[0].statements.map((entry) => entry.statement.trim())
    expect(executed.filter((statement) => statement.startsWith('ALTER TABLE'))).toEqual([])
    // 테이블 생성과 메이린 키 이관은 그대로 돈다(`docs/migration/data.md` «스키마 진화 코드»).
    // **개수를 박지 않는다** — db.ts 가 테이블을 더할 때마다 이 숫자가 조용히 스탈해진다([[ADR-052]]
    // 결정 2 가 목록의 단일 진실 공급원을 db.ts 로 둔 이유와 같다). [[ADR-170]] 이 둘을 더하며 겪었다.
    expect(executed.filter((statement) => statement.startsWith('CREATE TABLE'))).toHaveLength(
      BOSS_PROFIT_TABLE_NAMES.length,
    )
    /**
     * **여기도 개수를 안 박는다** — 바로 위 `CREATE TABLE` 이 겪은 그 스탈이다([[ADR-166]] 정정 4 가
     * 마이그레이션 둘을 더하며 다시 겪었다). 대신 **성질**을 본다: 데이터 이관은 전부 `WHERE` 를
     * 갖는다 — 그것이 «이미 옮겨진 뒤에는 걸리는 행이 없다»(매번 실행해도 안전한 no-op)의 근거다.
     */
    const updates = executed.filter((statement) => statement.startsWith('UPDATE'))
    expect(updates.length).toBeGreaterThan(0)
    for (const statement of updates) {
      expect(statement).toContain('WHERE')
    }
  })
})
