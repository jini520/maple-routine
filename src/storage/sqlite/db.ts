import { getSqlitePort } from '../ports'
import type { SqliteDbConnection } from '../ports'

const DB_NAME = 'boss_profit'

/**
 * `income_records` 의 **본문 한 벌**. `CREATE TABLE` 이 두 자리에서 같은 것을 쓴다. 아래 정의
 * 배열(정상 생성)과 `rebuildIncomeRecords`(재작성). 두 벌로 두면 재작성이 **옛 스키마를 다시
 * 만드는** 날이 오고, 그것이 정확히 이 파일이 겪은 결함의 모양이다.
 */
const INCOME_RECORDS_BODY = `(
    id TEXT NOT NULL,
    -- NULL = 계정 단위가 기본이다. 통화가 귀속을 강제하지 않는다.
    ocid TEXT,
    earned_on TEXT NOT NULL, -- 'YYYY-MM-DD' KST
    category TEXT NOT NULL, -- 아이템 판매 · 사냥 · 기타
    item TEXT, -- 판 것 / 사냥터 / 자유
    -- **수수료를 뗀 값**이다. 캘린더도 합계도 이 칸 하나를 더한다.
    -- **NULL 이 될 수 있다**(이슈 #265): **기타**는 통화가 갈려서 **메소로 번 것이
    -- 아니다** 가 성립한다. 0 으로 채우면 **메소를 0 벌었다** 와 같아져 수정
    -- 시트가 찬 칸으로 통화를 되짚던 자리를 잃는다(지출이 먼저 같은 자리를 지났다.
    --). 처음엔 NOT NULL 이었고(수입이 메소뿐이던 시절)
    -- 그 제약이 메포·캐시 **기타**의 저장을 통째로 막았다. 이미 만들어진 테이블은 rebuildIncomeRecords 가 옮긴다.
    meso_amount INTEGER,
    -- 경매장 수수료(3·5. 의 FeePercent). NULL = 없음(직거래이거나 정정 9 이전 행).
    sale_fee_percent INTEGER,
    -- 뗀 몫. **판매 대금 = meso_amount + sale_fee_meso** 로 정확히 되짚는다. 내림이 섞여 있어
    -- 요율만으로는 역산이 안 된다.
    sale_fee_meso INTEGER,
    -- 통화 칸 셋. **기타**는 메포·캐시로도 들어오고, **지출과 같은 이름**을
    -- 써야 집계가 한 모양으로 접힌다(incomeMesoOf = spendMesoOf). 뜻과 단위는 spend_records 의
    -- 같은 이름 칸들과 같다. 시세는 1억 메소당 메포이고, 캐시는 환산하지 않는다.
    -- 이 셋은 정정 15 가 **ensureColumn 으로만** 붙여 CREATE 문에 없었다. 그 상태로는 재작성이
    -- 만드는 테이블에 칸이 모자라 이관이 그 자리에서 던진다. DDL 이 곧 **지금의 스키마** 여야 한다.
    point_amount INTEGER,
    point_per_100m_meso INTEGER,
    cash_amount INTEGER,
    -- 몇 회인가. **기타**만 쓰고 위 세 칸에는 **곱한 총액**이 들어간다.
    -- 수량을 안 남기면 수정 시트가 되짚을 길이 없어 수량 1 · 금액 = 총액 으로 열린다.
    -- NULL = 이 칸이 없던 시절의 행이고, 그 행도 같은 이유로 수량 1 로 연다.
    quantity INTEGER,
    -- **사냥** 갈래의 **계산 입력**. 합계만 남기면 수정 시트가 빈 계산기로
    -- 열려 만지는 순간 금액이 덮인다. 사냥터는 item 칸에 이름으로 들어간다
    -- (전역 유일이라 지역이 따라온다). **다른 갈래에서는 전부 NULL** 이다.
    -- 캐릭터 레벨을 박는 이유는 캐릭터가 레벨업하기 때문이다. 지금 레벨로 다시 재면 한 달 전
    -- 기록의 금액이 열 때마다 달라진다.
    hunt_character_level INTEGER,
    hunt_missed_mobs INTEGER, -- 젠 한 번에 놓치는 마릿수(0~4). 효율 %는 맵이 정한다
    hunt_boosts TEXT, -- 켠 아이템 id 를 쉼표로. '' = 없음
    hunt_sojae INTEGER, -- 소재 수(하나가 30분)
    hunt_fragments INTEGER, -- 솔 에르다 조각 개수(사용자가 직접 넣는다. 결정 8)
    hunt_fragment_price INTEGER, -- 조각 개당 메소
    hunt_meso_rate INTEGER, -- 그때의 캐릭터 메소 획득량(%). NULL = 이전 행 → 0 으로 읽는다
    -- 수동으로 적힌 사냥에서 사용자가 친 획득 메소. NULL 이 아니면 수동으로
    -- 적힌 행이고, 그때 위 계산기 칸 넷은 전부 NULL 이다. 0 과 NULL 이 갈린다. 조각만 먹은
    -- 사냥은 친 메소가 0 이면서 수동이다.
    hunt_typed_meso INTEGER,
    memo TEXT,
    recorded_at TEXT NOT NULL,
    PRIMARY KEY (id)
  )`

