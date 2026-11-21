/**
 * 1.0.15 기기 변환의 보스 기록 단계. 버전 14 가 만든 표 셋(`boss_parties` · `boss_party_periods` · `boss_drops`)을 서버 표와 같은
 * 모양의 표 셋(`boss_split_settings` · `boss_profit_entries` · `boss_drops`)으로 옮긴다.
 *
 * 보스 · 난이도 · 아이템 · 월드를 새 게임 데이터의 줄 id 로 찾으므로 게임 데이터가 준비된 뒤에 돈다. 찾지 못한 보스 · 아이템의
 * 기록은 지우고 월드는 비운다. 줄이 없는 새 DB 에서는 찾을 것이 없어 게임 데이터 없이 돈다.
 */
import { bossDifficultyIdOf } from '../../lib/boss/bosses'
import { periodStartDateKey } from '../../lib/boss/boss-profit-period'
import { dropItemIdOf, onlyBoxOriginOf } from '../../lib/boss/drop-item-ids'
import { crystalPayoutMeso, SHARE_PERCENT_TOTAL } from '../../lib/boss/party-shares'
import { periodCodeOf } from '../../lib/boss/period-code'
import { dropPayoutMeso } from '../../lib/drop/drop-price'
import { findItem, ringLevelItemOf } from '../../lib/item-catalog'
import { autoFeePercent, type FeeRateContext } from '../../lib/mvp/fees'
import type { MvpGradeKey } from '../../lib/mvp/grades'
import type { MvpGradeEntry } from '../../lib/mvp/history'
import { findWorld } from '../../lib/world/worlds'
import type { SqliteDbConnection } from '../ports'
import { BOSS_DROPS_BODY, BOSS_PROFIT_ENTRIES_BODY, BOSS_SPLIT_SETTINGS_BODY } from './boss-tables'

type Row = Record<string, unknown>

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const integer = (value: unknown): number | null => (typeof value === 'number' ? value : null)

interface Split {
  type: 'even' | 'ratio' | 'excluded'
  partySize: number | null
  share: number | null
}

/**
 * 옛 분배 칸의 새 분배. `제외` 는 숨겨 둔 분배를 버리고, 비율은 `내 비율 ÷ 비율 합` 을 % 의 1000 배로 반올림한다. 균등은 내
 * 비율을 버린다. 받은 메소는 저장된 값이 지킨다.
 */
function splitOf(row: Row): Split | null {
  if (Number(row.crystal_excluded) === 1) return { type: 'excluded', partySize: null, share: null }
  if (row.split_mode === 'ratio') {
    const share = Math.round(((integer(row.my_share) ?? 0) * SHARE_PERCENT_TOTAL) / Math.max(1, integer(row.shares_total) ?? 1))
    return { type: 'ratio', partySize: integer(row.party_size) ?? 2, share: Math.min(SHARE_PERCENT_TOTAL, Math.max(0, share)) }
  }
  if (row.split_mode === 'even') return { type: 'even', partySize: integer(row.party_size) ?? 1, share: null }
  return null
}

/** 수수료가 등급을 따르는지. 요율이 빈 옛 줄은 손으로 고른 적이 없어 따르는 것으로 본다. */
function followsOf(row: Row): boolean {
  return Number(row.split_fee_auto) === 1 || integer(row.split_fee_percent) === null
}

/** 그 날의 등급 요율을 구할 재료. 등급 이력과 캐릭터의 메이플 ID 소속이다. */
async function feeContextOf(db: SqliteDbConnection): Promise<FeeRateContext> {
  const histories = new Map<string, MvpGradeEntry[]>()
  const { values: grades } = await db.query(
    'SELECT account_id, from_date, grade FROM mvp_grade_history WHERE grade IS NOT NULL ORDER BY from_date',
  )
  for (const row of grades ?? []) {
    const entries = histories.get(row.account_id as string) ?? []
    entries.push({ startDate: row.from_date as string, grade: row.grade as MvpGradeKey })
    histories.set(row.account_id as string, entries)
  }
  const { values: sightings } = await db.query(
    'SELECT ocid, name, account_id, first_seen_date, last_seen_date FROM character_accounts',
  )
  return {
    histories,
    sightings: (sightings ?? []).map((row) => ({
      ocid: row.ocid as string,
      name: row.name as string,
      accountId: row.account_id as string,
      firstSeenOn: row.first_seen_date as string,
      lastSeenOn: row.last_seen_date as string,
    })),
  }
}

