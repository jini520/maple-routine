/**
 * 받은 서버 줄을 기기 칸으로 바꾸는 함수. 올리기의 바꾸기(`push-records.ts`)를 거꾸로 한다.
 *
 * 넥슨 식별자는 해시로 온다. 이 기기가 본 캐릭터와 메이플 ID(`character_accounts`)를 해시해 짝을 찾고, 짝이 없으면 해시 앞에 `#` 를
 * 붙여 원문 칸에 적는다. 올리기는 `#` 만 떼어 같은 해시로 보낸다.
 *
 * @see docs/foundation/server-sync.md `받기`
 */
import { unmatchedNexonIdOf } from '../../lib/crypto/nexon-id-hash'
import type { PulledPreferenceRecord } from '../../storage/server-sync-pull-preferences'
import type { CashbookChildren, PulledSettledDay, PulledSqliteRecord } from '../../storage/server-sync-pull'

/** 해시를 이 기기의 원문으로 찾는 함수. 짝이 없으면 `null` 이다. */
export interface NexonIdResolver {
  ocidOf(hash: string): string | null
  mapleIdOf(hash: string): string | null
  /** 그 메이플 ID 를 본 이 기기의 넥슨 계정 id. 굳은 날을 적는 자리다 */
  nexonAccountIdOf(mapleId: string): string | null
}

/** 받은 줄 하나로 할 일. 넣을 수 없는 줄은 `null` 이다. */
export type PulledRecord = PulledSqliteRecord | PulledSettledDay | PulledPreferenceRecord

type Row = Record<string, unknown>

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 빠진 칸은 빈 값이다. 서버는 빈 칸을 빈 값으로 싣는다. */
function value(row: Row, key: string): unknown {
  return row[key] ?? null
}

/** 참 거짓을 SQLite 의 1 · 0 으로. 빈 칸은 빈 칸이다. */
function bit(row: Row, key: string): 0 | 1 | null {
  const one = row[key]
  if (one === null || one === undefined) return null
  return one === true ? 1 : 0
}

function text(row: Row, key: string): string {
  const one = row[key]
  return typeof one === 'string' ? one : ''
}

function rowsOf(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter(isRow) : []
}

/** 원문을 찾거나 `#` 를 붙인 해시. */
function ocidOf(resolver: NexonIdResolver, hash: unknown): string {
  const one = typeof hash === 'string' ? hash : ''
  return resolver.ocidOf(one) ?? unmatchedNexonIdOf(one)
}

function mapleIdOf(resolver: NexonIdResolver, hash: unknown): string {
  const one = typeof hash === 'string' ? hash : ''
  return resolver.mapleIdOf(one) ?? unmatchedNexonIdOf(one)
}

function splitOf(row: Row): Row {
  return {
    split_type: value(row, 'splitType'),
    party_size: value(row, 'partySize'),
    split_share_millipercent: value(row, 'splitShareMillipercent'),
    split_fee_percent: value(row, 'splitFeePercent'),
    split_fee_follows_mvp_grade: bit(row, 'splitFeeFollowsMvpGrade'),
  }
}

/** 보스 기록 표 셋과 인벤토리의 만든 · 고친 시각. 기기 칸이 빈 값을 받지 않는다. */
function timesOf(row: Row): Row {
  return { created_at: value(row, 'createdAt'), updated_at: value(row, 'updatedAt') }
}

function cashbookItemOf(item: Row): Row {
  return {
    target_type: value(item, 'targetType'),
    target_id: value(item, 'targetId'),
    item_name: value(item, 'itemName'),
    spend_reward_type_id: value(item, 'spendRewardTypeId'),
    item_type_id: value(item, 'itemTypeId'),
    quantity: value(item, 'quantity'),
    from_level: value(item, 'fromLevel'),
    to_level: value(item, 'toLevel'),
    amount_meso: value(item, 'amountMeso'),
    tariff_meso: value(item, 'tariffMeso'),
    sale_fee_percent: value(item, 'saleFeePercent'),
    sale_fee_meso: value(item, 'saleFeeMeso'),
    sale_fee_follows_mvp_grade: bit(item, 'saleFeeFollowsMvpGrade'),
    amount_maple_point: value(item, 'amountMaplePoint'),
    maple_point_per_100m_meso: value(item, 'maplePointPer100mMeso'),
    meso_market_fee_percent: value(item, 'mesoMarketFeePercent'),
    amount_cash: value(item, 'amountCash'),
    fragment_quantity: value(item, 'fragmentQuantity'),
    untradable_fragment_quantity: value(item, 'untradableFragmentQuantity'),
    fragment_price_meso: value(item, 'fragmentPriceMeso'),
    includes_hexa_activation: bit(item, 'includesHexaActivation'),
    uses_stored_fragments: bit(item, 'usesStoredFragments'),
    counts_stored_fragments_as_spend: bit(item, 'countsStoredFragmentsAsSpend'),
    inventory_item_id: value(item, 'inventoryItemId'),
  }
}

