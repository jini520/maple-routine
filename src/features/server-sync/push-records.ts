/**
 * 대기 줄의 원본을 올리기의 한 건으로 바꾸는 함수. 표마다 기기 칸을 서버 `sync.dto.ts` 의 칸으로 옮긴다.
 *
 * 서버는 칸이 틀린 건을 코드 없이 거절하고 앱은 다섯 번 뒤 버린다. 그래서 칸 하나가 어긋나도 그 기록은 조용히 올라가지 않는다.
 *
 * @see docs/foundation/server-sync.md `올리기`
 */
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import type { SyncPushRecord } from '../../server/sync'
import { partsOfPreferenceRecordId, SERVER_SYNC_TABLES, type ServerSyncTable } from '../../storage/server-sync-queue'

/** 기록의 주인을 찾는 함수. 기기 기록에는 메이플 ID 가 없는 것이 많다. 모르면 `null` 이다. */
export interface RecordOwners {
  mapleIdOfOcid(ocid: string): Promise<string | null>
  mapleIdOfNexonAccount(nexonAccountId: string): Promise<string | null>
}

/** 대기 줄 하나로 할 일. `hold` 는 메이플 ID 를 몰라 두는 것이고, `drop` 은 보낼 것이 없어 대기 줄만 지우는 것이다. */
export type PushRecordPlan = { kind: 'send'; record: SyncPushRecord } | { kind: 'hold' } | { kind: 'drop' }

type Row = Record<string, unknown>

/** 메이플 ID 를 몰라 그 기록을 두는 신호. 표마다의 함수 깊은 곳에서 던져 한 자리에서 받는다. */
class OwnerUnknown extends Error {}

/**
 * 넥슨 식별자를 서버에 보일 값으로. `#` 로 시작하는 값은 받기가 짝이 없는 해시에 붙인 표시라 다시 해시하지 않고 `#` 만 뗀다.
 * 다시 해시하면 서버가 다른 캐릭터로 본다.
 */
export function nexonIdHashOf(id: string): string {
  return id.startsWith('#') ? id.slice(1) : nexonIdHashHex(id)
}

/** SQLite 의 1 · 0 을 참 거짓으로. 빈 칸은 빈 칸이다. */
function bool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  return value === 1 || value === true || value === '1'
}

/** 시각을 ISO 로. 서버는 시간대가 붙은 ISO 만 받는다. 읽지 못하는 값은 그대로 보내 서버가 거절하게 둔다. */
function instant(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const time = Date.parse(value)
  return Number.isNaN(time) ? value : new Date(time).toISOString()
}

/** 빈 칸을 뺀다. 서버는 빠진 칸을 빈 칸으로 읽고, 빼면 본문이 줄어 한 요청에 더 싣는다. */
function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, one]) => (one === null || one === undefined ? [] : [[key, compact(one)]])),
  )
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function mapleIdOfOcid(owners: RecordOwners, ocid: unknown): Promise<string> {
  const found = typeof ocid === 'string' ? await owners.mapleIdOfOcid(ocid) : null
  if (found === null) throw new OwnerUnknown()
  return nexonIdHashOf(found)
}

/** 캐릭터 기록의 주인 두 칸. 서버가 캐릭터 줄로 바꾼다. */
async function characterOwnerOf(owners: RecordOwners, ocid: unknown): Promise<{ mapleId: string; ocid: string }> {
  return { mapleId: await mapleIdOfOcid(owners, ocid), ocid: nexonIdHashOf(text(ocid)) }
}

function splitOf(row: Row): Row {
  return {
    splitType: row.split_type,
    partySize: row.party_size,
    splitShareMillipercent: row.split_share_millipercent,
    splitFeePercent: row.split_fee_percent,
    splitFeeFollowsMvpGrade: bool(row.split_fee_follows_mvp_grade),
  }
}

function cashbookItemOf(item: Row): Row {
  return {
    targetType: item.target_type,
    targetId: item.target_id,
    itemName: item.item_name,
    spendRewardTypeId: item.spend_reward_type_id,
    itemTypeId: item.item_type_id,
    quantity: item.quantity,
    fromLevel: item.from_level,
    toLevel: item.to_level,
    amountMeso: item.amount_meso,
    tariffMeso: item.tariff_meso,
    saleFeePercent: item.sale_fee_percent,
    saleFeeMeso: item.sale_fee_meso,
    amountMaplePoint: item.amount_maple_point,
    maplePointPer100mMeso: item.maple_point_per_100m_meso,
    amountCash: item.amount_cash,
    fragmentQuantity: item.fragment_quantity,
    untradableFragmentQuantity: item.untradable_fragment_quantity,
    fragmentPriceMeso: item.fragment_price_meso,
    includesHexaActivation: bool(item.includes_hexa_activation),
    saleFeeFollowsMvpGrade: bool(item.sale_fee_follows_mvp_grade),
    mesoMarketFeePercent: item.meso_market_fee_percent,
    usesStoredFragments: bool(item.uses_stored_fragments),
    countsStoredFragmentsAsSpend: bool(item.counts_stored_fragments_as_spend),
    inventoryItemId: item.inventory_item_id,
  }
}

