/**
 * 기록 표의 트리거. 기록이 바뀌면 대기 표 `server_sync_queue` 에 서버 표 이름과 기록 id 를 넣는다.
 *
 * 기록을 쓰는 곳마다 넣게 하면 한 곳을 빠뜨려도 그 기록이 조용히 올라가지 않는다. 여러 줄을 한 번에 고치는 쓰기는 바뀐 줄의 id 를
 * 돌려주지도 않는다. 기기 변환을 마친 DB 에만 건다. 변환 전 표는 칸이 서버와 다르다.
 *
 * @see docs/persistence/sqlite.md `대기 표의 트리거`
 */
import type { SqliteDbConnection } from '../ports'
import type { ServerSyncTable } from '../server-sync-queue'
import { NEW_UUID_SQL } from './uuid'

/** 트리거 이름의 앞말. 열 때 이 이름의 트리거만 견주고 지운다. */
const TRIGGER_PREFIX = 'server_sync_'

/** 줄이 있으면 넣지 않는 한 줄짜리 표. `withServerSyncPaused` 가 트랜잭션 안에서 넣고 뺀다. */
export const SERVER_SYNC_PAUSE_BODY = `(
    started_at TEXT NOT NULL
  )`

/** 분배 칸 다섯. 보스 기록 표 셋이 같은 칸을 서버로 보낸다. */
const SPLIT_COLUMNS = ['split_type', 'party_size', 'split_share_millipercent', 'split_fee_percent', 'split_fee_follows_mvp_grade']

/** 기록 표 하나의 트리거. */
interface TriggerSpec {
  table: string
  serverTable: ServerSyncTable
  /** 기록 id 가 든 칸. 가계부의 딸린 줄은 기록의 id 를 넣는다 */
  key: 'id' | 'entry_id'
  /** 서버로 가는 칸. 이 칸들의 값이 바뀐 쓰기만 넣는다 */
  columns: readonly string[]
  /** 넣는 줄의 조건. 강화 조회 기록은 굳은 날만 서버에 있다 */
  onlyWhen?: string
  /** 지우기를 넣는가. 굳은 날은 데이터 삭제로만 지운다 */
  deletes: boolean
}