/** 기기 칸이 빈 값을 받지 않는 칸이 비었으면 그 입력 줄을 넣지 않는다. 기록과 품목은 그대로 넣는다. */
function hasAll(row: Row, keys: readonly string[]): boolean {
  return keys.every((key) => row[key] !== null && row[key] !== undefined)
}

function cashbookChildrenOf(row: Row, resolver: NexonIdResolver): CashbookChildren {
  const hunt = isRow(row.huntInput) ? row.huntInput : null
  const transfer = isRow(row.transferInput) ? row.transferInput : null
  const exchange = isRow(row.exchangeInput) ? row.exchangeInput : null
  return {
    items: rowsOf(row.items).map(cashbookItemOf),
    huntInput:
      hunt === null
        ? null
        : {
            character_level: value(hunt, 'characterLevel'),
            missed_mob_quantity: value(hunt, 'missedMobQuantity'),
            uses_wealth_potion: bit(hunt, 'usesWealthPotion'),
            uses_union_wealth: bit(hunt, 'usesUnionWealth'),
            union_wealth_tier: value(hunt, 'unionWealthTier'),
            fragment_quantity: value(hunt, 'fragmentQuantity'),
            fragment_price_meso: value(hunt, 'fragmentPriceMeso'),
            meso_acquisition_percent: value(hunt, 'mesoAcquisitionPercent'),
            typed_meso: value(hunt, 'typedMeso'),
          },
    transferInput:
      transfer === null || !hasAll(transfer, ['receiverOcid', 'transferMeso', 'feePercent', 'feeFollowsMvpGrade'])
        ? null
        : {
            receiver_ocid: ocidOf(resolver, transfer.receiverOcid),
            transfer_meso: value(transfer, 'transferMeso'),
            fee_percent: value(transfer, 'feePercent'),
            fee_follows_mvp_grade: bit(transfer, 'feeFollowsMvpGrade'),
          },
    exchangeInput:
      exchange === null || !hasAll(exchange, ['soldMeso', 'sellMaplePointPer100mMeso', 'mesoMarketFeePercent'])
        ? null
        : {
            sold_meso: value(exchange, 'soldMeso'),
            sell_maple_point_per_100m_meso: value(exchange, 'sellMaplePointPer100mMeso'),
            bought_meso: value(exchange, 'boughtMeso'),
            buy_maple_point_per_100m_meso: value(exchange, 'buyMaplePointPer100mMeso'),
            meso_market_fee_percent: value(exchange, 'mesoMarketFeePercent'),
          },
    fragmentUses: rowsOf(row.fragmentUses).map((use) => ({
      fragment_source: value(use, 'fragmentSource'),
      ocid: typeof use.ocid === 'string' ? ocidOf(resolver, use.ocid) : null,
      fragment_quantity: value(use, 'fragmentQuantity'),
    })),
  }
}