/** 가계부 기록과 딸린 줄. 캐릭터 기록은 기기에 메이플 ID 칸이 비어 있어 ocid 로 찾는다. 받는 캐릭터는 다른 메이플 ID 일 수 있다. */
async function cashbookEntryOf(row: Row, owners: RecordOwners): Promise<Row> {
  const hunt = isRow(row.hunt_input) ? row.hunt_input : null
  const transfer = isRow(row.transfer_input) ? row.transfer_input : null
  const exchange = isRow(row.exchange_input) ? row.exchange_input : null
  return {
    id: row.id,
    mapleId: typeof row.account_id === 'string' ? nexonIdHashOf(row.account_id) : await mapleIdOfOcid(owners, row.ocid),
    ocid: typeof row.ocid === 'string' ? nexonIdHashOf(row.ocid) : null,
    worldId: row.world_id,
    categoryId: row.category_id,
    date: row.date,
    memo: row.memo,
    recordedAt: instant(row.recorded_at),
    items: (Array.isArray(row.items) ? row.items.filter(isRow) : []).map(cashbookItemOf),
    huntInput:
      hunt === null
        ? null
        : {
            characterLevel: hunt.character_level,
            missedMobQuantity: hunt.missed_mob_quantity,
            usesWealthPotion: bool(hunt.uses_wealth_potion),
            usesUnionWealth: bool(hunt.uses_union_wealth),
            unionWealthTier: hunt.union_wealth_tier,
            fragmentQuantity: hunt.fragment_quantity,
            fragmentPriceMeso: hunt.fragment_price_meso,
            mesoAcquisitionPercent: hunt.meso_acquisition_percent,
            typedMeso: hunt.typed_meso,
          },
    transferInput:
      transfer === null
        ? null
        : {
            receiverMapleId: await mapleIdOfOcid(owners, transfer.receiver_ocid),
            receiverOcid: nexonIdHashOf(text(transfer.receiver_ocid)),
            transferMeso: transfer.transfer_meso,
            feePercent: transfer.fee_percent,
            feeFollowsMvpGrade: bool(transfer.fee_follows_mvp_grade),
          },
    exchangeInput:
      exchange === null
        ? null
        : {
            soldMeso: exchange.sold_meso,
            sellMaplePointPer100mMeso: exchange.sell_maple_point_per_100m_meso,
            boughtMeso: exchange.bought_meso,
            buyMaplePointPer100mMeso: exchange.buy_maple_point_per_100m_meso,
            mesoMarketFeePercent: exchange.meso_market_fee_percent,
          },
    fragmentUses: (Array.isArray(row.fragment_uses) ? row.fragment_uses.filter(isRow) : []).map((use) => ({
      fragmentSource: use.fragment_source,
      ocid: typeof use.ocid === 'string' ? nexonIdHashOf(use.ocid) : null,
      fragmentQuantity: use.fragment_quantity,
    })),
  }
}

/** 약속이나 그 주의 예외에서 도는 보스. 캐릭터는 다른 메이플 ID 의 것일 수 있다. */
async function appointmentBossesOf(bosses: unknown, owners: RecordOwners): Promise<Row[]> {
  const list = Array.isArray(bosses) ? bosses.filter(isRow) : []
  return Promise.all(
    list.map(async (boss, sortOrder) => ({
      sortOrder,
      bossDifficultyId: boss.bossDifficultyId,
      ...(await characterOwnerOf(owners, boss.ocid)),
    })),
  )
}