const SPECS: readonly TriggerSpec[] = [
  {
    table: 'boss_split_settings',
    serverTable: 'bossSplitSettings',
    key: 'id',
    columns: ['ocid', 'boss_difficulty_id', ...SPLIT_COLUMNS],
    deletes: true,
  },
  {
    table: 'boss_profit_entries',
    serverTable: 'bossProfitEntries',
    key: 'id',
    // `over_crystal_sale_limit` 는 기기만 쓰는 칸이다.
    columns: [
      'ocid',
      'boss_difficulty_id',
      'period_code',
      'world_id',
      'crystal_price_meso',
      'crystal_received_meso',
      ...SPLIT_COLUMNS,
      'cleared_date',
      'clear_recorded_by',
    ],
    deletes: true,
  },
  {
    table: 'boss_drops',
    serverTable: 'bossDrops',
    key: 'id',
    columns: [
      'profit_entry_id',
      'item_id',
      'category',
      'price_status',
      'sale_price_meso',
      'sale_received_meso',
      'priced_at',
      'sale_fee_percent',
      'sale_fee_follows_mvp_grade',
      ...SPLIT_COLUMNS,
    ],
    deletes: true,
  },
  {
    table: 'cashbook_entries',
    serverTable: 'cashbookEntries',
    key: 'id',
    columns: ['ocid', 'account_id', 'world_id', 'category_id', 'date', 'memo', 'recorded_at'],
    deletes: true,
  },
  {
    table: 'cashbook_entry_items',
    serverTable: 'cashbookEntries',
    key: 'entry_id',
    columns: [
      'entry_id',
      'target_type',
      'target_id',
      'item_name',
      'spend_reward_type_id',
      'item_type_id',
      'quantity',
      'from_level',
      'to_level',
      'amount_meso',
      'tariff_meso',
      'sale_fee_percent',
      'sale_fee_meso',
      'sale_fee_follows_mvp_grade',
      'amount_maple_point',
      'maple_point_per_100m_meso',
      'meso_market_fee_percent',
      'amount_cash',
      'fragment_quantity',
      'untradable_fragment_quantity',
      'fragment_price_meso',
      'includes_hexa_activation',
      'uses_stored_fragments',
      'counts_stored_fragments_as_spend',
      'inventory_item_id',
    ],
    deletes: true,
  },
  {
    table: 'cashbook_entry_hunt_inputs',
    serverTable: 'cashbookEntries',
    key: 'entry_id',
    columns: [
      'entry_id',
      'character_level',
      'missed_mob_quantity',
      'uses_wealth_potion',
      'uses_union_wealth',
      'union_wealth_tier',
      'fragment_quantity',
      'fragment_price_meso',
      'meso_acquisition_percent',
      'typed_meso',
    ],
    deletes: true,
  },
  {
    table: 'cashbook_entry_transfer_inputs',
    serverTable: 'cashbookEntries',
    key: 'entry_id',
    columns: ['entry_id', 'receiver_ocid', 'transfer_meso', 'fee_percent', 'fee_follows_mvp_grade'],
    deletes: true,
  },
  {
    table: 'cashbook_entry_exchange_inputs',
    serverTable: 'cashbookEntries',
    key: 'entry_id',
    columns: [
      'entry_id',
      'sold_meso',
      'sell_maple_point_per_100m_meso',
      'bought_meso',
      'buy_maple_point_per_100m_meso',
      'meso_market_fee_percent',
    ],
    deletes: true,
  },
  {
    table: 'cashbook_entry_fragment_uses',
    serverTable: 'cashbookEntries',
    key: 'entry_id',
    columns: ['entry_id', 'fragment_source', 'ocid', 'fragment_quantity'],
    deletes: true,
  },
  {
    table: 'inventory_items',
    serverTable: 'inventoryItems',
    key: 'id',
    columns: ['account_id', 'world_id', 'item_id', 'cashbook_item_type_id', 'added_quantity'],
    deletes: true,
  },
  {
    table: 'enhancement_totals',
    serverTable: 'enhancementTotals',
    key: 'id',
    columns: [
      'ocid',
      'history_date',
      'category',
      'item_name',
      'attempt_count',
      'attempt_cost_meso',
      'destroy_defence_cost_meso',
      'world_id',
      'superior_cost_meso',
      'from_star',
      'to_star',
      'is_event_world',
    ],
    deletes: true,
  },
  {
    table: 'enhancement_history_checks',
    serverTable: 'enhancementSettledDays',
    key: 'id',
    columns: ['nexon_account_id', 'enhancement_type', 'history_date', 'settled'],
    onlyWhen: 'NEW.settled = 1',
    deletes: false,
  },
  {
    table: 'remembered_levels',
    serverTable: 'rememberedLevels',
    key: 'id',
    columns: ['ocid', 'type', 'target_id', 'level'],
    deletes: true,
  },
  {
    table: 'mvp_grade_history',
    serverTable: 'mvpGradeHistory',
    key: 'id',
    columns: ['account_id', 'from_date', 'grade_id'],
    deletes: true,
  },
  {
    table: 'character_world_leaps',
    serverTable: 'characterWorldLeaps',
    key: 'id',
    columns: ['previous_ocid', 'ocid'],
    deletes: true,
  },
]

const NOT_PAUSED = 'NOT EXISTS (SELECT 1 FROM server_sync_pause)'

/**
 * 기록 하나를 대기 표에 넣는 문장. 같은 기록의 줄이 있으면 넣지 않는다.
 *
 * 충돌로 막지 않는 이유는 바깥 문장의 `OR IGNORE` · `OR REPLACE` 가 트리거 안의 문장에도 옮겨 붙기 때문이다. `OR REPLACE` 가
 * 붙으면 대기 줄이 갈려 거절 횟수가 0 으로 돌아간다.
 */