// 이 DB의 테이블 정의는 여기 하나뿐이다. openBossProfitDb가 이 배열을 순회해 스키마를 만들고,
// storage/cache-data.ts가 아래 이름 배열로 캐시 삭제 범위·용량을 계산한다. 새 테이블은 여기에만
// 추가하면 세 곳에 자동 반영된다.
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
    -- 기록 시점의 월드 스냅샷. NULL이면 "월드 모름"이고 월드별 결정석 집계에서
    -- 제외된다. 월드를 파생값(캐시된 character/basic)으로 두면 월드 리프가 모든 과거 주의 귀속을
    -- 소급 이동시킨다. 분모(90 x 월드 수)까지 바뀐다.
    world TEXT,
    -- 처치 **날짜**(KST YYYY-MM-DD). period_key 는 주(목요일)·달이라 "며칟날" 을 못 든다.
    -- NULL 은 "모름" 이고 가계부의 월간 칸 집계에서 조용히 빠진다(world 와 같은 모양). 키가
    -- 아니므로 나중에 채워 넣어도 옛 행이 움직이지 않는다.
    defeated_on TEXT,
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
  // 보스별/기간별 드롭 기록. 한 보스가 여러 드롭을 가지므로 drop_index로 다중 행.
  // 금액도 여기 담는다. 기록 한 건에 붙는 실판매가다(반전). 같은 행에 두면
  // 난이도 확정 이관·prune 삭제가 가격까지 함께 옮기고 지운다.
  {
    name: 'boss_drop_records',
    createSql: `CREATE TABLE IF NOT EXISTS boss_drop_records (
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
    -- 가격. 셋 다 nullable 이고 NULL 은 '미입력'이다. 0 을 쓰면
    -- '0메소에 팔았다'가 되어 스킵·미입력과 구분이 사라진다.
    price_state TEXT,
    price_meso INTEGER,
    price_share INTEGER,
    PRIMARY KEY (ocid, boss, difficulty, period_key, drop_index)
)`,
  },
  // 가계부가 **손으로 적는** 둘. 앞의 넷과 갈리는 성질이 셋이다:
  //  ① **대리키다.** 앞의 넷은 자연키 복합 PK 인데 손입력은 **같은 날 같은 것을 두 번** 이 정상이라
  //     자연키가 성립하지 않는다.
  //  ② **날짜가 참이다.** 사용자가 직접 고르므로 `period_key`(주·월)가 아니라 날짜를 든다.
  //     그래서 캘린더 칸에 바로 설 수 있다(보스 기록은 #239 를 기다린다).
  //  ③ **API 가 없다.** 되살릴 길이 0% 라 `RECORD_TABLE_NAMES` 에 반드시 들어야 한다
  //     (`storage/cache-data.ts`. 안 넣으면 차집합 파생으로 **지워도 되는 것** 에 끌려간다).
  {
    name: 'income_records',
    createSql: `CREATE TABLE IF NOT EXISTS income_records ${INCOME_RECORDS_BODY}`,
  },
  {
    name: 'spend_records',
    createSql: `CREATE TABLE IF NOT EXISTS spend_records (
    id TEXT NOT NULL,
    ocid TEXT,
    spent_on TEXT NOT NULL, -- 'YYYY-MM-DD' KST
    -- 컨텐츠 · 이벤트·BM · 버프 · 아이템 구매 · 기타(정정 4)
    category TEXT NOT NULL,
    item TEXT,
    -- 같은 값을 두 형태로 받는 항목이 있다. 에픽던전 리워드는 **경험치** 와 **솔 에르다** 중 하나다
    -- (카탈로그의 **forms**). **가격이 같아서** 금액으로는 구분이 안 되므로 따로 적는다:
    -- 안 적으면 **솔 에르다를 몇 번 받았나** 를 나중에 되물을 수 없다. 형태가 없는 항목은 NULL.
    form TEXT,
    -- **아이템 구매**의 **종류**(장비·소비·기타). 이 값 하나가 수량과 관세를
    -- 함께 가른다: 소비·기타는 **월드 간 거래가 안 되어** 관세가 없다. NULL 은 다른 갈래이거나
    -- **정정 1 이전 행**이고, 그 행은 장비로 연다(그때가 실제로 그 모양이었다).
    item_kind TEXT,
    -- 금액 = 카탈로그의 **unitPrice** × 이 값. 단위 이름은 안 적는다.
    -- **src/data/spend-catalog.json** 이 항목별로 알고 있어 베끼면 두 벌이 어긋난다.
    quantity INTEGER,
    -- 통화별 칸 셋. 안 쓴 칸은 NULL 이다.
    -- **관세를 포함한 총액**이라 집계는 이 한 칸만 보면 된다(정정 2 ②).
    meso_amount INTEGER,
    -- 그중 관세분. **집계에 더하지 말 것**. 이미 meso_amount 안에 있다. 요율을 안 박고 읽을 때
    -- 나누면 요율이 바뀌는 날 지난달 관세가 소급해 달라진다( 과 같은 이유).
    tariff_meso INTEGER,
    point_amount INTEGER,
    -- 메소마켓 시세. 단위가 **1억 메소당 메포**다(정정 2 ④). **meso_per_point** 라는 이름이었는데
    -- **거짓이었다**: 이 값으로 하는 것은 곱셈이 아니라 **나눗셈**이다(메포 × 1억 ÷ 시세).
    -- point_amount 가 있으면 NOT NULL 이어야 하고(정정 2 ③) 0 이면 안 된다.
    point_per_100m_meso INTEGER,
    -- **환산하지 않는다**(정정 2 ①). 그래서 짝이 되는 환율 칸이 없다. 현금과 게임 재화의 교환비가
    -- 실제로 성립하는 경로가 운영정책 위반 거래라, 앱이 그 숫자를 적으면 그 경로에 값을 매기는
    -- 것처럼 읽힌다.
    cash_amount INTEGER,
    memo TEXT,
    recorded_at TEXT NOT NULL,
    PRIMARY KEY (id)
)`,
  },
] as const

