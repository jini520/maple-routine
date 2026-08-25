import { getSqlitePort } from '../ports'
import type { SqliteDbConnection } from '../ports'

const DB_NAME = 'boss_profit'

// 이 DB의 테이블 정의는 여기 하나뿐이다 — openBossProfitDb가 이 배열을 순회해 스키마를 만들고,
// storage/cache-data.ts가 아래 이름 배열로 캐시 삭제 범위·용량을 계산한다. 새 테이블은 여기에만
// 추가하면 세 곳에 자동 반영된다(ADR-052 결정 2).
const TABLE_DEFINITIONS = [
  {
    name: 'boss_profit_records',
    createSql: `
  CREATE TABLE IF NOT EXISTS boss_profit_records (
    ocid TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    cycle TEXT NOT NULL,
    period_key TEXT NOT NULL,
    party_size INTEGER NOT NULL,
    price_meso INTEGER NOT NULL,
    payout_meso INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    -- 기록 시점의 월드 스냅샷(ADR-069 결정 1). NULL이면 "월드 모름"이고 월드별 결정석 집계에서
    -- 제외된다. 월드를 파생값(캐시된 character/basic)으로 두면 월드 리프가 모든 과거 주의 귀속을
    -- 소급 이동시킨다 — 분모(90 x 월드 수)까지 바뀐다.
    world TEXT,
    PRIMARY KEY (ocid, boss, difficulty, period_key)
  )
`,
  },
  {
    name: 'boss_party_settings',
    createSql: `
  CREATE TABLE IF NOT EXISTS boss_party_settings (
    ocid TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    party_size INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (ocid, boss, difficulty)
  )
`,
  },
  {
    name: 'boss_profit_period_checks',
    createSql: `
  CREATE TABLE IF NOT EXISTS boss_profit_period_checks (
    ocid TEXT NOT NULL,
    cycle TEXT NOT NULL,
    period_key TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    PRIMARY KEY (ocid, cycle, period_key)
  )
`,
  },
  // 보스별/기간별 드롭 기록(ADR-038). 한 보스가 여러 드롭을 가지므로 drop_index로 다중 행.
  // 금액도 여기 담는다 — 기록 한 건에 붙는 실판매가다([[ADR-124]], ADR-038 반전). 같은 행에 두면
  // 난이도 확정 이관·prune 삭제가 가격까지 함께 옮기고 지운다.
  {
    name: 'boss_drop_records',
    createSql: `
  CREATE TABLE IF NOT EXISTS boss_drop_records (
    ocid TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    period_key TEXT NOT NULL,
    drop_index INTEGER NOT NULL,
    category TEXT NOT NULL,
    item_name TEXT NOT NULL,
    slot TEXT,
    box_origin TEXT,
    ring_level INTEGER,
    quantity INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    -- 가격([[ADR-124]] 결정 4). 셋 다 nullable 이고 NULL 은 '미입력'이다 — 0 을 쓰면
    -- '0메소에 팔았다'가 되어 스킵·미입력과 구분이 사라진다.
    price_state TEXT,
    price_meso INTEGER,
    price_share INTEGER,
    PRIMARY KEY (ocid, boss, difficulty, period_key, drop_index)
  )
`,
  },
  // 가계부가 **손으로 적는** 둘([[ADR-170]] · [[ADR-166]]). 앞의 넷과 갈리는 성질이 셋이다:
  //  ① **대리키다.** 앞의 넷은 자연키 복합 PK 인데 손입력은 «같은 날 같은 것을 두 번» 이 정상이라
  //     자연키가 성립하지 않는다.
  //  ② **날짜가 참이다.** 사용자가 직접 고르므로 `period_key`(주·월)가 아니라 날짜를 든다 —
  //     그래서 캘린더 칸에 바로 설 수 있다(보스 기록은 #239 를 기다린다).
  //  ③ **API 가 없다.** 되살릴 길이 0% 라 `RECORD_TABLE_NAMES` 에 반드시 들어야 한다
  //     (`storage/cache-data.ts` — 안 넣으면 차집합 파생으로 «지워도 되는 것» 에 끌려간다).
  {
    name: 'income_records',
    createSql: `
  CREATE TABLE IF NOT EXISTS income_records (
    id TEXT NOT NULL,
    -- NULL = 계정 단위가 기본이다([[ADR-166]] 결정 3). 통화가 귀속을 강제하지 않는다.
    ocid TEXT,
    earned_on TEXT NOT NULL,      -- 'YYYY-MM-DD' KST
    category TEXT NOT NULL,       -- 아이템 판매 · 사냥 · 기타([[ADR-170]] 결정 1)
    item TEXT,                    -- 판 것 / 사냥터 / 자유
    -- 수입은 **메소뿐**이다([[ADR-170]] 결정 1) — 통화 칸 셋도 시세도 없다.
    meso_amount INTEGER NOT NULL,
    memo TEXT,
    recorded_at TEXT NOT NULL,
    PRIMARY KEY (id)
  )
`,
  },
  {
    name: 'spend_records',
    createSql: `
  CREATE TABLE IF NOT EXISTS spend_records (
    id TEXT NOT NULL,
    ocid TEXT,
    spent_on TEXT NOT NULL,       -- 'YYYY-MM-DD' KST([[ADR-166]] 결정 4)
    -- 컨텐츠 · 상점·편의 · 버프 · 아이템 구매 · 기타([[ADR-166]] 정정 1 ②)
    category TEXT NOT NULL,
    item TEXT,
    -- 같은 값을 두 형태로 받는 항목이 있다 — 에픽던전 리워드는 «경험치» 와 «솔 에르다» 중 하나다
    -- (카탈로그의 «forms»). **가격이 같아서** 금액으로는 구분이 안 되므로 따로 적는다:
    -- 안 적으면 «솔 에르다를 몇 번 받았나» 를 나중에 되물을 수 없다. 형태가 없는 항목은 NULL.
    form TEXT,
    -- 금액 = 카탈로그의 «unitPrice» × 이 값([[ADR-166]] 정정 1 ③). 단위 이름은 안 적는다 —
    -- «src/data/spend-catalog.json» 이 항목별로 알고 있어 베끼면 두 벌이 어긋난다.
    quantity INTEGER,
    -- 통화별 칸 셋. 안 쓴 칸은 NULL 이다([[ADR-166]] 결정 2).
    -- **관세를 포함한 총액**이라 집계는 이 한 칸만 보면 된다(정정 2 ②).
    meso_amount INTEGER,
    -- 그중 관세분. **집계에 더하지 말 것** — 이미 meso_amount 안에 있다. 요율을 안 박고 읽을 때
    -- 나누면 요율이 바뀌는 날 지난달 관세가 소급해 달라진다([[ADR-069]] 결정 1 과 같은 이유).
    tariff_meso INTEGER,
    point_amount INTEGER,
    -- 메소마켓 시세 — 단위가 **1억 메소당 메포**다(정정 2 ④). «meso_per_point» 라는 이름이었는데
    -- **거짓이었다**: 이 값으로 하는 것은 곱셈이 아니라 **나눗셈**이다(메포 × 1억 ÷ 시세).
    -- point_amount 가 있으면 NOT NULL 이어야 하고(정정 2 ③) 0 이면 안 된다.
    point_per_100m_meso INTEGER,
    -- **환산하지 않는다**(정정 2 ①) — 그래서 짝이 되는 환율 칸이 없다. 현금과 게임 재화의 교환비가
    -- 실제로 성립하는 경로가 운영정책 위반 거래라, 앱이 그 숫자를 적으면 그 경로에 값을 매기는
    -- 것처럼 읽힌다.
    cash_amount INTEGER,
    memo TEXT,
    recorded_at TEXT NOT NULL,
    PRIMARY KEY (id)
  )
`,
  },
] as const

