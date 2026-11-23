import { getSqlitePort } from '../ports'
import type { SqliteDbConnection } from '../ports'
import { whenRecordsReleased } from '../record-hold'
import {
  BOSS_DROPS_BODY,
  BOSS_PARTIES_BODY,
  BOSS_PARTY_PERIODS_BODY,
  BOSS_PROFIT_ENTRIES_BODY,
  BOSS_SPLIT_SETTINGS_BODY,
  PERIOD_BOSS_DROPS_BODY,
  PERIOD_BOSS_DROPS_INDEX,
} from './boss-tables'
import {
  CASHBOOK_ENTRIES_BODY,
  CASHBOOK_ENTRIES_DATE_INDEX,
  CASHBOOK_ENTRY_FRAGMENT_USES_BODY,
  CASHBOOK_ENTRY_HUNT_INPUTS_BODY,
  CASHBOOK_ENTRY_TRANSFER_INPUTS_BODY,
  CASHBOOK_ENTRY_EXCHANGE_INPUTS_BODY,
  CASHBOOK_ENTRY_ITEMS_BODY,
  INVENTORY_ITEMS_BODY,
  INVENTORY_ITEMS_OWNER_INDEX,
  UNCONVERTED_CASHBOOK_ENTRIES_BODY,
  UNCONVERTED_CASHBOOK_ENTRIES_DATE_INDEX,
  UNCONVERTED_CASHBOOK_ENTRY_EXCHANGE_INPUTS_BODY,
  UNCONVERTED_CASHBOOK_ENTRY_FRAGMENT_USES_BODY,
  UNCONVERTED_CASHBOOK_ENTRY_HUNT_INPUTS_BODY,
  UNCONVERTED_CASHBOOK_ENTRY_ITEMS_BODY,
  UNCONVERTED_CASHBOOK_ENTRY_TRANSFER_INPUTS_BODY,
  UNCONVERTED_INVENTORY_ITEMS_BODY,
} from './cashbook-tables'
import {
  ENHANCEMENT_RECOMPUTES_BODY,
  ENHANCEMENT_TOTALS_BODY,
  ENHANCEMENT_TOTALS_DATE_INDEX,
  CHARACTER_DATED_NAMES_BODY,
  CHARACTER_FIRST_DAYS_BODY,
  ENHANCEMENT_REFETCHES_BODY,
  UNCONVERTED_ENHANCEMENT_TOTALS_BODY,
} from './enhancement-tables'
import {
  BOSS_TABLES_CONVERTED_AT,
  CASHBOOK_TABLES_CONVERTED_AT,
  ENHANCEMENT_TABLES_CONVERTED_AT,
  DEVICE_CONVERSION_BODY,
  DEVICE_CONVERSION_VERSION,
  deviceConversionVersionOf,
  runDeviceConversion,
} from './device-conversion'
import { GAME_DATA_META_BODY, GAME_DATA_SECTIONS_BODY } from './game-data-tables'
import { QUERY_CACHE_BODY } from './query-cache-tables'
import { INCOME_RECORDS_BODY, LEGACY_TABLE_DEFINITIONS } from './legacy-tables'
import { LEGACY_TABLES_DROPPED_AT, isMigrationCeilingSet, runVersionedMigrations, userVersionOf } from './migrations'
import { REMEMBERED_LEVELS_BODY, UNCONVERTED_REMEMBERED_LEVELS_BODY } from './remembered-level-tables'
import { SERVER_SYNC_PAUSE_BODY, ensureServerSyncTriggers } from './server-sync-triggers'
import {
  CHARACTER_ACCOUNTS_BODY,
  CHARACTER_PROFILES_BODY,
  CHARACTER_WORLD_LEAPS_BODY,
  ENHANCEMENT_HISTORY_CHECKS_BODY,
  MVP_GRADE_HISTORY_BODY,
  UNCONVERTED_CHARACTER_WORLD_LEAPS_BODY,
  UNCONVERTED_MVP_GRADE_HISTORY_BODY,
} from './record-key-tables'

const DB_NAME = 'boss_profit'

/** 1.0.15 기기 변환이 마친 단계의 번호를 적는 표. 다른 표를 어느 정의로 만들지 이 번호가 정해서 맨 먼저 만든다. */
const DEVICE_CONVERSION_TABLE = `CREATE TABLE IF NOT EXISTS device_conversion ${DEVICE_CONVERSION_BODY}`