export const BOSS_PROFIT_TABLE_NAMES: readonly string[] = TABLE_DEFINITIONS.map(
  (table) => table.name,
)

/**
 * 갈래 상점·편의 가 이벤트·BM 으로 이름을 바꿨다. `category` 는 이름 그 자체가 값이라 안
 * 옮기면 기존 기록이 어느 갈래에도 없는 고아가 된다. 갈래 칩에도 안 걸리고 `spendGroupsOf`
 * 도 빈손이라 목록 갈래가 직접 입력처럼 보인다.
 *
 * 이미 옮겨진 뒤에는 `WHERE` 에 걸리는 행이 없어 매번 실행해도 안전한 no-op 이다.
 */
const MIGRATE_SHOP_CATEGORY_RENAME = `
  UPDATE spend_records SET category = '이벤트·BM' WHERE category = '상점·편의'
`

/**
 * 보약 버프 둘이 **`버프` 에서 `이벤트·BM` 으로 옮겨갔다**(같은 지정). 갈래가 안 따라가면
 * `findSpendChoice(category, item)` 이 그 항목을 못 찾아 **수정 시트가 세부를 못 편다**.
 */
const MIGRATE_TONIC_BUFF_CATEGORY = `
  UPDATE spend_records SET category = '이벤트·BM'
   WHERE category = '버프' AND item IN ('보약 버프 추가 구매', '보약 버프 초기화')
`

