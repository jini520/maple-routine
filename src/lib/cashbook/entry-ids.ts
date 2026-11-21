/**
 * 가계부 기록 표가 적는 줄 id 와 화면 · 계산이 드는 key 를 오가는 함수.
 *
 * 기록 표는 분류 · 품목의 대상 · 아이템 종류 · 추가 리워드 종류를 줄 id 로 적고, 화면은 key 를 든다. 품목의 대상은 기록의 분류가
 * 정한 표 하나를 가리킨다. 반지는 레벨 줄이고, 헥사 코어는 이름이 같아도 직업마다 다른 줄이다.
 */
import { deriveAll, type GameTable } from '../game-data/table'
import { findItem, findItemById, ringLevelItemOf, ringLevelOf } from '../item-catalog'
import { cashbookCategoriesTable } from './categories'
import { hexaMatrixTable } from './hexa-matrix'
import { huntingGroundsTable } from './hunting-grounds'
import { spendCatalogTable } from './spend-catalog'
import { symbolCostsTable } from './symbol-costs'

export type CashbookEntryType = 'income' | 'spend'

/** 품목이 가리키는 표의 종류. 서버 `cashbook_item_target_type` 과 같다. */
export type CashbookItemTargetType = 'hunting_ground' | 'item' | 'spend_item' | 'symbol' | 'hexa_core' | 'hexa_stat'

/** 분류마다 품목이 가리키는 표. 여기 없는 분류(솔 에르다 조각 · 기타)의 품목은 대상이 없다. 헥사 매트릭스는 활성화 칸이 가른다. */
const TARGET_TYPE_OF_CATEGORY: Readonly<Record<string, CashbookItemTargetType>> = {
  'income.hunting': 'hunting_ground',
  'income.hunt_loot_sale': 'item',
  'income.item_sale': 'item',
  'spend.item_purchase': 'item',
  'spend.content': 'spend_item',
  'spend.event_bm': 'spend_item',
  'spend.buff': 'spend_item',
  'spend.scroll': 'spend_item',
  'spend.symbol': 'symbol',
}

/** key 와 줄 id 를 양쪽으로 찾는 표. */
interface KeyedIds {
  readonly idByKey: ReadonlyMap<string, string>
  readonly keyById: ReadonlyMap<string, string>
}

function keyedIdsOf(rows: readonly { id: string; key: string }[]): KeyedIds {
  return {
    idByKey: new Map(rows.map((row) => [row.key, row.id])),
    keyById: new Map(rows.map((row) => [row.id, row.key])),
  }
}

/** 코어 이름 맞추기. 기록과 넥슨은 앞뒤 공백을 걷은 이름을 쓴다. */
const trimmed = (name: string): string => name.normalize('NFC').trim()

const index = deriveAll(
  [cashbookCategoriesTable, spendCatalogTable, huntingGroundsTable, symbolCostsTable, hexaMatrixTable] as GameTable<unknown>[],
  () => {
    const categories = cashbookCategoriesTable.get()
    const catalog = spendCatalogTable.get()
    const hexa = hexaMatrixTable.get()
    return {
      categoryIdByKey: new Map(categories.cashbookCategories.map((row) => [`${row.entryType}.${row.key}`, row.id])),
      categoryIdsByType: {
        income: categories.cashbookCategories.filter((row) => row.entryType === 'income').map((row) => row.id),
        spend: categories.cashbookCategories.filter((row) => row.entryType === 'spend').map((row) => row.id),
      },
      itemTypes: keyedIdsOf(categories.cashbookItemTypes),
      rewardTypes: keyedIdsOf(catalog.spendRewardTypes),
      huntingGrounds: keyedIdsOf(huntingGroundsTable.get().huntingGrounds),
      spendItems: keyedIdsOf(catalog.spendItems),
      symbols: keyedIdsOf(symbolCostsTable.get().symbols),
      hexaStats: keyedIdsOf(hexa.hexaStats),
      cores: hexa.hexaCores,
      coreNameById: new Map(hexa.hexaCores.map((core) => [core.id, core.name])),
      jobIdByName: new Map(hexa.jobs.map((job) => [job.name, job.id])),
      allJobIds: new Set(hexa.jobs.filter((job) => job.isAllJobs).map((job) => job.id)),
    }
  },
)

/** 분류의 줄 id. 기타는 수입 · 지출 양쪽에 있어 종류와 함께 찾는다. 모르는 분류는 `null` 이다. */
export function cashbookCategoryIdOf(entryType: CashbookEntryType, key: string): string | null {
  return index().categoryIdByKey.get(`${entryType}.${key}`) ?? null
}

/** 수입이나 지출 분류의 줄 id 전부. 기록 표에 종류 칸이 없어 분류 줄로 가른다. */
export function cashbookCategoryIdsOf(entryType: CashbookEntryType): readonly string[] {
  return index().categoryIdsByType[entryType]
}

/** 아이템 종류(`equipment` 등)의 줄 id. 모르는 종류는 `null` 이다. */
export function cashbookItemTypeIdOf(key: string): string | null {
  return index().itemTypes.idByKey.get(key) ?? null
}