function enqueueStatement(serverTable: ServerSyncTable, recordId: string): string {
  return (
    `INSERT INTO server_sync_queue (id, record_type, record_id, created_at) ` +
    `SELECT ${NEW_UUID_SQL}, '${serverTable}', ${recordId}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ` +
    `WHERE NOT EXISTS (SELECT 1 FROM server_sync_queue WHERE record_id = ${recordId});`
  )
}

/** 이름과 정의. `sqlite_master` 가 적어 두는 글자와 같게 첫 두 낱말 뒤를 빈칸 하나로 쓴다. */
function triggersOf(spec: TriggerSpec): { name: string; sql: string }[] {
  const name = (event: string): string => `${TRIGGER_PREFIX}${spec.table}_${event}`
  const newKey = `NEW.${spec.key}`
  const oldKey = `OLD.${spec.key}`
  const insertWhen = [NOT_PAUSED, ...(spec.onlyWhen === undefined ? [] : [spec.onlyWhen])].join(' AND ')
  const changed = spec.columns.map((column) => `OLD.${column} IS NOT NEW.${column}`).join(' OR ')
  const updateWhen = [NOT_PAUSED, ...(spec.onlyWhen === undefined ? [] : [spec.onlyWhen]), `(${changed})`].join(' AND ')
  // 딸린 줄을 다른 기록으로 옮기면 앞 기록에서도 빠진 것이라 두 기록을 다 넣는다.
  const updateBody =
    spec.key === 'entry_id'
      ? `${enqueueStatement(spec.serverTable, newKey)} ${enqueueStatement(spec.serverTable, oldKey)}`
      : enqueueStatement(spec.serverTable, newKey)
  const triggers = [
    {
      name: name('insert'),
      sql: `CREATE TRIGGER ${name('insert')} AFTER INSERT ON ${spec.table} WHEN ${insertWhen} BEGIN ${enqueueStatement(spec.serverTable, newKey)} END`,
    },
    {
      name: name('update'),
      sql: `CREATE TRIGGER ${name('update')} AFTER UPDATE OF ${spec.columns.join(', ')} ON ${spec.table} WHEN ${updateWhen} BEGIN ${updateBody} END`,
    },
  ]
  if (spec.deletes) {
    triggers.push({
      name: name('delete'),
      sql: `CREATE TRIGGER ${name('delete')} AFTER DELETE ON ${spec.table} WHEN ${NOT_PAUSED} BEGIN ${enqueueStatement(spec.serverTable, oldKey)} END`,
    })
  }
  return triggers
}

const TRIGGERS = SPECS.flatMap(triggersOf)

/**
 * 트리거를 정의대로 맞춘다. 정의가 같은 트리거는 두고, 빠지거나 바뀐 것만 다시 만들고, 이제 없는 이름은 지운다. 정의가 그대로면 한
 * 문장도 내지 않는다. 기기 변환을 마친 DB 에만 부른다.
 */
export async function ensureServerSyncTriggers(db: SqliteDbConnection): Promise<void> {
  const { values } = await db.query(`SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name GLOB '${TRIGGER_PREFIX}*'`)
  const existing = new Map((values ?? []).map((row) => [row.name as string, row.sql as string]))
  const wanted = new Set(TRIGGERS.map((trigger) => trigger.name))
  for (const name of existing.keys()) {
    if (!wanted.has(name)) await db.execute(`DROP TRIGGER ${name}`)
  }
  for (const trigger of TRIGGERS) {
    const current = existing.get(trigger.name)
    if (current === trigger.sql) continue
    if (current !== undefined) await db.execute(`DROP TRIGGER ${trigger.name}`)
    await db.execute(trigger.sql)
  }
}