/**
 * 농장 입장권 둘이 `… 입장권` 을 뗀 이름이 됐다.
 *
 * `item` 은 이름 그 자체가 값이라 안 옮기면 옛 기록이 카탈로그에서 사라진 이름을 들고 남는다.
 * `findSpendChoice` 가 못 찾아 수정 시트가 세부를 못 펴고, 목록에서도 지금 고를 수 있는 것과
 * 다른 글자로 적힌다.
 *
 * 이미 옮겨진 뒤에는 `WHERE` 에 걸리는 행이 없어 매번 실행해도 안전한 no-op 이다.
 */
const MIGRATE_FARM_TICKET_ITEM_RENAME = `
  UPDATE spend_records
     SET item = REPLACE(item, ' 입장권', '')
   WHERE category = '이벤트·BM'
     AND item IN ('메카베리 농장 입장권', '블루베리 농장 입장권')
`

/**
 * 퀵 패스 셋이 `… 퀵패스` 를 뗀 이름이 됐다. 묶음 이름(퀵 패스)이 그 맥락을 이미 들고 있어
 * 항목마다 되풀이할 이유가 없다.
 *
 * 옮기는 이유는 농장 둘과 같다. `item` 은 이름 자체가 값이라 안 옮기면 옛 기록이 카탈로그에서
 * 사라진 이름을 들고 남는다.
 */
const MIGRATE_QUICK_PASS_ITEM_RENAME = `
  UPDATE spend_records
     SET item = REPLACE(item, ' 퀵패스', '')
   WHERE category = '컨텐츠'
     AND item IN ('에픽던전 퀵패스', '일간 퀘스트 퀵패스', '주간 퀘스트 퀵패스')
`

/**
 * 미호로이드 교환권 이 `미호로이드` 가 됐다. 타일에서 교환 / 권 으로 끊기던 이름이고, 무엇을
 * 사는지는 그림과 묶음이 이미 말한다.
 */
const MIGRATE_MIHOROID_ITEM_RENAME = `
  UPDATE spend_records SET item = '미호로이드'
   WHERE category = '이벤트·BM' AND item = '미호로이드 교환권'
`

// 메이린 카드 표시명을 API content_name('시즌 보스 메이린')과 통일하며 boss 식별 키를
// 바꿨다(2026-07-22, weekly-bosses.json 참고). 기존에 저장된 파티 설정·수익 기록이 새 키를
// 못 찾는 고아 데이터가 되지 않도록 옛 키를 새 키로 옮긴다. 이미 옮겨진 뒤에는 WHERE절에
// 걸리는 행이 없어 매번 실행해도 안전한 no-op이다.
const MIGRATE_MEIRIN_BOSS_KEY_PARTY_SETTINGS = `
  UPDATE boss_party_settings SET boss = '시즌 보스 메이린' WHERE boss = '메이린'
`
const MIGRATE_MEIRIN_BOSS_KEY_PROFIT_RECORDS = `
  UPDATE boss_profit_records SET boss = '시즌 보스 메이린' WHERE boss = '메이린'
`

// 이미 만들어진 DB에는 CREATE TABLE IF NOT EXISTS가 컬럼을 더해주지 않는다.
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

/** 재작성이 잠깐 쓰는 이름. 트랜잭션 안에서만 존재하므로 파일에 남지 않는다. */
const INCOME_RECORDS_REBUILD_TABLE = 'income_records_rebuild'