/**
 * 옛 드롭의 아이템 줄 id. 반지가 아닌데 레벨이 있으면 레벨을 버린다. 상자 칸 없이 적힌 아이템을 그 난이도가 상자로만 주면
 * 상자 줄이다. 찾지 못하면 `null` 이다.
 */
function convertedDropItemId(row: Row, bossDifficultyId: string, periodKey: string): string | null {
  const itemKey = text(row.item_key)
  const item = findItem(itemKey)
  if (itemKey === null || item === null) return null
  const level = integer(row.ring_level)
  const ringLevel = level !== null && ringLevelItemOf(item, level) !== null ? level : null
  const boxOriginKey = text(row.box_origin_key) ?? onlyBoxOriginOf(itemKey, bossDifficultyId, periodKey)
  return dropItemIdOf({ itemKey, ringLevel, boxOriginKey })
}

/** 옛 드롭 줄이 지금 식으로 받는 메소. 옛 식의 두 분기(수수료가 다 빈 줄 · 내 비율이 찬 옛 균등)를 그대로 탄다. */
function receivedOfOldDrop(row: Row): number {
  return dropPayoutMeso({
    priceState: 'entered',
    priceMeso: integer(row.price_meso),
    priceSplitMode: (text(row.split_mode) as 'even' | 'ratio' | null) ?? null,
    pricePartySize: integer(row.party_size),
    priceShare: row.split_mode === 'ratio' ? integer(row.shares_total) : null,
    priceMyShare: integer(row.my_share),
    saleFeePercent: integer(row.sale_fee_percent),
    splitFeePercent: integer(row.split_fee_percent),
  })
}

interface ConvertedParty {
  ocid: string
  bossDifficultyId: string
}

async function convertSettings(db: SqliteDbConnection): Promise<Map<string, ConvertedParty>> {
  const parties = new Map<string, ConvertedParty>()
  const { values } = await db.query('SELECT * FROM boss_parties')
  for (const row of values ?? []) {
    const bossDifficultyId = bossDifficultyIdOf(row.boss_key as string, row.difficulty as string)
    if (bossDifficultyId === null) continue
    parties.set(row.id as string, { ocid: row.ocid as string, bossDifficultyId })
    const split = splitOf(row)
    if (split === null) continue
    const follows = split.type === 'excluded' || followsOf(row)
    await db.run(
      `INSERT INTO boss_split_settings
         (id, ocid, boss_difficulty_id, split_type, party_size, split_share_millipercent, split_fee_percent,
          split_fee_follows_mvp_grade, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id, row.ocid, bossDifficultyId, split.type, split.partySize, split.share,
        follows ? null : integer(row.split_fee_percent), follows ? 1 : 0, row.created_at, row.updated_at,
      ],
    )
  }
  return parties
}

/** 처치한 비율 분배의 빈 요율은 그 기록 날짜의 등급 요율로 채우고, 받은 메소를 그 요율과 새 % 로 다시 센다. */
function clearedFee(
  row: Row,
  split: Split,
  ocid: string,
  context: FeeRateContext,
): { fee: number | null; received: number } {
  const fee = integer(row.split_fee_percent)
  const received = integer(row.payout_meso) ?? 0
  if (split.type !== 'ratio' || fee !== null) return { fee: split.type === 'excluded' ? null : fee, received }
  const date = text(row.defeated_date) ?? periodStartDateKey(row.period_key as string)
  const filled = autoFeePercent(context, ocid, date)
  return {
    fee: filled,
    received: crystalPayoutMeso(integer(row.price_meso) ?? 0, split.partySize ?? 2, {
      myShare: split.share,
      sharesTotal: SHARE_PERCENT_TOTAL,
      splitFeePercent: filled,
    }),
  }
}

async function convertEntries(
  db: SqliteDbConnection,
  parties: ReadonlyMap<string, ConvertedParty>,
  context: FeeRateContext,
): Promise<Map<string, { bossDifficultyId: string; periodKey: string }>> {
  const entries = new Map<string, { bossDifficultyId: string; periodKey: string }>()
  const { values } = await db.query('SELECT * FROM boss_party_periods')
  for (const row of values ?? []) {
    const party = parties.get(row.party_id as string)
    const periodKey = row.period_key as string
    const periodCode = periodCodeOf(periodKey)
    if (party === undefined || periodCode === null) continue
    const cleared = row.clear_status === 'cleared'
    const split = splitOf(row)
    const follows = split?.type === 'excluded' || followsOf(row)
    const { fee, received } = cleared && split !== null
      ? clearedFee(row, split, party.ocid, context)
      : { fee: follows ? null : integer(row.split_fee_percent), received: null }
    await db.run(
      `INSERT INTO boss_profit_entries
         (id, ocid, boss_difficulty_id, period_code, world_id, crystal_price_meso, crystal_received_meso, split_type,
          party_size, split_share_millipercent, split_fee_percent, split_fee_follows_mvp_grade, cleared_date,
          clear_recorded_by, over_crystal_sale_limit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id, party.ocid, party.bossDifficultyId, periodCode, findWorld(text(row.world_key))?.id ?? null,
        cleared ? integer(row.price_meso) : null, cleared ? received : null, split?.type ?? null,
        split?.partySize ?? null, split?.share ?? null, fee, follows ? 1 : 0,
        cleared ? text(row.defeated_date) : null, cleared ? (text(row.source) ?? 'auto') : null,
        cleared && Number(row.over_crystal_limit) === 1 ? 1 : null, row.created_at, row.updated_at,
      ],
    )
    entries.set(row.id as string, { bossDifficultyId: party.bossDifficultyId, periodKey })
  }
  return entries
}