/** 보스 기록 표 셋. 기기 변환 전 DB 는 버전 14 의 모양이고 앞 버전 이관이 그 모양을 읽는다. 부모가 먼저 서야 외래키가 선다. */
function bossTableDefinitions(converted: boolean): { name: string; createSql: string }[] {
  if (!converted) {
    return [
      { name: 'boss_parties', createSql: `CREATE TABLE IF NOT EXISTS boss_parties ${BOSS_PARTIES_BODY}` },
      { name: 'boss_party_periods', createSql: `CREATE TABLE IF NOT EXISTS boss_party_periods ${BOSS_PARTY_PERIODS_BODY}` },
      { name: 'boss_drops', createSql: `CREATE TABLE IF NOT EXISTS boss_drops ${PERIOD_BOSS_DROPS_BODY}` },
    ]
  }
  return [
    { name: 'boss_split_settings', createSql: `CREATE TABLE IF NOT EXISTS boss_split_settings ${BOSS_SPLIT_SETTINGS_BODY}` },
    { name: 'boss_profit_entries', createSql: `CREATE TABLE IF NOT EXISTS boss_profit_entries ${BOSS_PROFIT_ENTRIES_BODY}` },
    { name: 'boss_drops', createSql: `CREATE TABLE IF NOT EXISTS boss_drops ${BOSS_DROPS_BODY}` },
  ]
}

/**
 * 가계부 기록 표 여섯 · 인벤토리 · 기억한 레벨. 기기 변환 전 DB 는 버전 15 이후의 모양이고 앞 버전 이관이 그 모양을 읽는다. 표 이름은
 * 변환 뒤에도 같다. 품목이 인벤토리를 가리키므로 인벤토리가 먼저 서고, 기록이 품목 · 입력보다 먼저 서야 외래키가 선다.
 */
function cashbookTableDefinitions(converted: boolean): { name: string; createSql: string }[] {
  if (!converted) {
    return [
      { name: 'inventory_items', createSql: `CREATE TABLE IF NOT EXISTS inventory_items ${UNCONVERTED_INVENTORY_ITEMS_BODY}` },
      { name: 'cashbook_entries', createSql: `CREATE TABLE IF NOT EXISTS cashbook_entries ${UNCONVERTED_CASHBOOK_ENTRIES_BODY}` },
      {
        name: 'cashbook_entry_items',
        createSql: `CREATE TABLE IF NOT EXISTS cashbook_entry_items ${UNCONVERTED_CASHBOOK_ENTRY_ITEMS_BODY}`,
      },
      {
        name: 'cashbook_entry_hunt_inputs',
        createSql: `CREATE TABLE IF NOT EXISTS cashbook_entry_hunt_inputs ${UNCONVERTED_CASHBOOK_ENTRY_HUNT_INPUTS_BODY}`,
      },
      {
        name: 'cashbook_entry_transfer_inputs',
        createSql: `CREATE TABLE IF NOT EXISTS cashbook_entry_transfer_inputs ${UNCONVERTED_CASHBOOK_ENTRY_TRANSFER_INPUTS_BODY}`,
      },
      {
        name: 'cashbook_entry_exchange_inputs',
        createSql: `CREATE TABLE IF NOT EXISTS cashbook_entry_exchange_inputs ${UNCONVERTED_CASHBOOK_ENTRY_EXCHANGE_INPUTS_BODY}`,
      },
      {
        name: 'cashbook_entry_fragment_uses',
        createSql: `CREATE TABLE IF NOT EXISTS cashbook_entry_fragment_uses ${UNCONVERTED_CASHBOOK_ENTRY_FRAGMENT_USES_BODY}`,
      },
      {
        name: 'remembered_levels',
        createSql: `CREATE TABLE IF NOT EXISTS remembered_levels ${UNCONVERTED_REMEMBERED_LEVELS_BODY}`,
      },
    ]
  }
  return [
    { name: 'inventory_items', createSql: `CREATE TABLE IF NOT EXISTS inventory_items ${INVENTORY_ITEMS_BODY}` },
    { name: 'cashbook_entries', createSql: `CREATE TABLE IF NOT EXISTS cashbook_entries ${CASHBOOK_ENTRIES_BODY}` },
    { name: 'cashbook_entry_items', createSql: `CREATE TABLE IF NOT EXISTS cashbook_entry_items ${CASHBOOK_ENTRY_ITEMS_BODY}` },
    {
      name: 'cashbook_entry_hunt_inputs',
      createSql: `CREATE TABLE IF NOT EXISTS cashbook_entry_hunt_inputs ${CASHBOOK_ENTRY_HUNT_INPUTS_BODY}`,
    },
    {
      name: 'cashbook_entry_transfer_inputs',
      createSql: `CREATE TABLE IF NOT EXISTS cashbook_entry_transfer_inputs ${CASHBOOK_ENTRY_TRANSFER_INPUTS_BODY}`,
    },
    {
      name: 'cashbook_entry_exchange_inputs',
      createSql: `CREATE TABLE IF NOT EXISTS cashbook_entry_exchange_inputs ${CASHBOOK_ENTRY_EXCHANGE_INPUTS_BODY}`,
    },
    {
      name: 'cashbook_entry_fragment_uses',
      createSql: `CREATE TABLE IF NOT EXISTS cashbook_entry_fragment_uses ${CASHBOOK_ENTRY_FRAGMENT_USES_BODY}`,
    },
    { name: 'remembered_levels', createSql: `CREATE TABLE IF NOT EXISTS remembered_levels ${REMEMBERED_LEVELS_BODY}` },
  ]
}