/**
 * `income_records.meso_amount` 의 `NOT NULL` 을 뗀다.
 *
 * `ensureColumn` 은 없는 칸을 더하는 길뿐이고 SQLite 는 `ALTER TABLE` 로 기존 칸의 제약을 못
 * 고친다. 테이블을 다시 쓰는 수밖에 없다. 새 테이블 → 복사 → DROP → RENAME.
 *
 * 지키는 것 넷.
 *
 * ① 한 트랜잭션이다. 옛 테이블은 지워졌고 새 이름은 아직 없는 상태가 파일에 남으면 그 기기의
 *    수입 기록이 전부 사라진다. 되살릴 API 가 0% 인 데이터다. 던지면 되돌리고 그대로
 *    올려보낸다.
 * ② 옮길 칸은 옛 테이블이 실제로 가진 칸이다. `SELECT *` 는 못 쓴다. `ensureColumn` 이 붙인
 *    칸은 뒤에 붙어 순서가 지금 DDL 과 다르고, 위치로 짝지으면 값이 에러 없이 옆 칸으로 옮겨
 *    앉는다(수수료가 메포가 된다). 지금 스키마의 칸 목록을 박아 두는 것도 못 쓴다. 그 칸이
 *    아직 없는 기기가 실제로 있다.
 * ③ `ensureColumn` 들보다 먼저 돈다. 여기서 만드는 테이블은 지금의 DDL 전체라 칸이 이미 다
 *    있고, 뒤의 `ensureColumn` 열하나는 그대로 no-op 이 된다.
 * ④ 판정은 스키마 자신에게 묻는다(`notnull`). 이미 nullable 이면 한 문장도 안 나간다. 재작성은
 *    행을 통째로 옮기는 비싼 일이라 이 판정이 값싸야 한다.
 */
async function rebuildIncomeRecords(db: SqliteDbConnection): Promise<void> {
  const { values } = await db.query(`PRAGMA table_info(income_records)`)
  const columns = (values ?? []) as { name: string; notnull: number }[]
  const mesoAmount = columns.find((column) => column.name === 'meso_amount')
  // `Number()` 를 씌우는 이유는 어댑터마다 이 값이 숫자로 오는지 글자로 오는지 계약이 없어서다.
  // 글자 '0' 을 `=== 0` 으로 재면 **옮긴 뒤에도 아직 NOT NULL** 로 읽혀 부팅마다 다시 옮긴다.
  if (mesoAmount === undefined || Number(mesoAmount.notnull) === 0) {
    return
  }

  const carried = columns.map((column) => column.name).join(', ')

  await db.execute('BEGIN')
  try {
    await db.execute(`CREATE TABLE ${INCOME_RECORDS_REBUILD_TABLE} ${INCOME_RECORDS_BODY}`)
    await db.execute(
      `INSERT INTO ${INCOME_RECORDS_REBUILD_TABLE} (${carried}) SELECT ${carried} FROM income_records`,
    )
    await db.execute('DROP TABLE income_records')
    await db.execute(`ALTER TABLE ${INCOME_RECORDS_REBUILD_TABLE} RENAME TO income_records`)
    await db.execute('COMMIT')
  } catch (error: unknown) {
    await db.execute('ROLLBACK')
    throw error
  }
}

let dbPromise: Promise<SqliteDbConnection> | null = null

