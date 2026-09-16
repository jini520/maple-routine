/**
 * 값을 옮기는 이관. `PRAGMA user_version` 에 마지막으로 돈 버전을 적고, 아직 안 돈 버전만 차례로
 * 한 번씩 돌린다.
 *
 * 부팅마다 도는 멱등 `UPDATE` 로 두지 않는 것은 차례 때문이다. 뒤 버전이 앞 버전의 결과를 읽는다
 * (버전 2 는 버전 1 이 옮긴 이름으로 key 를 찾는다). 드롭 기록은 key 를 채운 뒤에야 획득 판정을 돌린다. 그리고 key 를 못 찾아 비워 둔 행을 부팅마다 다시
 * 찾지 않는다.
 *
 * 칸을 더하는 일은 여기가 아니라 `db.ts` 의 CREATE 문과 `ensureColumn` 이다. 이 모듈은 칸이 다 선
 * 뒤에 돈다.
 */
import { difficultyKeyOfName } from '../../constants/domain/boss-difficulty'
import { findPriceEntry } from '../../lib/boss/boss-crystal-prices'
import { bossKeyOfApiName } from '../../lib/boss/bosses'
import {
  incomeCategoryKeyOfName,
  spendCategoryKeyOfName,
  spendItemKindKeyOfName,
} from '../../lib/cashbook/categories'
import { findHuntingGroundByName } from '../../lib/cashbook/hunting-grounds'
import { legacySpendKeysOf } from '../../lib/cashbook/spend-catalog'
import { dropItemKeyOfName } from '../../lib/drop/drop-items'
import { equipmentItemKeyOfApiName } from '../../lib/equipment/equipment-items'
import { worldKeyOfApiName } from '../../lib/world/worlds'
import { BOSS_DIFFICULTIES, type BossDifficulty } from '../../types/scheduler'
import type { SqliteDbConnection } from '../ports'
import { BOSS_KEYED_TABLES } from './boss-tables'

/** 이 앱의 마지막 DB 버전. 새 기기는 곧바로 이 값이 된다. */
export const DB_VERSION = 7

/**
 * 갈래와 항목 이름을 바꾸며 옛 기록을 옮기던 문장들. 버전 1 이 한 번 돌린다.
 *
 * - 갈래 `상점·편의` 가 `이벤트·BM` 이 됐다.
 * - 보약 버프 둘이 `버프` 에서 `이벤트·BM` 으로 옮겨갔다.
 * - 농장 둘이 `… 입장권`, 퀵 패스 셋이 `… 퀵패스` 를 뗀 이름이 됐고, `미호로이드 교환권` 이
 *   `미호로이드` 가 됐다.
 * - 메이린의 보스 이름이 API 표기 `시즌 보스 메이린` 이 됐다.
 *
 * 옮기지 않으면 옛 기록이 카탈로그에서 사라진 이름을 들고 남아, 버전 2 가 key 를 못 찾는다.
 */
const LEGACY_NAME_MIGRATIONS = [
  `UPDATE spend_records SET category = '이벤트·BM' WHERE category = '상점·편의'`,
  `UPDATE spend_records SET category = '이벤트·BM'
    WHERE category = '버프' AND item IN ('보약 버프 추가 구매', '보약 버프 초기화')`,
  `UPDATE spend_records SET item = REPLACE(item, ' 입장권', '')
    WHERE category = '이벤트·BM' AND item IN ('메카베리 농장 입장권', '블루베리 농장 입장권')`,
  `UPDATE spend_records SET item = REPLACE(item, ' 퀵패스', '')
    WHERE category = '컨텐츠' AND item IN ('에픽던전 퀵패스', '일간 퀘스트 퀵패스', '주간 퀘스트 퀵패스')`,
  `UPDATE spend_records SET item = '미호로이드' WHERE category = '이벤트·BM' AND item = '미호로이드 교환권'`,
  `UPDATE boss_party_settings SET boss = '시즌 보스 메이린' WHERE boss = '메이린'`,
  `UPDATE boss_profit_records SET boss = '시즌 보스 메이린' WHERE boss = '메이린'`,
] as const

type Row = Record<string, unknown>

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * 가계부 기록에 key 를 채운다. 이름으로 표를 찾고, 못 찾으면 key 를 비운 채 행을 남긴다.
 *
 * 에픽던전 리워드의 옛 모양 둘(이어 붙인 이름 · 이름과 형태를 따로 든 행)은 형태별 항목 key 로 푼다.
 */