/**
 * 강화 합계 · 월드 리프 · MVP 등급 이력. 기기 변환 전 DB 는 버전 16 · 18 이 다시 쓴 모양이고 앞 버전 이관이 그 모양을 읽는다. 표
 * 이름은 변환 뒤에도 같다.
 */
function enhancementTableDefinitions(converted: boolean): { name: string; createSql: string }[] {
  return [
    // 월드 리프로 갈린 옛 ocid 와 지금 ocid. 리프한 기간의 중복 기록을 지우고 옛 ocid 의 기록을 새 ocid 로 옮기는 데 쓴다.
    // 옛 ocid 는 목록에서 빠져 되살릴 길이 없어 데이터 삭제가 지우지 않는다.
    {
      name: 'character_world_leaps',
      createSql: `CREATE TABLE IF NOT EXISTS character_world_leaps ${converted ? CHARACTER_WORLD_LEAPS_BODY : UNCONVERTED_CHARACTER_WORLD_LEAPS_BODY}`,
    },
    // 강화 내역의 날짜 · 캐릭터 · 분류 · 장비별 합계. 응답 원본은 저장하지 않는다. 다시 받을 수 있는 기간이 2년이라 기록이다.
    {
      name: 'enhancement_totals',
      createSql: `CREATE TABLE IF NOT EXISTS enhancement_totals ${converted ? ENHANCEMENT_TOTALS_BODY : UNCONVERTED_ENHANCEMENT_TOTALS_BODY}`,
    },
    // 메이플 ID 의 MVP 등급 이력. 사용자가 적은 값이라 데이터 삭제가 지우지 않는다.
    {
      name: 'mvp_grade_history',
      createSql: `CREATE TABLE IF NOT EXISTS mvp_grade_history ${converted ? MVP_GRADE_HISTORY_BODY : UNCONVERTED_MVP_GRADE_HISTORY_BODY}`,
    },
  ]
}