/** 기록 id 가 있는 SQLite 기록의 칸. 표마다 기기 표의 칸만 싣는다. */
function sqliteRowOf(table: PulledSqliteRecord['table'], row: Row, resolver: NexonIdResolver): Row {
  switch (table) {
    case 'characterWorldLeaps':
      return { id: row.id, previous_ocid: ocidOf(resolver, row.previousOcid), ocid: ocidOf(resolver, row.ocid) }
    case 'inventoryItems':
      return {
        id: row.id,
        account_id: mapleIdOf(resolver, row.mapleId),
        world_id: value(row, 'worldId'),
        item_id: value(row, 'itemId'),
        cashbook_item_type_id: value(row, 'cashbookItemTypeId'),
        added_quantity: value(row, 'addedQuantity'),
        ...timesOf(row),
      }
    case 'cashbookEntries': {
      // 기기는 캐릭터 기록의 메이플 ID 를 ocid 로 찾아 칸을 비워 둔다.
      const isCharacter = typeof row.ocid === 'string'
      return {
        id: row.id,
        ocid: isCharacter ? ocidOf(resolver, row.ocid) : null,
        account_id: isCharacter ? null : mapleIdOf(resolver, row.mapleId),
        world_id: value(row, 'worldId'),
        category_id: value(row, 'categoryId'),
        date: value(row, 'date'),
        memo: value(row, 'memo'),
        recorded_at: value(row, 'recordedAt'),
        updated_at: value(row, 'updatedAt'),
      }
    }
    case 'bossProfitEntries':
      return {
        id: row.id,
        ocid: ocidOf(resolver, row.ocid),
        boss_difficulty_id: value(row, 'bossDifficultyId'),
        period_code: value(row, 'periodCode'),
        world_id: value(row, 'worldId'),
        crystal_price_meso: value(row, 'crystalPriceMeso'),
        crystal_received_meso: value(row, 'crystalReceivedMeso'),
        ...splitOf(row),
        cleared_date: value(row, 'clearedDate'),
        clear_recorded_by: value(row, 'clearRecordedBy'),
        ...timesOf(row),
      }
    case 'bossDrops':
      return {
        id: row.id,
        profit_entry_id: value(row, 'profitEntryId'),
        item_id: value(row, 'itemId'),
        category: value(row, 'category'),
        price_status: value(row, 'priceStatus'),
        sale_price_meso: value(row, 'salePriceMeso'),
        sale_received_meso: value(row, 'saleReceivedMeso'),
        priced_at: value(row, 'pricedAt'),
        sale_fee_percent: value(row, 'saleFeePercent'),
        sale_fee_follows_mvp_grade: bit(row, 'saleFeeFollowsMvpGrade'),
        ...splitOf(row),
        ...timesOf(row),
      }
    case 'bossSplitSettings':
      return {
        id: row.id,
        ocid: ocidOf(resolver, row.ocid),
        boss_difficulty_id: value(row, 'bossDifficultyId'),
        ...splitOf(row),
        ...timesOf(row),
      }
    case 'enhancementTotals':
      return {
        id: row.id,
        ocid: ocidOf(resolver, row.ocid),
        history_date: value(row, 'historyDate'),
        category: value(row, 'category'),
        item_name: value(row, 'itemName'),
        attempt_count: value(row, 'attemptCount'),
        attempt_cost_meso: value(row, 'attemptCostMeso'),
        destroy_defence_cost_meso: value(row, 'destroyDefenceCostMeso'),
        world_id: value(row, 'worldId'),
        // 기기 칸은 빈 값을 받지 않고, 기기는 슈페리얼이 아닌 줄을 0 으로 적는다.
        superior_cost_meso: value(row, 'superiorCostMeso') ?? 0,
        from_star: value(row, 'fromStar'),
        to_star: value(row, 'toStar'),
        is_event_world: bit(row, 'isEventWorld'),
        updated_at: value(row, 'updatedAt'),
      }
    case 'rememberedLevels':
      return {
        id: row.id,
        ocid: ocidOf(resolver, row.ocid),
        type: value(row, 'type'),
        target_id: value(row, 'targetId'),
        level: value(row, 'level'),
        updated_at: value(row, 'updatedAt'),
      }
    case 'mvpGradeHistory':
      return {
        id: row.id,
        account_id: mapleIdOf(resolver, row.mapleId),
        from_date: value(row, 'fromDate'),
        grade_id: value(row, 'gradeId'),
        updated_at: value(row, 'updatedAt'),
      }
  }
}

function sortedRows(value: unknown): Row[] {
  return rowsOf(value).sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
}

function appointmentBossesOf(bosses: unknown, resolver: NexonIdResolver): Row[] {
  return sortedRows(bosses).map((boss) => ({ bossDifficultyId: boss.bossDifficultyId, ocid: ocidOf(resolver, boss.ocid) }))
}

function partyAppointmentOf(row: Row, resolver: NexonIdResolver): Row {
  const exceptions: Row = {}
  for (const exception of rowsOf(row.exceptions)) {
    exceptions[text(exception, 'weekCode')] = {
      date: exception.date,
      time: exception.time,
      durationMinutes: exception.durationMinutes,
      alarmMinutesBefore: value(exception, 'alarmMinutesBefore'),
      bosses: appointmentBossesOf(exception.bosses, resolver),
    }
  }
  const schedule =
    row.scheduleType === 'once'
      ? { type: 'once', date: row.date }
      : { type: 'weekly', weekday: row.weekday, fromWeekCode: row.fromWeekCode, untilWeekCode: value(row, 'untilWeekCode') }
  return {
    id: row.id,
    bosses: appointmentBossesOf(row.bosses, resolver),
    time: row.time,
    durationMinutes: row.durationMinutes,
    alarmMinutesBefore: value(row, 'alarmMinutesBefore'),
    schedule,
    exceptions,
    ...(typeof row.memo === 'string' ? { memo: row.memo } : {}),
  }
}

function calculatorRecordOf(row: Row, resolver: NexonIdResolver): Row {
  return {
    id: row.id,
    savedAt: row.savedAt,
    characters: sortedRows(row.characters).map((character) => ({
      ocid: ocidOf(resolver, character.ocid),
      bosses: rowsOf(character.bosses).map((boss) => ({
        bossDifficultyId: boss.bossDifficultyId,
        splitType: boss.splitType,
        partySize: boss.partySize,
        splitShareMillipercent: value(boss, 'splitShareMillipercent'),
        splitFeePercent: value(boss, 'splitFeePercent'),
        splitFeeFollowsMvpGrade: boss.splitFeeFollowsMvpGrade === true,
      })),
    })),
  }
}