async function fillCashbookKeys(db: SqliteDbConnection): Promise<void> {
  const spend = await db.query('SELECT id, category, item, form, item_kind FROM spend_records')
  for (const row of (spend.values ?? []) as Row[]) {
    const category = spendCategoryKeyOfName(String(row.category))
    const { itemKey, formItemKeys } =
      category === null
        ? { itemKey: null, formItemKeys: null }
        : legacySpendKeysOf(category, textOrNull(row.item), textOrNull(row.form))
    const itemKind = textOrNull(row.item_kind)
    await db.run(
      'UPDATE spend_records SET category_key = ?, item_key = ?, form_item_keys = ?, item_kind_key = ? WHERE id = ?',
      [
        category,
        itemKey,
        formItemKeys === null ? null : JSON.stringify(formItemKeys),
        itemKind === null ? null : spendItemKindKeyOfName(itemKind),
        row.id,
      ],
    )
  }

  const income = await db.query('SELECT id, category, item FROM income_records')
  for (const row of (income.values ?? []) as Row[]) {
    const category = incomeCategoryKeyOfName(String(row.category))
    const item = textOrNull(row.item)
    // 사냥 갈래의 이름만 사냥터다. 계산기 전에 친 자유 글자는 못 찾아 비워 둔다.
    const ground = category === 'hunting' && item !== null ? findHuntingGroundByName(item) : null
    await db.run('UPDATE income_records SET category_key = ?, item_key = ? WHERE id = ?', [
      category,
      ground?.ground.key ?? null,
      row.id,
    ])
  }
}

/**
 * 보스 드롭 기록에 아이템 key 와 상자 key 를 채운다. 못 찾은 이름은 key 를 비운 채 행을 남긴다.
 *
 * 이름은 NFC 로 맞춘다. 드롭 이름을 비교하던 코드가 NFC 로 비교해 왔다.
 */
async function fillDropKeys(db: SqliteDbConnection): Promise<void> {
  const { values } = await db.query(
    'SELECT ocid, boss, difficulty, period_key, drop_index, item_name, box_origin FROM boss_drop_records',
  )
  for (const row of (values ?? []) as Row[]) {
    const boxOrigin = textOrNull(row.box_origin)
    await db.run(
      `UPDATE boss_drop_records SET item_key = ?, box_origin_key = ?
        WHERE ocid = ? AND boss = ? AND difficulty = ? AND period_key = ? AND drop_index = ?`,
      [
        dropItemKeyOfName(String(row.item_name)),
        boxOrigin === null ? null : dropItemKeyOfName(boxOrigin),
        row.ocid,
        row.boss,
        row.difficulty,
        row.period_key,
        row.drop_index,
      ],
    )
  }
}

/** 한글 난이도(옛 행)나 난이도 key(새 표)에서 key. 둘 다 아니면 `null` 이다. */
function difficultyKeyOf(value: string): BossDifficulty | null {
  if ((BOSS_DIFFICULTIES as readonly string[]).includes(value)) return value as BossDifficulty
  return difficultyKeyOfName(value)
}

/**
 * 보스 기록 표 셋의 기본키를 보스 key 로 다시 만든다. 새 표 → 행 옮기기 → DROP → RENAME.
 *
 * 옮길 때 `boss`(이름)로 보스 key 를 찾고 한글 난이도를 key 로 바꾼다. 이름은 API 이름과 같은 규칙(NFC ·
 * 공백 제거)으로 맞춘다. 옛 행에는 데이터 표기(`검은마법사`)와 API 원문(`검은 마법사`)이 섞여 있다.
 *
 * **보스를 못 찾는 행은 옮기지 않는다.** 기본키를 못 채우고, 표에 없는 보스는 기록하지 않는다는 결정과 같다.
 * 가격을 모르는 보스는 자동 기록이 건너뛰었고 드롭 표에 없는 보스는 드롭 후보가 없어, 남는 것은 그런 보스에
 * 적은 파티 설정 정도다.
 *
 * 새 설치는 CREATE 가 이미 새 모양으로 만들어 행이 없다. 같은 길을 타도 옮길 것이 없어 결과가 같다.
 */