async function openBossProfitDb(): Promise<SqliteDbConnection> {
  const connection = getSqlitePort()

  if (connection.isWebPlatform()) {
    await connection.initWebStore()
  }

  // 리로드되면 이전 로드의 네이티브 SQLite 연결이 남는다. dbPromise 는 로드마다 초기화되므로
  // isConnection 이 true 라는 건 그 stale 연결이라는 뜻이다. 그대로 retrieve + open 하면 첫
  // 쿼리가 막히므로 닫고 새로 만든다.
  const alreadyConnected = await connection.isConnection(DB_NAME)
  if (alreadyConnected) {
    await connection.closeConnection(DB_NAME)
  }
  const db = await connection.createConnection(DB_NAME, 'no-encryption', 1)

  await db.open()
  for (const table of TABLE_DEFINITIONS) {
    await db.execute(table.createSql)
  }
  // **칸의 모양 은 이 길로만 바꿀 수 있어 `ensureColumn` 들보다 먼저 선다**(③).
  await rebuildIncomeRecords(db)
  await ensureColumn(db, 'boss_profit_records', 'world', 'TEXT')
  // `world` 와 같은 사정이다. 이미 보스를 기록해 둔 기기에는 CREATE 가 안 붙인다.
  await ensureColumn(db, 'boss_profit_records', 'defeated_on', 'TEXT')
  // 이미 만들어진 DB에는 위 CREATE 가 컬럼을 더해주지 않는다.
  await ensureColumn(db, 'boss_drop_records', 'price_state', 'TEXT')
  await ensureColumn(db, 'boss_drop_records', 'price_meso', 'INTEGER')
  await ensureColumn(db, 'boss_drop_records', 'price_share', 'INTEGER')
  // **테이블을 세운 커밋과 이 컬럼을 더한 커밋이 갈렸다.** `spend_records` 는 `form` 없이 만들어졌고
  // (`177c195b`) `지출 항목 고르기를 두 단계로`(`89e806fa`)가 그 컬럼을 **CREATE 문에만** 더했다.
  // 그 사이에 앱을 켠 기기는 `form` 없는 테이블을 들고 있고, INSERT 는 모든 칸을 적으므로
  // **지출이 하나도 안 적힌다**(실기 재현). 위 둘과 같은 사정이다.
  await ensureColumn(db, 'spend_records', 'form', 'TEXT')
  // 종류도 `form` 이 겪은 그 사정이다(INSERT 는 모든 칸을 적는다).
  await ensureColumn(db, 'spend_records', 'item_kind', 'TEXT')
  // `income_records` 는 수수료 칸 없이 만들어졌다. `form` 이 겪은 그 사정이다:
  // INSERT 는 모든 칸을 적으므로 칸이 없으면 **수입이 하나도 안 적힌다.**
  await ensureColumn(db, 'income_records', 'sale_fee_percent', 'INTEGER')
  await ensureColumn(db, 'income_records', 'sale_fee_meso', 'INTEGER')

  // 수입에도 통화가 있다(`기타`). **지출과 같은 칸 이름**을 쓴다:
  // 그래야 집계가 한 모양으로 접힌다(`incomeMesoOf` = `spendMesoOf`).
  await ensureColumn(db, 'income_records', 'point_amount', 'INTEGER')
  await ensureColumn(db, 'income_records', 'point_per_100m_meso', 'INTEGER')
  await ensureColumn(db, 'income_records', 'cash_amount', 'INTEGER')

  // 수입 `기타`의 수량. 위와 같은 사정이라 같은 길로 붙인다.
  await ensureColumn(db, 'income_records', 'quantity', 'INTEGER')

  // `사냥` 갈래의 계산 입력. 위 다섯과 **같은 사정**이라 같은 길로 붙인다:
  // INSERT 는 모든 칸을 적으므로 칸이 없으면 수입이 하나도 안 적힌다.
  await ensureColumn(db, 'income_records', 'hunt_character_level', 'INTEGER')
  await ensureColumn(db, 'income_records', 'hunt_missed_mobs', 'INTEGER')
  await ensureColumn(db, 'income_records', 'hunt_boosts', 'TEXT')
  await ensureColumn(db, 'income_records', 'hunt_sojae', 'INTEGER')
  await ensureColumn(db, 'income_records', 'hunt_fragments', 'INTEGER')
  await ensureColumn(db, 'income_records', 'hunt_fragment_price', 'INTEGER')
  await ensureColumn(db, 'income_records', 'hunt_meso_rate', 'INTEGER')
  // 수동으로 적힌 사냥의 친 메소이자 **수동인가** 의 판정자.
  await ensureColumn(db, 'income_records', 'hunt_typed_meso', 'INTEGER')
  await db.execute(MIGRATE_SHOP_CATEGORY_RENAME)
  await db.execute(MIGRATE_TONIC_BUFF_CATEGORY)
  await db.execute(MIGRATE_FARM_TICKET_ITEM_RENAME)
  await db.execute(MIGRATE_QUICK_PASS_ITEM_RENAME)
  await db.execute(MIGRATE_MIHOROID_ITEM_RENAME)
  await db.execute(MIGRATE_MEIRIN_BOSS_KEY_PARTY_SETTINGS)
  await db.execute(MIGRATE_MEIRIN_BOSS_KEY_PROFIT_RECORDS)

  return db
}