/** 서버 `account_settings` 의 칸 가운데 기기가 든 칸. 줄 id · 번호 · 고친 시각은 기기에 없다. */
const SETTING_COLUMNS = [
  'trackingType',
  'quickLinkRowCount',
  'quickLinkKeys',
  'barGroupKeys',
  'statsCumulativeStartDate',
  'isMvpWeeklyCheckOff',
  'mvpLastCheckedWeekCode',
  'isMvpBulkApplyAsked',
] as const

const SQLITE_TABLES = new Set<string>([
  'characterWorldLeaps',
  'inventoryItems',
  'cashbookEntries',
  'bossProfitEntries',
  'bossDrops',
  'bossSplitSettings',
  'enhancementTotals',
  'rememberedLevels',
  'mvpGradeHistory',
])

/**
 * 받은 줄 하나를 기기 칸으로. 넣을 수 없는 줄(모르는 표 · 짝이 없는 추적 캐릭터와 굳은 날)은 `null` 이다.
 *
 * @param table 받기 응답의 표 이름(서버 표 이름의 낙타 표기)
 */
export function pulledRecordOf(table: string, row: Row, resolver: NexonIdResolver): PulledRecord | null {
  const deleted = row.deletedAt !== null && row.deletedAt !== undefined
  if (SQLITE_TABLES.has(table)) {
    const sqliteTable = table as PulledSqliteRecord['table']
    const record: PulledSqliteRecord = { table: sqliteTable, id: text(row, 'id'), deleted, row: sqliteRowOf(sqliteTable, row, resolver) }
    return sqliteTable === 'cashbookEntries' ? { ...record, children: cashbookChildrenOf(row, resolver) } : record
  }
  switch (table) {
    case 'enhancementSettledDays': {
      const mapleId = resolver.mapleIdOf(text(row, 'mapleId'))
      const nexonAccountId = mapleId === null ? null : resolver.nexonAccountIdOf(mapleId)
      if (nexonAccountId === null) return null
      return { table, deleted, nexonAccountId, enhancementType: text(row, 'apiType'), historyDate: text(row, 'historyDate') }
    }
    case 'partyAppointments':
      return { table, id: text(row, 'id'), deleted, item: partyAppointmentOf(row, resolver) as never }
    case 'bossProfitCalculatorRecords':
      return { table, id: text(row, 'id'), deleted, item: calculatorRecordOf(row, resolver) as never }
    case 'manualTrackedItems':
      return { table, deleted, ocid: ocidOf(resolver, row.ocid), type: text(row, 'type'), targetId: text(row, 'targetId') }
    case 'sharedContentProgress':
      return {
        table,
        deleted,
        mapleId: mapleIdOf(resolver, row.mapleId),
        worldId: typeof row.worldId === 'string' ? row.worldId : null,
        contentId: text(row, 'contentId'),
        entry: {
          isRegistered: row.isRegistered === true,
          // 기기 원장은 숫자만 든다.
          nowCount: Number(row.nowCount ?? 0),
          maxCount: Number(row.maxCount ?? 0),
          questState: (value(row, 'questState') as 0 | 1 | 2 | null),
          periodCode: text(row, 'periodCode'),
        },
      }
    case 'mapleIdNames':
      return { table, deleted, mapleId: mapleIdOf(resolver, row.mapleId), name: text(row, 'name') }
    case 'trackedCharacters': {
      // 이 기기에 부를 키가 없는 캐릭터다. 넣으면 조회 불가로 서고, 빼고 올리면 다른 기기의 목록에서도 사라진다.
      const ocid = resolver.ocidOf(text(row, 'ocid'))
      if (ocid === null) return null
      return { table, deleted, ocid, sortOrder: Number(row.sortOrder ?? 0), isRepresentative: row.isRepresentative === true }
    }
    case 'representativeCharacterMotions':
      return {
        table,
        deleted,
        ocid: ocidOf(resolver, row.ocid),
        motion: {
          actions: row.actions,
          emotions: row.emotions,
          durationMs: row.durationMs,
          restsBetweenActions: row.restsBetweenActions,
        },
      }
    case 'accountSettings':
      return {
        table,
        values: Object.fromEntries(SETTING_COLUMNS.filter((column) => column in row).map((column) => [column, row[column]])),
      }
    case 'bottomBarSubPageOrders':
      return {
        table,
        groupKey: text(row, 'groupKey'),
        subPageKeys: Array.isArray(row.subPageKeys) ? row.subPageKeys.filter((one): one is string => typeof one === 'string') : [],
      }
    default:
      return null
  }
}