export const BOSS_PROFIT_TABLE_NAMES: readonly string[] = TABLE_DEFINITIONS.map(
  (table) => table.name,
)

// 메이린 카드 표시명을 API content_name('시즌 보스 메이린')과 통일하며 boss 식별 키를
// 바꿨다(2026-07-22, weekly-bosses.json 참고) — 기존에 저장된 파티 설정·수익 기록이 새 키를
// 못 찾는 고아 데이터가 되지 않도록 옛 키를 새 키로 옮긴다. 이미 옮겨진 뒤에는 WHERE절에
// 걸리는 행이 없어 매번 실행해도 안전한 no-op이다.
const MIGRATE_MEIRIN_BOSS_KEY_PARTY_SETTINGS = `
  UPDATE boss_party_settings SET boss = '시즌 보스 메이린' WHERE boss = '메이린'
`
const MIGRATE_MEIRIN_BOSS_KEY_PROFIT_RECORDS = `
  UPDATE boss_profit_records SET boss = '시즌 보스 메이린' WHERE boss = '메이린'
`

// ADR-069 결정 1: 이미 만들어진 DB에는 CREATE TABLE IF NOT EXISTS가 컬럼을 더해주지 않는다.
// SQLite에 ADD COLUMN IF NOT EXISTS가 없으므로 table_info로 있는지 보고 없을 때만 더한다
// (ALTER를 try/catch로 삼키면 다른 원인의 실패까지 숨는다).
async function ensureColumn(
  db: SqliteDbConnection,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const { values } = await db.query(`PRAGMA table_info(${table})`)
  const exists = (values ?? []).some((row) => (row as { name?: string }).name === column)
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

let dbPromise: Promise<SqliteDbConnection> | null = null

async function openBossProfitDb(): Promise<SqliteDbConnection> {
  const connection = getSqlitePort()

  if (connection.isWebPlatform()) {
    await connection.initWebStore()
  }

  // 웹뷰가 리로드되면(OTA 적용: applyDownloadedLiveUpdate → CapacitorUpdater.set이 JS 컨텍스트를
  // 파괴하고 재로드, ADR-027) 이전 로드의 네이티브 SQLite 연결이 남는다. dbPromise는 로드마다
  // 초기화되므로 isConnection이 true라는 건 그 stale 연결이라는 뜻 — 그대로 retrieve+open하면 첫
  // 쿼리가 막히므로, 닫고 새로 만든다.
  const alreadyConnected = await connection.isConnection(DB_NAME)
  if (alreadyConnected) {
    await connection.closeConnection(DB_NAME)
  }
  const db = await connection.createConnection(DB_NAME, 'no-encryption', 1)

  await db.open()
  for (const table of TABLE_DEFINITIONS) {
    await db.execute(table.createSql)
  }
  await ensureColumn(db, 'boss_profit_records', 'world', 'TEXT')
  // 이미 만들어진 DB에는 위 CREATE 가 컬럼을 더해주지 않는다([[ADR-069]] 결정 1과 같은 사정).
  await ensureColumn(db, 'boss_drop_records', 'price_state', 'TEXT')
  await ensureColumn(db, 'boss_drop_records', 'price_meso', 'INTEGER')
  await ensureColumn(db, 'boss_drop_records', 'price_share', 'INTEGER')
  await db.execute(MIGRATE_MEIRIN_BOSS_KEY_PARTY_SETTINGS)
  await db.execute(MIGRATE_MEIRIN_BOSS_KEY_PROFIT_RECORDS)

  return db
}

// 예기치 않은 리로드(탭 링크 기본 동작 누출, WebKit 콘텐츠 프로세스 사망 시 Capacitor iOS의 자동
// webView.reload()) 뒤에는 위 stale 감지가 복구하지 못하고 첫 호출이 **에러 없이 멈추는** 경우가
// 있다. reject 경로에만 복구가 있으면(아래 catch) 그 죽은 커넥션이 dbPromise에 영구 캐시돼 앱을
// 재시작할 때까지 모든 조회가 실패한다 — 보스 수익 데이터가 안 불러와지는 증상([[ADR-050]] 결정 2).
// 타임아웃과 경쟁시켜 "무응답"을 재시도 가능한 실패로 바꾼다. 네이티브 브릿지 큐 자체가 막힌
// 경우엔 재시도 호출도 같은 큐에 서므로 회복되지 않지만, 그 경우까지 JS에서 할 수 있는 일은 없다.
const OPEN_TIMEOUT_MS = 10_000

// 닫기에도 같은 상한을 주되 여는 쪽(10초)보다 짧다(ADR-117 결정 5). 여는 것은 파일 생성·테이블
// 생성·마이그레이션까지 포함하지만 닫는 것은 그렇지 않아 정상이면 수 ms 다. 게다가 이 값은 곧
// OTA 적용 경로에서 사용자가 아무 반응 없는 화면을 견디는 시간의 상한이다 — 적용은
// closeBossProfitDb → 커버 → set() 순으로 돌고, 그 첫 구간의 길이가 정확히 이 값이다.
const CLOSE_TIMEOUT_MS = 5_000

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(message))
      }, ms)
    }),
  ]).finally(() => {
    clearTimeout(timer)
  })
}