// 지금 쓰는 테이블의 정의는 여기와 위 보스 · 가계부 · 강화 표 정의뿐이다. openBossProfitDb가 이 배열을 순회해 스키마를 만든다.
// 버전 23 이 지우는 옛 표는 `legacy-tables.ts` 에 있다.
// 데이터 삭제(storage/cache-data.ts)는 이 배열을 쓰지 않고 그룹마다 적은 표 목록으로 지운다.
// 새 테이블은 그 목록에 더해야만 지워진다.
const TABLE_DEFINITIONS = [
  // 캐릭터 이름·초상의 스냅샷. 캐릭터당 한 행이고 기록에 이름과 얼굴을 붙이는 데만 쓴다.
  // `character-basic-cache` 와 값이 같고 수명이 다르다. 그쪽은 5분 TTL 캐시다. 이름이 사라지면
  // 기록에서 행을 만드는 자리가 그 ocid 를 건너뛰어 기록이 있어도 화면에서 사라지므로, 데이터
  // 삭제가 이 표를 지우지 않는다.
  {
    name: 'character_profiles',
    createSql: `CREATE TABLE IF NOT EXISTS character_profiles ${CHARACTER_PROFILES_BODY}`,
  },
  // 다시 매기기 요청의 진행. 지워지면 끝난 요청을 처음부터 다시 받아 넥슨 · 서버 호출이 다시 몰린다. 그래서 기록이다.
  {
    name: 'enhancement_recomputes',
    createSql: `CREATE TABLE IF NOT EXISTS enhancement_recomputes ${ENHANCEMENT_RECOMPUTES_BODY}`,
  },
  // 강화 줄의 이름을 ocid 에 붙이며 받은 그날 이름. 넥슨에서 다시 받을 수 있는 값이다.
  {
    name: 'character_dated_names',
    createSql: `CREATE TABLE IF NOT EXISTS character_dated_names ${CHARACTER_DATED_NAMES_BODY}`,
  },
  // 캐릭터마다 만든 날과 처음 값이 온 날. 리프 전 기간을 가른다. 넥슨에서 다시 받을 수 있는 값이다.
  {
    name: 'character_first_days',
    createSql: `CREATE TABLE IF NOT EXISTS character_first_days ${CHARACTER_FIRST_DAYS_BODY}`,
  },
  // 다시 받아야 하는 강화 내역의 날. 지워지면 그 날의 지출이 빈 채로 남는다.
  {
    name: 'enhancement_refetches',
    createSql: `CREATE TABLE IF NOT EXISTS enhancement_refetches ${ENHANCEMENT_REFETCHES_BODY}`,
  },
  // 날짜별 조회 원장. 계정 단위라 ocid 축이 없어 하루가 3콜이다.
  //
  // 조회 원장(`schedule-probe-ledger`, preferences)과 갈리는 이유는 **창이 없기 때문**이다.
  // 그쪽은 14일 뒤 스스로 떨어지지만 이쪽은 날짜가 영구히 쌓여, preferences 에 두면 JSON 하나가
  // 무한히 자란다.
  {
    name: 'enhancement_history_checks',
    createSql: `CREATE TABLE IF NOT EXISTS enhancement_history_checks ${ENHANCEMENT_HISTORY_CHECKS_BODY}`,
  },
  // 서버로 보낼 사용 로그. 백그라운드로 갈 때와 다음 실행 때 통째로 꺼내 보낸다. 신원이 없는 기기에서 끝없이 자라지 않게
  // 줄 수에 상한이 있다(`storage/usage-events.ts`). 데이터 삭제와는 상관없다.
  {
    name: 'usage_events',
    createSql: `CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    duration_ms INTEGER,
    occurred_at TEXT NOT NULL,
    PRIMARY KEY (id)
)`,
  },
  // 서버로 올릴 기록. 기록 표의 트리거와 Preferences 기록의 저장 함수가 넣는다. 할 일만 들어서 표 자체가 목록이 된다.
  //
  // **데이터 삭제가 기록 그룹을 하나라도 고르면 비운다.** 남기면 방금 지운 기록마다 서버로 지우기 요청이 간다.
  {
    name: 'server_sync_queue',
    createSql: `CREATE TABLE IF NOT EXISTS server_sync_queue (
    id TEXT NOT NULL,
    -- 서버 표 이름을 낙타 표기로 쓴 것. uuid 만 보고는 어느 표를 열어야 하는지 모른다.
    record_type TEXT NOT NULL,
    -- 기록 id. id 가 없는 Preferences 항목은 '표 이름:유일 기준의 값' 이다. 한 기록에 줄은 하나다(같은 것을 여러 번 고쳐도).
    record_id TEXT NOT NULL UNIQUE,
    -- 응답을 받은 횟수. 5 가 되면 버린다. **네트워크가 없으면 안 오른다.**
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (id)
)`,
  },
  // 줄이 있으면 기록 표의 트리거와 Preferences 넣기가 대기 표에 넣지 않는다. 트랜잭션 안에서만 줄이 있어 평소에 비어 있다.
  {
    name: 'server_sync_pause',
    createSql: `CREATE TABLE IF NOT EXISTS server_sync_pause ${SERVER_SYNC_PAUSE_BODY}`,
  },
  // 캐릭터의 메이플 ID 소속. 스타포스 줄은 이름만 들어 옛 이름을 지우면 안 된다.
  // 옛 이름과 지운 캐릭터는 다시 받을 수 없어 데이터 삭제가 지우지 않는다.
  {
    name: 'character_accounts',
    createSql: `CREATE TABLE IF NOT EXISTS character_accounts ${CHARACTER_ACCOUNTS_BODY}`,
  },
  // 게임 데이터 사본. 데이터 삭제가 지우지 않는다. 지우면 다음에 켤 때 잠금 화면이 다시 받아야 한다.
  {
    name: 'game_data_sections',
    createSql: `CREATE TABLE IF NOT EXISTS game_data_sections ${GAME_DATA_SECTIONS_BODY}`,
  },
  {
    name: 'game_data_meta',
    createSql: `CREATE TABLE IF NOT EXISTS game_data_meta ${GAME_DATA_META_BODY}`,
  },
  // TanStack Query 캐시의 사본. 넥슨 · 서버에서 받은 값만 든다. 데이터 삭제가 지우지 않는다. 다음 조회가 덮어쓰는 값이다.
  {
    name: 'query_cache',
    createSql: `CREATE TABLE IF NOT EXISTS query_cache ${QUERY_CACHE_BODY}`,
  },
] as const

/** 기기 변환 단계 번호에 맞는 표 정의. 보스 · 가계부 · 강화 표는 변환 전과 뒤가 다르다. */
function tableDefinitionsAt(conversion: number): { name: string; createSql: string }[] {
  return [
    ...bossTableDefinitions(conversion >= BOSS_TABLES_CONVERTED_AT),
    ...cashbookTableDefinitions(conversion >= CASHBOOK_TABLES_CONVERTED_AT),
    ...enhancementTableDefinitions(conversion >= ENHANCEMENT_TABLES_CONVERTED_AT),
    ...TABLE_DEFINITIONS,
  ]
}