/** 아이템 종류 줄 id 의 key. 모르는 줄은 `null` 이다. */
export function cashbookItemTypeKeyOf(id: string): string | null {
  return index().itemTypes.keyById.get(id) ?? null
}

/** 에픽던전 추가 리워드 종류(`exp` · `sol_erda`)의 줄 id. 모르는 종류는 `null` 이다. */
export function spendRewardTypeIdOf(key: string): string | null {
  return index().rewardTypes.idByKey.get(key) ?? null
}

/** 추가 리워드 종류 줄 id 의 key. 모르는 줄은 `null` 이다. */
export function spendRewardTypeKeyOf(id: string): string | null {
  return index().rewardTypes.keyById.get(id) ?? null
}

/**
 * 그 분류의 품목이 가리키는 표. 대상이 없는 분류는 `null` 이다.
 *
 * @param hexaActivation 헥사 매트릭스 품목의 활성화 칸. 참 · 거짓이면 헥사 스탯이고 비었으면 헥사 스킬(코어)이다
 */
export function itemTargetTypeOf(
  entryType: CashbookEntryType,
  categoryKey: string,
  hexaActivation: boolean | null,
): CashbookItemTargetType | null {
  if (entryType === 'spend' && categoryKey === 'hexa_matrix') return hexaActivation === null ? 'hexa_core' : 'hexa_stat'
  return TARGET_TYPE_OF_CATEGORY[`${entryType}.${categoryKey}`] ?? null
}

/** 그 캐릭터 직업의 코어, 없으면 모든 직업이 같이 쓰는 코어(`전직업`)에서 이름으로 찾은 줄 id. */
function hexaCoreIdOf(job: string | null, name: string): string | null {
  const { cores, jobIdByName, allJobIds } = index()
  const target = trimmed(name)
  const jobId = job === null ? undefined : jobIdByName.get(job)
  const own = jobId === undefined ? undefined : cores.find((core) => core.jobId === jobId && core.name === target)
  return (own ?? cores.find((core) => allJobIds.has(core.jobId) && core.name === target))?.id ?? null
}

/**
 * 품목 key 의 줄 id. 모르는 key 는 `null` 이다.
 *
 * @param options.ringLevel 아이템이 특수스킬 반지면 그 레벨. 레벨 줄이 표에 없으면 `null` 이다
 * @param options.job 헥사 코어 기록의 캐릭터 직업. 모르면 `전직업` 의 코어에서만 찾는다
 */
export function itemTargetIdOf(
  type: CashbookItemTargetType,
  key: string,
  options: { ringLevel?: number | null; job?: string | null } = {},
): string | null {
  const ids = index()
  switch (type) {
    case 'item': {
      const item = findItem(key)
      if (item === null) return null
      return options.ringLevel == null ? item.id : (ringLevelItemOf(item, options.ringLevel)?.id ?? null)
    }
    case 'hexa_core':
      return hexaCoreIdOf(options.job ?? null, key)
    case 'hunting_ground':
      return ids.huntingGrounds.idByKey.get(key) ?? null
    case 'spend_item':
      return ids.spendItems.idByKey.get(key) ?? null
    case 'symbol':
      return ids.symbols.idByKey.get(key) ?? null
    case 'hexa_stat':
      return ids.hexaStats.idByKey.get(key) ?? null
  }
}

/**
 * 그 key 를 가리킬 수 있는 줄 id 전부. 헥사 코어는 이름이 같은 코어가 직업마다 있어 여럿이다. 직업을 모르고 기록을 찾을 때 쓴다.
 */
export function itemTargetIdsOf(type: CashbookItemTargetType, key: string): readonly string[] {
  if (type !== 'hexa_core') {
    const id = itemTargetIdOf(type, key)
    return id === null ? [] : [id]
  }
  const target = trimmed(key)
  return index()
    .cores.filter((core) => core.name === target)
    .map((core) => core.id)
}

/** 줄 id 의 품목 key. 레벨 줄이면 원래 반지의 key 와 레벨이고, 헥사 코어는 코어 이름이다. 모르는 줄은 `null` 이다. */
export function itemTargetKeyOf(type: CashbookItemTargetType, id: string): { key: string; ringLevel: number | null } | null {
  const ids = index()
  const keyOnly = (key: string | undefined) => (key === undefined ? null : { key, ringLevel: null })
  switch (type) {
    case 'item': {
      const item = findItemById(id)
      if (item === null) return null
      const level = ringLevelOf(item)
      return level === null ? { key: item.key, ringLevel: null } : { key: level.ring.key, ringLevel: level.ringLevel }
    }
    case 'hexa_core':
      return keyOnly(ids.coreNameById.get(id))
    case 'hunting_ground':
      return keyOnly(ids.huntingGrounds.keyById.get(id))
    case 'spend_item':
      return keyOnly(ids.spendItems.keyById.get(id))
    case 'symbol':
      return keyOnly(ids.symbols.keyById.get(id))
    case 'hexa_stat':
      return keyOnly(ids.hexaStats.keyById.get(id))
  }
}