async function partyAppointmentOf(row: Row, owners: RecordOwners): Promise<Row> {
  const schedule = isRow(row.schedule) ? row.schedule : {}
  const exceptions = isRow(row.exceptions) ? row.exceptions : {}
  return {
    id: row.id,
    time: row.time,
    durationMinutes: row.durationMinutes,
    alarmMinutesBefore: row.alarmMinutesBefore,
    scheduleType: schedule.type,
    date: schedule.type === 'once' ? schedule.date : null,
    weekday: schedule.type === 'weekly' ? schedule.weekday : null,
    fromWeekCode: schedule.type === 'weekly' ? schedule.fromWeekCode : null,
    untilWeekCode: schedule.type === 'weekly' ? schedule.untilWeekCode : null,
    memo: row.memo,
    bosses: await appointmentBossesOf(row.bosses, owners),
    exceptions: await Promise.all(
      Object.entries(exceptions).map(async ([weekCode, exception]) => {
        const one = isRow(exception) ? exception : {}
        return {
          weekCode,
          date: one.date,
          time: one.time,
          durationMinutes: one.durationMinutes,
          alarmMinutesBefore: one.alarmMinutesBefore,
          bosses: await appointmentBossesOf(one.bosses, owners),
        }
      }),
    ),
  }
}

async function calculatorRecordOf(row: Row, owners: RecordOwners): Promise<Row> {
  const characters = Array.isArray(row.characters) ? row.characters.filter(isRow) : []
  return {
    id: row.id,
    savedAt: instant(row.savedAt),
    characters: await Promise.all(
      characters.map(async (character, sortOrder) => ({
        sortOrder,
        ...(await characterOwnerOf(owners, character.ocid)),
        bosses: character.bosses,
      })),
    ),
  }
}

/** 원본이 있는 기록의 몸. 몸이 없으면 보낼 것이 없다. */
async function upsertRowOf(table: ServerSyncTable, row: Row, owners: RecordOwners): Promise<Row | null> {
  switch (table) {
    case 'characterWorldLeaps':
      return {
        id: row.id,
        mapleId: await mapleIdOfOcid(owners, row.ocid).catch(() => mapleIdOfOcid(owners, row.previous_ocid)),
        previousOcid: nexonIdHashOf(text(row.previous_ocid)),
        ocid: nexonIdHashOf(text(row.ocid)),
      }
    case 'inventoryItems':
      return {
        id: row.id,
        mapleId: nexonIdHashOf(text(row.account_id)),
        worldId: row.world_id,
        itemId: row.item_id,
        cashbookItemTypeId: row.cashbook_item_type_id,
        addedQuantity: row.added_quantity,
      }
    case 'cashbookEntries':
      return cashbookEntryOf(row, owners)
    case 'bossProfitEntries':
      // 보스 줄은 서버가 난이도에서 채우고, `over_crystal_sale_limit` 은 기기만 쓰는 칸이다.
      return {
        id: row.id,
        ...(await characterOwnerOf(owners, row.ocid)),
        bossDifficultyId: row.boss_difficulty_id,
        periodCode: row.period_code,
        worldId: row.world_id,
        crystalPriceMeso: row.crystal_price_meso,
        crystalReceivedMeso: row.crystal_received_meso,
        ...splitOf(row),
        clearedDate: row.cleared_date,
        clearRecordedBy: row.clear_recorded_by,
      }
    case 'bossDrops':
      return {
        id: row.id,
        profitEntryId: row.profit_entry_id,
        itemId: row.item_id,
        category: row.category,
        priceStatus: row.price_status,
        salePriceMeso: row.sale_price_meso,
        saleReceivedMeso: row.sale_received_meso,
        pricedAt: instant(row.priced_at),
        saleFeePercent: row.sale_fee_percent,
        saleFeeFollowsMvpGrade: bool(row.sale_fee_follows_mvp_grade),
        ...splitOf(row),
      }
    case 'bossSplitSettings':
      return { id: row.id, ...(await characterOwnerOf(owners, row.ocid)), bossDifficultyId: row.boss_difficulty_id, ...splitOf(row) }
    case 'enhancementTotals':
      return {
        id: row.id,
        ...(await characterOwnerOf(owners, row.ocid)),
        historyDate: row.history_date,
        category: row.category,
        itemName: row.item_name,
        attemptCount: row.attempt_count,
        attemptCostMeso: row.attempt_cost_meso,
        destroyDefenceCostMeso: row.destroy_defence_cost_meso,
        worldId: row.world_id,
        superiorCostMeso: row.superior_cost_meso,
        fromStar: row.from_star,
        toStar: row.to_star,
        isEventWorld: bool(row.is_event_world),
      }
    case 'enhancementSettledDays': {
      // 서버는 그 메이플 ID 가 달린 넥슨 계정에 적는다. 기기의 넥슨 계정 id 는 서버에 없는 값이다.
      const mapleId = await owners.mapleIdOfNexonAccount(text(row.nexon_account_id))
      if (mapleId === null) throw new OwnerUnknown()
      return { mapleId: nexonIdHashOf(mapleId), apiType: row.enhancement_type, historyDate: row.history_date }
    }
    case 'rememberedLevels':
      return { id: row.id, ...(await characterOwnerOf(owners, row.ocid)), type: row.type, targetId: row.target_id, level: row.level }
    case 'mvpGradeHistory':
      return { id: row.id, mapleId: nexonIdHashOf(text(row.account_id)), fromDate: row.from_date, gradeId: row.grade_id }
    case 'manualTrackedItems':
      return { ...(await characterOwnerOf(owners, row.ocid)), type: row.type, targetId: row.targetId }
    case 'sharedContentProgress':
      return {
        mapleId: nexonIdHashOf(text(row.mapleId)),
        worldId: row.worldId,
        contentId: row.contentId,
        isRegistered: row.isRegistered,
        nowCount: row.nowCount,
        maxCount: row.maxCount,
        questState: row.questState,
        periodCode: row.periodCode,
      }
    case 'mapleIdNames':
      return { mapleId: nexonIdHashOf(text(row.mapleId)), name: row.name }
    case 'trackedCharacters':
      return { ...(await characterOwnerOf(owners, row.ocid)), sortOrder: row.sortOrder, isRepresentative: row.isRepresentative }
    case 'representativeCharacterMotions':
      return {
        ...(await characterOwnerOf(owners, row.ocid)),
        actions: row.actions,
        emotions: row.emotions,
        durationMs: row.durationMs,
        restsBetweenActions: row.restsBetweenActions,
      }
    case 'accountSettings':
      return typeof row.column === 'string' ? { [row.column]: row.value } : null
    case 'bottomBarSubPageOrders':
      return { groupKey: row.groupKey, subPageKeys: row.subPageKeys }
    case 'partyAppointments':
      return partyAppointmentOf(row, owners)
    case 'bossProfitCalculatorRecords':
      return calculatorRecordOf(row, owners)
  }
}

