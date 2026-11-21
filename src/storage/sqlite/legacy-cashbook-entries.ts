/**
 * 1.0.15 기기 변환 전 모양의 가계부 기록 표(`UNCONVERTED_…`)를 쓰는 SQL. 버전 15 이관과 변환의 가계부 단계만 부른다.
 *
 * 변환 전 표는 분류 · 품목을 key 글자로 들고, 주인을 모르는 옛 기록에 넥슨 계정 칸이 있다. 지금 표를 쓰는 어댑터
 * (`storage/cashbook-entries.ts`)와 칸이 달라 따로 둔다.
 */
import type { EntryType, StoredEntry } from '../cashbook-entries'
import type { SqliteDbConnection } from '../ports'
import { NEW_UUID_SQL } from './uuid'

function flagOf(value: boolean | null): number | null {
  return value === null ? null : value ? 1 : 0
}

/**
 * 버전 15 가 옮긴 기록 하나를 변환 전 표에 넣는다. 그 이관이 옮기는 옛 손입력에는 조각 사용 · 이전 · 환전 입력이 없어 기록 · 품목 ·
 * 사냥 입력만 적는다. 부르는 쪽이 트랜잭션으로 감싼다.
 */
export async function insertUnconvertedEntry(db: SqliteDbConnection, entry: StoredEntry): Promise<void> {
  const { head } = entry
  await db.run(
    `INSERT INTO cashbook_entries (id, ocid, account_id, world_key, entry_type, category_key, entry_date, memo, created_at, updated_at)
     VALUES (?, ?, ?, (SELECT p.world_key FROM character_profiles p WHERE p.ocid = ?), ?, ?, ?, ?, ?, ?)`,
    [
      head.id,
      head.ocid,
      head.accountId,
      head.ocid,
      head.entryType,
      head.categoryKey,
      head.entryDate,
      head.memo,
      head.createdAt,
      head.createdAt,
    ],
  )
  for (const [index, item] of entry.items.entries()) {
    await db.run(
      `INSERT INTO cashbook_entry_items
         (id, entry_id, sort_order, item_key, item_name, form_key, item_kind_key, quantity, from_level, to_level,
          amount_meso, tariff_meso, sale_fee_percent, sale_fee_meso, sale_fee_auto, amount_point, point_per_100m_meso,
          meso_market_fee_percent, amount_cash, fragment_count, untradable_fragment_count, fragment_price_meso, hexa_activation,
          hexa_use_storage, hexa_storage_as_spend, inventory_item_id, ring_level)
       VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        head.id, index, item.itemKey, item.itemName, item.formKey, item.itemKindKey, item.quantity, item.fromLevel,
        item.toLevel, item.amountMeso, item.tariffMeso, item.saleFeePercent, item.saleFeeMeso, item.saleFeeAuto ? 1 : null,
        item.amountPoint, item.pointPer100mMeso, item.mesoMarketFeePercent, item.amountCash, item.fragmentCount,
        item.untradableFragmentCount, item.fragmentPriceMeso, flagOf(item.hexaActivation), flagOf(item.hexaUseStorage),
        flagOf(item.hexaStorageAsSpend), item.inventoryItemId, item.ringLevel,
      ],
    )
  }
  const hunt = entry.hunt
  if (hunt === null) return
  await db.run(
    `INSERT INTO cashbook_entry_hunt_inputs
       (id, entry_id, character_level, missed_mobs, boosts, fragments, fragment_price_meso, meso_rate, typed_meso, union_tier)
     VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      head.id, hunt.characterLevel, hunt.missedMobs, hunt.boosts, hunt.fragments, hunt.fragmentPrice, hunt.mesoRate,
      hunt.typedMeso, hunt.unionTier,
    ],
  )
}

/** 그 ocid 의 프로필 월드. 주인을 대표 캐릭터로 붙인 기록이 그 캐릭터의 월드를 든다. */
const PROFILE_WORLD_SQL = '(SELECT p.world_key FROM character_profiles p WHERE p.ocid = ?)'

/** 주인을 모르는 옛 기록 가운데 그 넥슨 계정의 메이플 ID 가 하나뿐인 것. */
const LEGACY_OWNERLESS_SQL = `
  ocid IS NULL AND account_id IS NULL AND nexon_account_id IS NOT NULL AND nexon_account_id <> ''
  AND (SELECT COUNT(DISTINCT ca.account_id) FROM character_accounts ca
        WHERE ca.nexon_account_id = cashbook_entries.nexon_account_id) = 1`

/**
 * 주인을 모르는 옛 기록을 그 넥슨 계정의 하나뿐인 메이플 ID 로 옮기고 계정 칸을 비운다. 몇 번을 불러도 결과가 같다.
 *
 * 메이플 ID 가 여럿이면 어느 ID 의 기록인지 몰라 그대로 둔다.
 *
 * @param categoryKeys 메이플 ID 를 고를 수 있는 분류. 캐릭터만 고르는 분류의 옛 기록은 옮기지 않는다
 */
export async function assignLegacyEntryAccounts(
  db: SqliteDbConnection,
  entryType: EntryType,
  categoryKeys: readonly string[],
): Promise<void> {
  if (categoryKeys.length === 0) return
  const scope = `entry_type = ? AND category_key IN (${categoryKeys.map(() => '?').join(', ')}) AND ${LEGACY_OWNERLESS_SQL}`
  await db.run(
    `UPDATE cashbook_entries
        SET account_id = (SELECT MIN(ca.account_id) FROM character_accounts ca
                           WHERE ca.nexon_account_id = cashbook_entries.nexon_account_id),
            nexon_account_id = NULL
      WHERE ${scope}`,
    [entryType, ...categoryKeys],
  )
}

/**
 * 주인을 모르는 옛 기록(캐릭터도 메이플 ID 도 없는 기록)을 대표 캐릭터에게 붙이고 계정 칸을 비운다. 몇 번을 불러도 결과가 같다.
 *
 * 메이플 ID 를 고를 수 있는 분류는 그 메이플 ID 에, 나머지는 캐릭터에만 붙을 수 있어 그 캐릭터(ocid)에 붙인다. 캐릭터 기록은
 * ocid 로 메이플 ID 를 찾으므로 메이플 ID 칸을 채우지 않는다.
 *
 * @param accountCategoryKeys 메이플 ID 를 고를 수 있는 분류
 */
export async function assignOwnerlessEntries(
  db: SqliteDbConnection,
  entryType: EntryType,
  owner: { ocid: string; accountId: string },
  accountCategoryKeys: readonly string[],
): Promise<void> {
  const ownerless = 'entry_type = ? AND ocid IS NULL AND account_id IS NULL'
  if (accountCategoryKeys.length > 0) {
    await db.run(
      `UPDATE cashbook_entries SET account_id = ?, nexon_account_id = NULL
        WHERE ${ownerless} AND category_key IN (${accountCategoryKeys.map(() => '?').join(', ')})`,
      [owner.accountId, entryType, ...accountCategoryKeys],
    )
  }
  await db.run(
    `UPDATE cashbook_entries SET ocid = ?, nexon_account_id = NULL, world_key = ${PROFILE_WORLD_SQL} WHERE ${ownerless}`,
    [owner.ocid, owner.ocid, entryType],
  )
}