/**
 * DB 를 열 때 만드는 표의 이름. 기록 표는 기기 변환 전과 뒤가 다르다. 데이터 삭제는 이 목록을 쓰지 않는다.
 *
 * @param converted 기기 변환이 기록 표를 바꾼 뒤의 DB 인가
 */
export function tableNamesOf(converted: boolean): readonly string[] {
  return ['device_conversion', ...tableDefinitionsAt(converted ? DEVICE_CONVERSION_VERSION : 0).map((table) => table.name)]
}

/** 표가 하나라도 있는가. 없으면 새로 설치한 기기다. */
async function anyTableExists(db: SqliteDbConnection): Promise<boolean> {
  const { values } = await db.query(`SELECT 1 FROM sqlite_master WHERE type = 'table' LIMIT 1`)
  return (values ?? []).length > 0
}

// 이미 만들어진 DB에는 CREATE TABLE IF NOT EXISTS가 컬럼을 더해주지 않는다.
// SQLite에 ADD COLUMN IF NOT EXISTS가 없으므로 table_info로 있는지 보고 없을 때만 더한다
// (ALTER를 try/catch로 삼키면 다른 원인의 실패까지 숨는다).
async function tableExists(db: SqliteDbConnection, table: string): Promise<boolean> {
  const { values } = await db.query(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`, [table])
  return (values ?? []).length > 0
}

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

/**
 * 버전 23 전 DB 의 옛 표 여섯을 앞 버전 이관이 읽는 모양으로 맞추는 준비. 표를 만들고, 칸을 더하고, 빈 분배 칸을 채운다.
 *
 * 버전 23 이 표를 지운 뒤에도 돌면 다음 부팅에 빈 표가 다시 생기고, 없는 표에 칸을 더하려다 DB 가 열리지 않는다.
 */
async function prepareLegacyTables(db: SqliteDbConnection): Promise<void> {
  for (const table of LEGACY_TABLE_DEFINITIONS) {
    await db.execute(table.createSql)
  }
  // **칸의 모양 은 이 길로만 바꿀 수 있어 `ensureColumn` 들보다 먼저 선다**(③).
  await rebuildIncomeRecords(db)
  await ensureColumn(db, 'boss_profit_records', 'world', 'TEXT')
  // `world` 와 같은 사정이다. 이미 보스를 기록해 둔 기기에는 CREATE 가 안 붙인다.
  await ensureColumn(db, 'boss_profit_records', 'defeated_on', 'TEXT')
  // 월드도 이름 대신 월드 key 를 든다. 값은 아래 버전 이관이 채운다.
  await ensureColumn(db, 'boss_profit_records', 'world_key', 'TEXT')
  // 사용자가 직접 적은 완료를 가르는 칸. 이미 기록을 쌓아 둔 기기에는 CREATE 가 안 붙인다.
  await ensureColumn(db, 'boss_profit_records', 'source', 'TEXT')
  // 이미 만들어진 DB에는 위 CREATE 가 컬럼을 더해주지 않는다.
  await ensureColumn(db, 'boss_drop_records', 'price_state', 'TEXT')
  await ensureColumn(db, 'boss_drop_records', 'price_meso', 'INTEGER')
  await ensureColumn(db, 'boss_drop_records', 'price_share', 'INTEGER')
  // 드롭 기록도 이름 대신 아이템 key 를 든다. 값은 아래 버전 이관이 채운다.
  await ensureColumn(db, 'boss_drop_records', 'item_key', 'TEXT')
  await ensureColumn(db, 'boss_drop_records', 'box_origin_key', 'TEXT')
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
  // `사냥` 분류의 계산 입력. 위 다섯과 **같은 사정**이라 같은 길로 붙인다:
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
  // 안 쓰는 칸이지만 옛 번들의 INSERT 가 적는다. CREATE 문과 함께 남긴다.
  await ensureColumn(db, 'income_records', 'hunt_fragments_deferred', 'INTEGER')
  // 옛 계산기 행은 NULL 이고 3단계로 읽어 금액이 그대로 맞는다.
  await ensureColumn(db, 'income_records', 'hunt_union_tier', 'INTEGER')
  // 기록이 이름 대신 key 로 카탈로그와 사냥터를 가리킨다. 값은 아래 버전 이관이 채운다.
  await ensureColumn(db, 'spend_records', 'category_key', 'TEXT')
  await ensureColumn(db, 'spend_records', 'item_key', 'TEXT')
  await ensureColumn(db, 'spend_records', 'form_item_keys', 'TEXT')
  await ensureColumn(db, 'spend_records', 'item_kind_key', 'TEXT')
  // 옛 행은 NULL 이라 옮길 값이 없다.
  await ensureColumn(db, 'spend_records', 'level_from', 'INTEGER')
  await ensureColumn(db, 'spend_records', 'level_to', 'INTEGER')
  await ensureColumn(db, 'income_records', 'category_key', 'TEXT')
  await ensureColumn(db, 'income_records', 'item_key', 'TEXT')
  // 수수료가 등급을 따라가나. NULL 인 옛 행은 손으로 고른 값으로 읽는다.
  await ensureColumn(db, 'income_records', 'sale_fee_auto', 'INTEGER')
  // 아이템 판매의 종류. NULL 인 옛 행은 장비로 읽어 옮길 값이 없다.
  await ensureColumn(db, 'income_records', 'item_kind_key', 'TEXT')
  // 파티 분배 비율. NULL 이 '파티 인원으로 균등'이라 옛 행을 옮길 값이 없다.
  await ensureColumn(db, 'boss_party_settings', 'crystal_my_share', 'INTEGER')
  await ensureColumn(db, 'boss_party_settings', 'crystal_shares_total', 'INTEGER')
  await ensureColumn(db, 'boss_party_settings', 'split_fee_percent', 'INTEGER')
  // 그 건의 비율 스냅샷. 설정을 고쳐도 과거 기록이 안 움직이는 규칙을 비율도 따른다.
  await ensureColumn(db, 'boss_profit_records', 'crystal_my_share', 'INTEGER')
  await ensureColumn(db, 'boss_profit_records', 'crystal_shares_total', 'INTEGER')
  await ensureColumn(db, 'boss_profit_records', 'split_fee_percent', 'INTEGER')
  // 송금 수수료가 등급을 따라가나. NULL 인 옛 행은 손으로 고른 값으로 읽는다.
  await ensureColumn(db, 'boss_party_settings', 'split_fee_auto', 'INTEGER')
  await ensureColumn(db, 'boss_profit_records', 'split_fee_auto', 'INTEGER')
  // 드롭의 내 비율. price_share 가 비율 합이 되고 균등이면 그것이 곧 인원 수다.
  await ensureColumn(db, 'boss_drop_records', 'price_my_share', 'INTEGER')
  /*
   * 드롭을 어떻게 나눴나. 이 칸이 위 두 칸의 뜻을 정한다.
   *
   * 값이 붙기 전에는 화면이 `내 몫이 1 이면 기본` 으로 되짚었는데, 비율 1:3 과 균등 3인은 저장된
   * 두 수가 같아 비율로 적은 33.3% 가 `기본 3인` 으로 섰다.
   *
   * **쌓여 있던 행은 전부 `even` 이다**(사용자 지정 `어차피 아직 업데이트 안나갔어`). 스토어에
   * 안 나간 버전이라 지킬 기록이 없다. 비율로 적었던 행은 내 몫이 1 로 읽혀 금액이 줄어든다.
   */
  await ensureColumn(db, 'boss_drop_records', 'price_split_mode', 'TEXT')
  await db.run(`UPDATE boss_drop_records SET price_split_mode = 'even' WHERE price_split_mode IS NULL`)
  /*
   * 기본의 분배 인원. 비율 합(`price_share`)과 **칸을 가른다**.
   *
   * 한 칸을 겸하게 두었더니 비율에서 합을 3 으로 고쳐 저장한 기록이 다시 열릴 때 기본의 인원
   * 스테퍼까지 3 이 됐다(사용자 보고). 위 백필로 쌓인 행은 전부 `even` 이고 그 행의 `price_share`
   * 가 곧 인원이었으므로 그대로 옮긴다.
   */
  await ensureColumn(db, 'boss_drop_records', 'price_party_size', 'INTEGER')
  await db.run(
    `UPDATE boss_drop_records SET price_party_size = price_share
      WHERE price_party_size IS NULL AND price_split_mode = 'even'`,
  )
  // 드롭의 판매 · 분배 수수료와 자동인지. NULL 인 옛 행은 수수료 없는 옛 식 그대로 센다.
  await ensureColumn(db, 'boss_drop_records', 'sale_fee_percent', 'INTEGER')
  await ensureColumn(db, 'boss_drop_records', 'split_fee_percent', 'INTEGER')
  await ensureColumn(db, 'boss_drop_records', 'sale_fee_auto', 'INTEGER')
  await ensureColumn(db, 'boss_drop_records', 'split_fee_auto', 'INTEGER')
  // 기록 시점의 월드 스냅샷. 옛 행은 NULL 로 남는다 - 현재 캐시의 월드로 채우면 리프한 캐릭터의
  // 리프 전 드롭에 리프 후 월드가 영구히 박힌다.
  await ensureColumn(db, 'boss_drop_records', 'world', 'TEXT')
  await ensureColumn(db, 'boss_drop_records', 'world_key', 'TEXT')
  // 이 기록을 다시 가리키는 값. **칸만 여기서 더하고 값과 기본키는 버전 12 가 옮긴다** -
  // SQLite 는 ALTER TABLE 로 기본키를 못 바꿔서 표를 다시 써야 한다.
  await ensureColumn(db, 'boss_drop_records', 'drop_record_id', 'TEXT')
}

/**
 * 변환 전 가계부 표에 나중에 생긴 칸을 더한다. 버전 15 · 19 이관이 이 칸을 읽고 쓴다. 이미 가계부를 적은 기기에는 CREATE 가 안
 * 붙인다.
 */
async function ensureUnconvertedCashbookColumns(db: SqliteDbConnection): Promise<void> {
  // 헥사 강화의 조각 칸.
  await ensureColumn(db, 'cashbook_entry_items', 'fragment_count', 'INTEGER')
  await ensureColumn(db, 'cashbook_entry_items', 'untradable_fragment_count', 'INTEGER')
  await ensureColumn(db, 'cashbook_entry_items', 'fragment_price_meso', 'INTEGER')
  await ensureColumn(db, 'cashbook_entry_items', 'hexa_activation', 'INTEGER')
  await ensureColumn(db, 'cashbook_entry_items', 'hexa_use_storage', 'INTEGER')
  await ensureColumn(db, 'cashbook_entry_items', 'hexa_storage_as_spend', 'INTEGER')
  // 이 칸이 생기기 전의 메포 지출에는 버전 20 이관이 요율을 채운다.
  await ensureColumn(db, 'cashbook_entry_items', 'meso_market_fee_percent', 'INTEGER')
  // 인벤토리에서 판 판매가 가리키는 줄.
  await ensureColumn(db, 'cashbook_entry_items', 'inventory_item_id', 'TEXT REFERENCES inventory_items(id)')
  await ensureColumn(db, 'inventory_items', 'ring_level', 'INTEGER')
  await ensureColumn(db, 'cashbook_entry_items', 'ring_level', 'INTEGER')
  // 주인을 모르는 옛 기록이 어느 넥슨 계정의 것인지. 옛 행은 버전 16 이 표시한다.
  await ensureColumn(db, 'cashbook_entries', 'nexon_account_id', 'TEXT')
  // 메이플 ID 기록의 ID. 옛 행은 NULL 이고, 그 넥슨 계정의 메이플 ID 가 하나뿐이면 기기 변환이 채운다.
  await ensureColumn(db, 'cashbook_entries', 'account_id', 'TEXT')
  // 캐릭터 기록의 그때 월드. 옛 행은 버전 19 가 프로필 월드로 채운다.
  await ensureColumn(db, 'cashbook_entries', 'world_key', 'TEXT')
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
  // op-sqlite 는 외래키가 기본으로 꺼져 있다. 켜지 않으면 ON DELETE CASCADE 가 안 돌고 테스트(node:sqlite)에서만 돈다.
  // 트랜잭션 안에서는 이 문장이 안 먹으므로 여기서 켠다.
  await db.execute('PRAGMA foreign_keys = ON')
  // 표가 하나도 없으면 새로 설치한 기기다. 이관을 다 돈 뒤 기기 변환도 곧바로 돈다. 바꿀 줄이 없어 게임 데이터 없이 돈다.
  const fresh = !(await anyTableExists(db))
  // 기기 변환이 지운 표를 빈 표로 다시 만들지 않게 보스 · 가계부 · 강화 표의 정의를 마친 단계의 번호로 고른다. 데이터 삭제는 이
  // 표를 지우지 않는다. 지우면 바뀐 표를 다시 바꾸려다 던진다.
  await db.execute(DEVICE_CONVERSION_TABLE)
  const conversion = await deviceConversionVersionOf(db)
  const bossConverted = conversion >= BOSS_TABLES_CONVERTED_AT
  const cashbookConverted = conversion >= CASHBOOK_TABLES_CONVERTED_AT
  const enhancementConverted = conversion >= ENHANCEMENT_TABLES_CONVERTED_AT
  // 앞 버전 이관이 읽는 옛 표는 버전 23 전 DB 에만 만든다.
  if ((await userVersionOf(db)) < LEGACY_TABLES_DROPPED_AT) await prepareLegacyTables(db)
  for (const table of tableDefinitionsAt(conversion)) {
    await db.execute(table.createSql)
  }
  // 이미 프로필을 쌓아 둔 기기에는 CREATE 가 안 붙인다. 없으면 월드 이전 판정이 그 캐릭터를
  // 영영 못 짚는다(직업을 모르면 안 묻기로 했다).
  await ensureColumn(db, 'character_profiles', 'job_class', 'TEXT')
  // 변환 전 가계부 표의 칸. 이미 가계부를 적은 기기에는 CREATE 가 안 붙인다. 기기 변환 뒤에는 이 칸들이 없다.
  if (!cashbookConverted) await ensureUnconvertedCashbookColumns(db)
  await ensureColumn(db, 'character_profiles', 'world_key', 'TEXT')
  // 옛 강화 원본 표의 칸. 새 기기에는 이 표가 없고, 옛 기기는 합계로 옮긴 뒤 지운다. 옮기기 전의 기기만 칸을 더한다.
  if (await tableExists(db, 'enhancement_history')) {
    await ensureColumn(db, 'enhancement_history', 'target_item', 'TEXT NOT NULL DEFAULT \'\'')
    await ensureColumn(db, 'enhancement_history', 'item_level', 'INTEGER')
    // 강화 기록도 이름 대신 장비 key 를 든다. 값은 아래 버전 이관이 채운다.
    await ensureColumn(db, 'enhancement_history', 'item_key', 'TEXT')
  }
  // 스타포스 첫 성 · 끝 성과 슈페리얼 장비의 스타포스 비용. 옛 줄은 NULL · 0 이고 다시 매기기 요청이 그 날을 다시 받아 채운다. 기기
  // 변환이 만드는 표에는 처음부터 있다.
  if (!enhancementConverted) {
    await ensureColumn(db, 'enhancement_totals', 'from_star', 'INTEGER')
    await ensureColumn(db, 'enhancement_totals', 'to_star', 'INTEGER')
    await ensureColumn(db, 'enhancement_totals', 'superior_cost_meso', 'INTEGER NOT NULL DEFAULT 0')
  }
  await ensureColumn(db, 'character_accounts', 'world_key', 'TEXT')
  // 리프 자동 판정이 읽는 만든 날. 옛 행은 NULL 이고 다음 `character/basic` 이 채운다.
  await ensureColumn(db, 'character_profiles', 'created_date', 'TEXT')
  // 분배 방식 `제외` 와 한도를 넘긴 처치. 옛 행은 NULL 이라 둘 다 아니다. 기기 변환 뒤에는 이 표가 없다.
  if (!bossConverted) {
    await ensureColumn(db, 'boss_parties', 'crystal_excluded', 'INTEGER')
    await ensureColumn(db, 'boss_party_periods', 'crystal_excluded', 'INTEGER')
    await ensureColumn(db, 'boss_party_periods', 'over_crystal_limit', 'INTEGER')
  }
  // 칸이 다 선 뒤에 돈다. 값을 옮기는 이관은 버전 번호로 한 번씩만 돈다.
  await runVersionedMigrations(db)
  // 이관 상한을 건 DB 는 앞 버전 이관을 보는 테스트라 바꾸지 않는다.
  if (fresh && !isMigrationCeilingSet()) await runDeviceConversion(db, { backup: false })
  // 인덱스는 변환 뒤의 단계 번호로 고른다. 새로 설치한 DB 는 위에서 변환을 마쳤다.
  const converted = await deviceConversionVersionOf(db)
  if (converted < BOSS_TABLES_CONVERTED_AT) await db.execute(PERIOD_BOSS_DROPS_INDEX)
  if (converted < CASHBOOK_TABLES_CONVERTED_AT) {
    await db.execute(UNCONVERTED_CASHBOOK_ENTRIES_DATE_INDEX)
    await db.execute(INVENTORY_ITEMS_OWNER_INDEX)
  } else {
    await db.execute(CASHBOOK_ENTRIES_DATE_INDEX)
  }
  await db.execute(ENHANCEMENT_TOTALS_DATE_INDEX)
  // 변환 전 표는 칸이 서버와 달라 트리거를 걸지 않는다. 변환이 끝나면 변환이 건다.
  if (converted >= DEVICE_CONVERSION_VERSION) await ensureServerSyncTriggers(db)

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

/** 기록 표를 읽고 쓰는 저장소가 거치는 연결. 기기 변환이 끝날 때까지 기다린다. */
export async function getBossProfitDb(): Promise<SqliteDbConnection> {
  await whenRecordsReleased()
  return getBossProfitDbUngated()
}

/**
 * 기기 변환을 기다리지 않는 연결. 변환이 바꾸지 않는 표(게임 데이터 사본 · 조회 캐시 · 사용 로그)와 변환만 쓴다. 이 셋은
 * 잠금 화면 동안에도 쓰여서, 기다리면 잠금 화면이 풀리지 않는다.
 *
 * 앱 전체에서 커넥션을 하나만 열도록 모듈 스코프에서 캐싱한다. 동일 이름 커넥션을 중복으로 열면 에러가 난다.
 */
export function getBossProfitDbUngated(): Promise<SqliteDbConnection> {
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
    // CapacitorUpdater.set·데이터 삭제의 reload)이 **그 뒤에 화면을 되살리는 일을 하므로** 그 리로드에
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