/** 원본이 없는 기록의 지우기 몸. id 가 있는 기록은 id 로, 없는 기록은 유일 기준의 값으로 가리킨다. 지우기가 없는 표는 `null` 이다. */
async function deleteRowOf(table: ServerSyncTable, recordId: string, owners: RecordOwners): Promise<Row | null> {
  if (table === 'enhancementSettledDays' || table === 'accountSettings' || table === 'bottomBarSubPageOrders') return null
  const parts = partsOfPreferenceRecordId(table, recordId)
  switch (table) {
    case 'manualTrackedItems': {
      if (parts === null) return null
      const [ocid, type, targetId] = parts
      return { ...(await characterOwnerOf(owners, ocid)), type, targetId }
    }
    case 'sharedContentProgress': {
      if (parts === null) return null
      const [mapleId = '', worldId = '', contentId] = parts
      return { mapleId: nexonIdHashOf(mapleId), worldId: worldId === '' ? null : worldId, contentId }
    }
    case 'mapleIdNames':
      return parts === null ? null : { mapleId: nexonIdHashOf(parts[0] ?? '') }
    case 'trackedCharacters':
    case 'representativeCharacterMotions':
      return parts === null ? null : characterOwnerOf(owners, parts[0])
    default:
      return { id: recordId }
  }
}

function isServerSyncTable(table: string): table is ServerSyncTable {
  return (SERVER_SYNC_TABLES as readonly string[]).includes(table)
}

/**
 * 대기 줄 하나를 올리기의 한 건으로. 원본이 있으면 올리기, 없으면 지우기다. 빈 칸은 뺀다. 설정은 빠진 칸이 고치지 않는다는 뜻이라 빈
 * 값도 싣는다.
 *
 * @param source `readServerSyncSource` 가 읽은 원본. 없으면 `null`
 */
export async function pushRecordOf(
  table: string,
  recordId: string,
  source: Row | null,
  owners: RecordOwners,
): Promise<PushRecordPlan> {
  if (!isServerSyncTable(table)) return { kind: 'drop' }
  try {
    const row = source === null ? await deleteRowOf(table, recordId, owners) : await upsertRowOf(table, source, owners)
    if (row === null) return { kind: 'drop' }
    const action = source === null ? 'delete' : 'upsert'
    return { kind: 'send', record: { table, action, row: table === 'accountSettings' ? row : (compact(row) as Row) } }
  } catch (error: unknown) {
    if (error instanceof OwnerUnknown) return { kind: 'hold' }
    throw error
  }
}