async function rekeyBossTables(db: SqliteDbConnection): Promise<void> {
  for (const table of BOSS_KEYED_TABLES) {
    const rebuild = `${table.name}_rebuild`
    const { values: rows } = await db.query(`SELECT * FROM ${table.name}`)
    await db.execute(`CREATE TABLE ${rebuild} ${table.body}`)
    // 옮길 칸은 새 표가 가진 칸이다. 옛 표에 없는 칸(`boss_key`)은 여기서 채운다.
    const { values: columnRows } = await db.query(`PRAGMA table_info(${rebuild})`)
    const columns = ((columnRows ?? []) as Row[]).map((column) => String(column.name))
    // 이름 이관(버전 1)을 거쳤어도 두 이름이 한 key 로 모일 수 있다. 부딪히면 먼저 옮긴 행을 남기고 이관이
    // 던지지 않게 한다. 던지면 부팅마다 DB 열기가 실패한다.
    const insert = `INSERT OR IGNORE INTO ${rebuild} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
    for (const row of (rows ?? []) as Row[]) {
      const bossKey = textOrNull(row.boss_key) ?? bossKeyOfApiName(String(row.boss))
      const difficulty = difficultyKeyOf(String(row.difficulty))
      if (bossKey === null || difficulty === null) continue
      await db.run(
        insert,
        columns.map((column) =>
          column === 'boss_key' ? bossKey : column === 'difficulty' ? difficulty : (row[column] ?? null),
        ),
      )
    }
    await db.execute(`DROP TABLE ${table.name}`)
    await db.execute(`ALTER TABLE ${rebuild} RENAME TO ${table.name}`)
  }
}

/**
 * 강화 기록에 장비 key 를 채운다. API 이름(`target_item`)으로 장비 표를 찾는다.
 *
 * **못 찾는 행은 key 만 비우고 남긴다.** 표에 없는 장비에 쓴 큐브 · 잠재도 실제 지출이라서다.
 */
async function fillEnhancementItemKeys(db: SqliteDbConnection): Promise<void> {
  const { values } = await db.query('SELECT DISTINCT target_item FROM enhancement_history')
  for (const row of (values ?? []) as Row[]) {
    const targetItem = String(row.target_item)
    const itemKey = equipmentItemKeyOfApiName(targetItem)
    if (itemKey === null) continue
    await db.run('UPDATE enhancement_history SET item_key = ? WHERE target_item = ?', [itemKey, targetItem])
  }
}

/** 수익 기록과 캐릭터 프로필에 월드 key 를 채운다. 월드 이름(`world`)으로 월드 표를 찾는다. */
async function fillWorldKeys(db: SqliteDbConnection): Promise<void> {
  for (const table of ['boss_profit_records', 'character_profiles']) {
    const { values } = await db.query(`SELECT DISTINCT world FROM ${table} WHERE world IS NOT NULL`)
    for (const row of (values ?? []) as Row[]) {
      const world = String(row.world)
      const worldKey = worldKeyOfApiName(world)
      if (worldKey === null) continue
      await db.run(`UPDATE ${table} SET world_key = ? WHERE world = ?`, [worldKey, world])
    }
  }
}

/**
 * 09-17 패치 값으로 굳은 그 주의 기록을 옛 가격으로 되돌린다. 버전 7 이 한 번 돌린다.
 *
 * 패치는 09-17 오전 10시에 적용되는데 주간 리셋은 그 날 00:00 이다. 그 열 시간에 잡은 보스는 옛
 * 가격 결정석을 주는데, 시각을 안 보던 판정이 새 가격으로 굳혔다. 동기화는 이미 적힌 행을 다시
 * 쓰지 않으므로(`alreadyRecorded`) 판정을 고치는 것만으로는 이 값이 안 움직인다.
 */
const PATCH_0917_INSTANT_UTC = '2026-09-17T01:00:00.000Z'
/** 그 주가 열린 뒤 패치 전인 아무 때. 가격표에서 옛 줄을 고르게 한다. */
const BEFORE_PATCH_0917 = new Date('2026-09-17T00:30:00+09:00')

async function rewind0917PrePatchPrices(db: SqliteDbConnection): Promise<void> {
  const WHERE_PRE_PATCH = `cycle = 'weekly' AND period_key = '2026-09-17' AND recorded_at < ?`
  const { values } = await db.query(
    `SELECT DISTINCT boss_key, difficulty, party_size FROM boss_profit_records WHERE ${WHERE_PRE_PATCH}`,
    [PATCH_0917_INSTANT_UTC],
  )
  for (const row of (values ?? []) as Row[]) {
    const bossKey = textOrNull(row.boss_key)
    if (bossKey === null) continue
    const difficulty = String(row.difficulty)
    const price = findPriceEntry(bossKey, difficulty as BossDifficulty, '2026-09-17', BEFORE_PATCH_0917)?.priceMeso
    if (price === null || price === undefined) continue
    const partySize = Number(row.party_size)
    const divisor = Number.isFinite(partySize) && partySize > 0 ? partySize : 1
    await db.run(
      `UPDATE boss_profit_records SET price_meso = ?, payout_meso = ?
        WHERE ${WHERE_PRE_PATCH} AND boss_key = ? AND difficulty = ? AND party_size = ?`,
      [price, Math.floor(price / divisor), PATCH_0917_INSTANT_UTC, bossKey, difficulty, partySize],
    )
  }
}

const STEPS: ReadonlyArray<(db: SqliteDbConnection) => Promise<void>> = [
  async (db) => {
    for (const statement of LEGACY_NAME_MIGRATIONS) await db.execute(statement)
  },
  fillCashbookKeys,
  fillDropKeys,
  rekeyBossTables,
  fillEnhancementItemKeys,
  fillWorldKeys,
  rewind0917PrePatchPrices,
]

async function userVersionOf(db: SqliteDbConnection): Promise<number> {
  const { values } = await db.query('PRAGMA user_version')
  const version = Number((values?.[0] as Row | undefined)?.user_version)
  return Number.isInteger(version) ? version : 0
}

/**
 * 아직 안 돈 버전을 차례로 돌린다. 버전 하나가 한 트랜잭션이라, 중간에 던지면 그 버전의 변경과 버전
 * 번호가 함께 되돌아가 다음 부팅에 다시 돈다.
 */
export async function runVersionedMigrations(db: SqliteDbConnection): Promise<void> {
  const current = await userVersionOf(db)
  for (let version = current + 1; version <= DB_VERSION; version += 1) {
    await db.execute('BEGIN')
    try {
      await STEPS[version - 1]!(db)
      await db.execute(`PRAGMA user_version = ${version}`)
      await db.execute('COMMIT')
    } catch (error: unknown) {
      await db.execute('ROLLBACK')
      throw error
    }
  }
}