// 예기치 않은 리로드 뒤에는 위 stale 감지가 복구하지 못하고 첫 호출이 **에러 없이 멈추는** 경우가
// 있다. reject 경로에만 복구가 있으면(아래 catch) 그 죽은 커넥션이 dbPromise에 영구 캐시돼 앱을
// 재시작할 때까지 모든 조회가 실패한다. 보스 수익 데이터가 안 불러와지는 증상.
// 타임아웃과 경쟁시켜 "무응답"을 재시도 가능한 실패로 바꾼다. 네이티브 브릿지 큐 자체가 막힌
// 경우엔 재시도 호출도 같은 큐에 서므로 회복되지 않지만, 그 경우까지 JS에서 할 수 있는 일은 없다.
const OPEN_TIMEOUT_MS = 10_000

// 닫기에도 같은 상한을 주되 여는 쪽(10초)보다 짧다. 여는 것은 파일 생성·테이블
// 생성·마이그레이션까지 포함하지만 닫는 것은 그렇지 않아 정상이면 수 ms 다. 게다가 이 값은 곧
// OTA 적용 경로에서 사용자가 아무 반응 없는 화면을 견디는 시간의 상한이다. 적용은
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

// 앱 전체에서 커넥션을 하나만 열도록 모듈 스코프에서 캐싱한다. 동일 이름 커넥션을 중복으로 열면 에러가 난다.
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

// JS 컨텍스트를 파괴하는 리로드 직전에 호출한다. 이 커넥션이 아직 살아 있는 시점에 정상
// 종료해 두지 않으면 리로드로 dbPromise 만 초기화되고 네이티브 쪽 커넥션은 그대로 남는다.
// 그 상태에서 새 JS 컨텍스트의 openBossProfitDb 가 닫고 새로 생성 으로 복구하려 시도하지만,
// 이마저 실기기에서 실패해 첫 쿼리가 응답 없이 멈추는 사례가 있었다. 아직 멀쩡할 때 미리
// 닫아 두면 네이티브 쪽에 아무것도 안 남으므로 이 문제 자체가 생기지 않는다.
//
// 실패해도 곧 리로드될 것이므로 조용히 무시한다. openBossProfitDb 의 stale 감지 로직이
// 최후의 폴백으로 남아 있다.
export async function closeBossProfitDb(): Promise<void> {
  if (dbPromise === null) {
    return
  }
  const pending = dbPromise
  // 닫는 도중에도 dbPromise를 계속 살려둔다. 먼저 null로 비우면, 그 사이 다른 곳에서
  // getBossProfitDb()를 동시에 호출했을 때 "아직 안 닫힌" 커넥션을 못 보고 새로 openBossProfitDb를
  // 시작해버린다. 그 경쟁 상태에서 이 함수의 closeConnection과 그 호출의 createConnection이
  // 뒤엉키면 네이티브에서 "Connection boss_profit already exists"가 날 수 있다(안드로이드
  // CapacitorSQLite.createConnection이 dbDict에 이미 등록돼 있으면 던지는 에러). 닫기가 끝난
  // 뒤(성공이든 실패든)에만 dbPromise를 비워, 그 전까지는 동시 호출도 이 커넥션을 그대로 재사용하게 한다.
  try {
    // 닫기가 응답하지 않으면 이 함수는 영원히 resolve하지 않고, 호출부 둘(OTA 적용의
    // CapacitorUpdater.set·캐시 삭제의 reload)이 **그 뒤에 화면을 되살리는 일을 하므로** 그 리로드에
    // 영영 도달하지 못한다. 커버만 남는 "주황 스플래시 무한"이 그것이다. 대기 구간
    // 전체(dbPromise 대기 + closeConnection)를 한 번에 감싼다. 여는 쪽이 매달리면 닫기도 그 앞에서
    // 매달리므로 closeConnection만 감싸면 상한이 보장되지 않는다.
    // 타임아웃이 바꾸는 것은 "실패로 끝난다"가 아니라 **"끝난다"** 이다. 아래 catch가 그대로 삼킨다.
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