async function convertDrops(
  db: SqliteDbConnection,
  entries: ReadonlyMap<string, { bossDifficultyId: string; periodKey: string }>,
): Promise<void> {
  const seen = new Set<string>()
  const { values } = await db.query('SELECT * FROM boss_drops ORDER BY period_id, sort_order, created_at')
  for (const row of values ?? []) {
    const entry = entries.get(row.period_id as string)
    if (entry === undefined) continue
    const itemId = convertedDropItemId(row, entry.bossDifficultyId, entry.periodKey)
    // 서버의 유일 기준과 같게, 같은 수익 건에 같은 아이템 줄이 둘이면 먼저 적은 줄만 남긴다.
    if (itemId === null || seen.has(`${row.period_id as string}|${itemId}`)) continue
    seen.add(`${row.period_id as string}|${itemId}`)
    const entered = row.record_status === 'completed'
    const split = entered ? splitOf(row) : null
    await db.run(
      `INSERT INTO boss_drops_converted
         (id, profit_entry_id, item_id, category, price_status, sale_price_meso, sale_received_meso, priced_at,
          sale_fee_percent, sale_fee_follows_mvp_grade, split_type, party_size, split_share_millipercent,
          split_fee_percent, split_fee_follows_mvp_grade, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id, row.period_id, itemId, row.category,
        entered ? 'entered' : row.record_status === 'skipped' ? 'skipped' : 'pending',
        entered ? integer(row.price_meso) : null, entered ? receivedOfOldDrop(row) : null,
        entered ? text(row.priced_at) : null, entered ? integer(row.sale_fee_percent) : null,
        entered && Number(row.sale_fee_auto) === 1 ? 1 : 0, split?.type ?? null, split?.partySize ?? null,
        split?.share ?? null, entered ? integer(row.split_fee_percent) : null,
        entered && Number(row.split_fee_auto) === 1 ? 1 : 0, row.created_at, row.updated_at,
      ],
    )
  }
}

/** 보스 기록 표 셋을 새 표 셋으로 옮기고 옛 표를 지운다. 기기 변환의 한 트랜잭션 안에서 돈다. */
export async function convertBossTables(db: SqliteDbConnection): Promise<void> {
  await db.execute(`CREATE TABLE boss_split_settings ${BOSS_SPLIT_SETTINGS_BODY}`)
  await db.execute(`CREATE TABLE boss_profit_entries ${BOSS_PROFIT_ENTRIES_BODY}`)
  // 옛 `boss_drops` 가 아직 있어 다른 이름으로 만들고, 옛 표를 지운 뒤 이름을 바꾼다.
  await db.execute(`CREATE TABLE boss_drops_converted ${BOSS_DROPS_BODY}`)
  const parties = await convertSettings(db)
  const entries = await convertEntries(db, parties, await feeContextOf(db))
  await convertDrops(db, entries)
  // 드롭을 옮기지 못해 처치도 분배도 드롭도 남지 않은 처치 전 줄은 지운다. 남기면 줄이 있는 것만으로 기간을 세는 자리가 헛걸린다.
  await db.execute(
    `DELETE FROM boss_profit_entries
      WHERE clear_recorded_by IS NULL AND split_type IS NULL
        AND NOT EXISTS (SELECT 1 FROM boss_drops_converted d WHERE d.profit_entry_id = boss_profit_entries.id)`,
  )
  // 외래키를 켠 채라 자식부터 지운다.
  await db.execute('DROP TABLE boss_drops')
  await db.execute('DROP TABLE boss_party_periods')
  await db.execute('DROP TABLE boss_parties')
  await db.execute('ALTER TABLE boss_drops_converted RENAME TO boss_drops')
}