function withOpenTimeout(promise: Promise<SqliteDbConnection>): Promise<SqliteDbConnection> {
  return withTimeout(promise, OPEN_TIMEOUT_MS, 'SQLite 커넥션 열기 시간 초과')
}

// 앱 전체에서 커넥션을 하나만 열도록 모듈 스코프에서 캐싱한다 — 동일 이름 커넥션을 중복으로 열면 에러가 난다.
export function getBossProfitDb(): Promise<SqliteDbConnection> {
  if (dbPromise === null) {
    dbPromise = withOpenTimeout(openBossProfitDb()).catch((error: unknown) => {
      // 실패한 시도를 캐시하면 이후 모든 SQLite 접근이 재시도 없이 같은 실패를 영구히 돌려받는다
      // (보스 수익·파티 설정·디버그 초기화 전부). 다음 호출이 처음부터 다시 열도록 캐시를 비운다.
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}

// OTA 적용(CapacitorUpdater.set)처럼 JS 컨텍스트를 파괴하는 리로드 직전에 호출한다. 이 커넥션이
// 아직 살아있는(멀쩡한) 시점에 정상 종료해두지 않으면, 리로드로 dbPromise만 초기화되고 네이티브
// 쪽 커넥션은 그대로 남는다 — 그 상태에서 새 JS 컨텍스트의 openBossProfitDb가 이 stale 커넥션을
// "닫고 새로 생성"으로 복구하려 시도하지만, 이마저 실기기에서 실패해 첫 쿼리가 응답 없이 멈추는
// 사례가 있었다(앱 업데이트 직후 과거 수익 데이터가 안 불러와지는 증상으로 사용자 보고, 2026-07-17).
// 아직 멀쩡할 때 미리 닫아두면 네이티브 쪽에 아무 것도 안 남으므로 이 문제 자체가 생기지 않는다.
// 실패해도(네트워크·타임아웃 등) 곧 리로드될 것이므로 조용히 무시한다 — openBossProfitDb의 기존
// stale 감지 로직이 최후의 폴백으로 남아있다.
export async function closeBossProfitDb(): Promise<void> {
  if (dbPromise === null) {
    return
  }
  const pending = dbPromise
  // 닫는 도중에도 dbPromise를 계속 살려둔다 — 먼저 null로 비우면, 그 사이 다른 곳에서
  // getBossProfitDb()를 동시에 호출했을 때 "아직 안 닫힌" 커넥션을 못 보고 새로 openBossProfitDb를
  // 시작해버린다. 그 경쟁 상태에서 이 함수의 closeConnection과 그 호출의 createConnection이
  // 뒤엉키면 네이티브에서 "Connection boss_profit already exists"가 날 수 있다(안드로이드
  // CapacitorSQLite.createConnection이 dbDict에 이미 등록돼 있으면 던지는 에러). 닫기가 끝난
  // 뒤(성공이든 실패든)에만 dbPromise를 비워, 그 전까지는 동시 호출도 이 커넥션을 그대로 재사용하게 한다.
  try {
    // 닫기가 응답하지 않으면 이 함수는 영원히 resolve하지 않고, 호출부 둘(OTA 적용의
    // CapacitorUpdater.set·캐시 삭제의 reload)이 **그 뒤에 화면을 되살리는 일을 하므로** 그 리로드에
    // 영영 도달하지 못한다 — 커버만 남는 "주황 스플래시 무한"이 그것이다(ADR-117 결정 5). 대기 구간
    // 전체(dbPromise 대기 + closeConnection)를 한 번에 감싼다 — 여는 쪽이 매달리면 닫기도 그 앞에서
    // 매달리므로 closeConnection만 감싸면 상한이 보장되지 않는다.
    // 타임아웃이 바꾸는 것은 "실패로 끝난다"가 아니라 **"끝난다"** 이다 — 아래 catch가 그대로 삼킨다.
    await withTimeout(
      (async () => {
        await pending
        await getSqlitePort().closeConnection(DB_NAME)
      })(),
      CLOSE_TIMEOUT_MS,
      'SQLite 커넥션 닫기 시간 초과',
    )
  } catch {
    // best-effort
  } finally {
    dbPromise = null
  }
}
