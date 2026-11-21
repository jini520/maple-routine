/**
 * 지출 참조표(`spendCatalog` 칸)를 읽는 자리. 화면이 표를 직접 안 뒤지게 하는 조회 함수들.
 *
 * 응답은 추가 리워드 종류 · 묶음 · 타일 · 항목 · 축 값이 줄 id 로 서로 가리키는 납작한 줄 표다. 여기서 항목 줄에 묶음 ·
 * 타일 · 분류의 key 와 축 값(`options`) · 추가 리워드 종류 key(`forms`)를 붙여 `SpendCatalogItem` 을 만들고, 그것을 분류 →
 * 묶음 → 항목으로 집어 주며 환산 둘(메포→메소 · 관세)을 든다.
 * 값은 사용자가 준 것이고 관리 화면이 고친다.
 *
 * **묶음을 앱이 다시 묶지 않는다.** `category` 는 앱이 정한 축이고 `group` 은 사용자가 적어 준 이름
 * 그대로다. 차례도 파일 순서를 지킨다. 이름순으로 정렬하면 `에픽던전 1단계 · 2단계` 처럼 의도한
 * 순서가 깨진다.
 *
 * 나눗셈은 둘 다 버린다. 이 저장소의 돈 계산이 그렇다.
 */
import type {
  SpendCatalogTable,
  SpendGroupRow,
  SpendItemOptionRow,
  SpendItemRewardTypeRow,
  SpendItemRow,
  SpendRewardTypeRow,
  SpendTileRow,
} from '../../types/game-data'
import { isEffectiveIn, periodOf, type EffectivePeriod } from '../boss/boss-profit-period'
import { resetWeekStartOf } from '../calendar'
import {
  compact,
  isBoolean,
  isNonEmptyString,
  isNonNegativeInteger,
  isOneOf,
  isPeriodText,
  isPositiveInteger,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { deriveAll, gameTable, type GameTable } from '../game-data/table'
import { gameRules } from '../game-rules'
import { cashbookCategoriesTable, findCashbookCategoryById, SPEND_FORM_KEYS, type SpendCategoryKey } from './categories'

/** 항목 줄. `from` · `until` 은 그 항목이 서는 기간이다(KST 날짜). */
export interface SpendCatalogItem extends EffectivePeriod {
  /** 기록이 이 항목을 가리키는 열쇠. 이름이 바뀌어도 그대로다. */
  readonly key: string
  /** 분류 key. */
  readonly category: string
  /** 묶음 key. */
  readonly group: string
  /** 타일 key. 같은 타일의 항목이 목록에서 한 칸으로 접힌다. */
  readonly tile: string
  /** 원본 이름. 하루 목록 카드에도 선다. */
  readonly name: string
  readonly currency: 'meso' | 'point'
  /** `null` 은 경매장 값이라 매번 다른 항목이고, 적을 때 개당 가격을 친다. */
  readonly unitPrice: number | null
  /** 가격 하나가 무엇 하나의 값인가. 회 · 개 · 포인트 · 시간. 수량 칸의 라벨이 된다. */
  readonly unit: string
  /**
   * 한 타일 안의 단계(1단계 · 공격력). 타일에 항목이 여럿이면 입력이 두 단계가 된다. 타일을 고르고
   * 그 안에서 단계를 고른다. 기록에는 안 적고 항목 key 로 되찾는다.
   */
  readonly tier?: string
  /**
   * 줄이 둘인 타일에서 이 항목이 드는 축 값. `{ 무기: '한손무기', 능력치: '마력' }`.
   *
   * 있으면 `tier` 가 없다. 고른 값이 한 항목의 축 값과 꼭 맞아야 그 항목이 정해진다(`optionItemOf`).
   */
  readonly options?: Readonly<Record<string, string>>
  /**
   * 값을 받는 형태(추가 리워드 종류) key 들(`exp` · `sol_erda`). **가격을 안 바꾼다.**
   *
   * 형태마다 단계를 따로 고르고 금액은 그 값들의 합이다. 하나를 고르는 축이 아니다.
   */
  readonly forms?: readonly string[]
  /**
   * 그 항목을 **한 형태**에서 샀을 때 받는 세라자르 주화 개수. 없으면 주화를 안 준다.
   *
   * 형태 둘을 다 사면 두 값을 더한다. 주화는 상점에 팔면 메소가 되므로 이 개수 × 판매가가
   * 지출에서 빠진다.
   */
  readonly rewardCoinQuantity?: number
  /**
   * 기록 한 건의 수량 상한. 사용자가 한도 문장에서 고른 숫자다.
   *
   * 문장을 파싱해 뽑지 않는다. 몬스터 파크의 문장은 축이 셋(월드당 14 · 캐릭터당 7 · 무료 2)이라
   * 어느 것이 한 건의 상한인지 **글에는 안 적혀 있다**. 앱이 고르면 그 고름이 추정이 된다
   * 사용자가 14 로 지정했다.
   *
   * 기간 누계가 아니다. 메이플 ID당 최대 2회 를 이틀에 걸쳐 한 번씩 적으면 기록이 둘이고 앱은
   * 그것을 합치지 않는다. 세는 것은 사람이 한다.
   */
  readonly maxQuantity?: number
}

/**
 * 목록의 **한 칸**(타일). 사용자가 1단계에서 고르는 단위다.
 *
 * 같은 타일의 항목들이 한 칸으로 접힌다(하이마운틴 1·2단계 → 하이마운틴). 그래서 `items` 가 둘
 * 이상이면 **고른 뒤 한 번 더 골라야 한다**.
 */
export interface SpendCatalogChoice {
  /** 타일 key. */
  readonly key: string
  /** 칸에 적히는 이름. */
  readonly label: string
  /** 아이템 그림이나 지역 아이콘의 id. 지역 아이콘은 에픽던전 넷의 것이라 타일에서 이름 옆에 선다. */
  readonly iconAssetId?: string
  readonly items: readonly SpendCatalogItem[]
}

export interface SpendCatalogGroup {
  /** 묶음 key. */
  readonly key: string
  /** 묶음 이름. 목록의 제목이다. */
  readonly group: string
  readonly choices: readonly SpendCatalogChoice[]
}

const CURRENCIES = ['point', 'meso'] as const

function toRewardType(row: Row): SpendRewardTypeRow | null {
  if (!isNonEmptyString(row.id) || !isOneOf(row.key, SPEND_FORM_KEYS) || !isNonEmptyString(row.name)) return null
  return { id: row.id, key: row.key, name: row.name }
}

// 분류는 앱이 폼을 모르는 key 도 온다. 그 분류는 시트에서 못 골라 묶음도 안 선다.
function toGroup(row: Row): SpendGroupRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  if (!isNonEmptyString(row.cardTitle) || !isNonEmptyString(row.cashbookCategoryId) || !isBoolean(row.isActive)) return null
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    cardTitle: row.cardTitle,
    cashbookCategoryId: row.cashbookCategoryId,
    isActive: row.isActive,
  }
}

function toTile(row: Row): SpendTileRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  const iconAssetId = optional(row.iconAssetId, isNonEmptyString)
  if (iconAssetId === false) return null
  return compact({ id: row.id, key: row.key, name: row.name, iconAssetId })
}

function toItem(row: Row): SpendItemRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  if (!isNonEmptyString(row.groupId) || !isNonEmptyString(row.tileId)) return null
  if (!isNonEmptyString(row.unit) || !isOneOf(row.currency, CURRENCIES)) return null
  // null 은 경매장 값이라 매번 다른 항목이다. 빠진 칸이 아니라 값이라 그대로 둔다.
  if (row.unitPrice !== null && !isNonNegativeInteger(row.unitPrice)) return null
  const tier = optional(row.tier, isNonEmptyString)
  const maxQuantity = optional(row.maxQuantity, isPositiveInteger)
  const rewardCoinQuantity = optional(row.rewardCoinQuantity, isPositiveInteger)
  const validFrom = optional(row.validFrom, isPeriodText)
  const validUntil = optional(row.validUntil, isPeriodText)
  if (tier === false || maxQuantity === false || rewardCoinQuantity === false || validFrom === false || validUntil === false) {
    return null
  }
  return compact({
    id: row.id,
    key: row.key,
    name: row.name,
    groupId: row.groupId,
    tileId: row.tileId,
    tier,
    currency: row.currency,
    unitPrice: row.unitPrice,
    unit: row.unit,
    maxQuantity,
    rewardCoinQuantity,
    validFrom,
    validUntil,
  })
}

function toOption(row: Row): SpendItemOptionRow | null {
  if (!isNonEmptyString(row.itemId) || !isNonEmptyString(row.axis) || !isNonEmptyString(row.value)) return null
  return { itemId: row.itemId, axis: row.axis, value: row.value }
}

function toItemRewardType(row: Row): SpendItemRewardTypeRow | null {
  if (!isNonEmptyString(row.itemId) || !isNonEmptyString(row.rewardTypeId)) return null
  return { itemId: row.itemId, rewardTypeId: row.rewardTypeId }
}

/**
 * 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다.
 *
 * 줄 id 로 가리키는 칸은 이 칸 안의 줄을 가리켜야 한다. 없는 묶음 · 타일을 가리키는 항목은 목록 어디에도 설 자리가 없다.
 */
export function parseSpendCatalog(value: unknown): SpendCatalogTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const spendRewardTypes = rowsOf(value.spendRewardTypes, toRewardType)
  const spendGroups = rowsOf(value.spendGroups, toGroup)
  const spendTiles = rowsOf(value.spendTiles, toTile)
  const spendItems = rowsOf(value.spendItems, toItem)
  const spendItemOptions = rowsOf(value.spendItemOptions, toOption, { allowEmpty: true })
  const spendItemRewardTypes = rowsOf(value.spendItemRewardTypes, toItemRewardType, { allowEmpty: true })
  if (
    spendRewardTypes === null ||
    spendGroups === null ||
    spendTiles === null ||
    spendItems === null ||
    spendItemOptions === null ||
    spendItemRewardTypes === null
  ) {
    return null
  }
  const keyed: readonly (readonly { id: string; key: string }[])[] = [spendRewardTypes, spendGroups, spendTiles, spendItems]
  if (keyed.some((rows) => !uniqueBy(rows, (row) => row.id) || !uniqueBy(rows, (row) => row.key))) return null
  const idsOf = (rows: readonly { id: string }[]) => new Set(rows.map((row) => row.id))
  const groupIds = idsOf(spendGroups)
  const tileIds = idsOf(spendTiles)
  const itemIds = idsOf(spendItems)
  const rewardTypeIds = idsOf(spendRewardTypes)
  if (spendItems.some((item) => !groupIds.has(item.groupId) || !tileIds.has(item.tileId))) return null
  if (spendItemOptions.some((option) => !itemIds.has(option.itemId))) return null
  if (spendItemRewardTypes.some((row) => !itemIds.has(row.itemId) || !rewardTypeIds.has(row.rewardTypeId))) return null
  return { updatedAt, spendRewardTypes, spendGroups, spendTiles, spendItems, spendItemOptions, spendItemRewardTypes }
}

export const spendCatalogTable = gameTable<SpendCatalogTable>(
  'spendCatalog',
  {
    updatedAt: null,
    spendRewardTypes: [],
    spendGroups: [],
    spendTiles: [],
    spendItems: [],
    spendItemOptions: [],
    spendItemRewardTypes: [],
  },
  parseSpendCatalog,
)

/** 묶음 줄을 key 로 찾은 모양. 분류는 key 로 바꿔 든다. */
interface GroupEntry {
  readonly name: string
  readonly cardTitle: string
  /** 분류 key. 모르는 분류 줄이면 빈 글자다. */
  readonly category: string
  readonly isActive: boolean
}

interface CatalogIndex {
  /** 항목 줄에 묶음 · 타일 · 분류 key 와 축 값 · 형태를 붙인 것. 차례는 표의 차례다. */
  readonly items: readonly SpendCatalogItem[]
  readonly groups: ReadonlyMap<string, GroupEntry>
  readonly tiles: ReadonlyMap<string, { readonly name: string; readonly iconAssetId?: string }>
  readonly formNames: ReadonlyMap<string, string>
}

const catalog = deriveAll([spendCatalogTable, cashbookCategoriesTable] as GameTable<unknown>[], (): CatalogIndex => {
  const table = spendCatalogTable.get()
  const groupById = new Map(table.spendGroups.map((group) => [group.id, group]))
  const tileById = new Map(table.spendTiles.map((tile) => [tile.id, tile]))
  const rewardTypeById = new Map(table.spendRewardTypes.map((type) => [type.id, type]))
  const groups = new Map(
    table.spendGroups.map((group): [string, GroupEntry] => [
      group.key,
      {
        name: group.name,
        cardTitle: group.cardTitle,
        category: findCashbookCategoryById(group.cashbookCategoryId)?.key ?? '',
        isActive: group.isActive,
      },
    ]),
  )
  const tiles = new Map(table.spendTiles.map((tile) => [tile.key, compact({ name: tile.name, iconAssetId: tile.iconAssetId })]))
  const optionsByItem = new Map<string, Record<string, string>>()
  for (const option of table.spendItemOptions) {
    const options = optionsByItem.get(option.itemId) ?? {}
    options[option.axis] = option.value
    optionsByItem.set(option.itemId, options)
  }
  const formsByItem = new Map<string, string[]>()
  for (const row of table.spendItemRewardTypes) {
    const form = rewardTypeById.get(row.rewardTypeId)?.key
    if (form === undefined) continue
    formsByItem.set(row.itemId, [...(formsByItem.get(row.itemId) ?? []), form])
  }
  const items = table.spendItems.map((row): SpendCatalogItem => {
    const group = groupById.get(row.groupId)
    return compact({
      key: row.key,
      category: group === undefined ? '' : (groups.get(group.key)?.category ?? ''),
      group: group?.key ?? '',
      tile: tileById.get(row.tileId)?.key ?? '',
      name: row.name,
      currency: row.currency,
      unitPrice: row.unitPrice,
      unit: row.unit,
      tier: row.tier,
      options: optionsByItem.get(row.id),
      forms: formsByItem.get(row.id),
      rewardCoinQuantity: row.rewardCoinQuantity,
      maxQuantity: row.maxQuantity,
      ...periodOf(row),
    })
  })
  const formNames = new Map(table.spendRewardTypes.map((type) => [type.key, type.name]))
  return { items, groups, tiles, formNames }
})

/** key 로 찾은 항목. 기간을 안 본다. 기록이 가리키는 항목은 지우지 않으니 옛 기록도 찾는다. */
export function spendItemOf(key: string): SpendCatalogItem | null {
  return catalog().items.find((item) => item.key === key) ?? null
}

/** 형태(추가 리워드 종류) 하나의 key 와 이름. 모르는 key 는 `null` 이다. 카탈로그가 적은 형태가 이름 표에 없을 수 있다. */
export function spendFormOf(key: string): { key: string; name: string } | null {
  const name = catalog().formNames.get(key)
  return name === undefined ? null : { key, name }
}

/**
 * 이름만 저장된 옛 기록의 형태 이름 · 짧은 이름. 그때 기록에 적힌 글자라 서버 표가 아니라 여기 고정한다.
 * 짧은 이름은 옛 하루 목록 줄 이름(`하이마운틴 EXP 1단계, 솔 2단계`)에 들어 있던 글자다.
 */
const LEGACY_FORMS = [
  { key: 'exp', name: '경험치', shortName: 'EXP' },
  { key: 'sol_erda', name: '솔 에르다', shortName: '솔' },
] as const

/** 관세율(%). **화면이 `* 1.1` 을 들면 게임 수치가 코드에 박히는 자리**가 된다. */
export function spendTariffPercent(): number {
  return gameRules().spendTariffPercent
}

/** 세라자르 주화 1개의 상점 판매가(메소). 규칙이라 표가 든다. */
export function rewardCoinPriceMeso(): number {
  return gameRules().rewardCoinPriceMeso
}

/**
 * 메포 지출에 쓰는 메소마켓 수수료율(%). 기록에 적힌 요율이 있으면 그것이고, 없으면 지금 규칙이다.
 *
 * 적힌 요율을 지금 규칙으로 덮으면 규칙이 바뀐 뒤 고친 지난 기록의 금액이 달라진다.
 *
 * @param stored 그 기록에 적힌 요율. 새 기록은 `undefined` 다
 */
export function mesoMarketFeeOf(stored: number | null | undefined): number {
  return stored ?? gameRules().mesoMarketFeePercent
}

/** 세라자르 주화. 에픽던전 추가 리워드가 주고 상점에 팔면 메소가 된다. 이름과 그림은 앱 상수이고 판매가는 `rewardCoinPriceMeso()` 다. */
export const SPEND_REWARD_COIN = { name: '세라자르 주화' } as const

const MESO_PER_RATE_UNIT = 100_000_000

/**
 * 분류 하나의 묶음들. **파일에 적힌 차례 그대로**다.
 *
 * 직접 입력 분류(아이템 구매 · 기타)는 목록이 없으므로 **빈 배열**이다. 예외가 아니라
 * 고를 것이 없다 는 사실이고, 화면은 그 분류에서 입력 칸을 그린다.
 *
 * 기간 밖의 항목은 뺀다. 기준은 오늘이 아니라 **적는 날짜**가 든 주간 기간이다. 항목이 하나도 안
 * 남은 묶음은 안 선다.
 *
 * 닫힌 묶음(`isActive: false`)도 안 선다. 지금 고를 수 있는 묶음만 남는다. 표에 없는 묶음은 열린 것이다.
 *
 * @param dateKey 적는 날짜(KST `YYYY-MM-DD`)
 */
export function spendGroupsOf(category: SpendCategoryKey, dateKey: string): SpendCatalogGroup[] {
  const periodKey = resetWeekStartOf(dateKey)
  return groupItems(
    catalog().items.filter(
      (item) =>
        item.category === category &&
        isEffectiveIn(item, periodKey) &&
        (catalog().groups.get(item.group)?.isActive ?? true),
    ),
  )
}

/**
 * 기간과 열림에 무관한 분류의 묶음들. 기록을 되짚는 자리만 쓴다.
 *
 * 기간이나 열림으로 거르면 출시 전 날짜로 적힌 기록이나 닫힌 묶음으로 적힌 기록을 수정 시트가 못 찾아 세부를 못 편다.
 */
function allSpendGroupsOf(category: string): SpendCatalogGroup[] {
  return groupItems(catalog().items.filter((item) => item.category === category))
}

function groupItems(items: readonly SpendCatalogItem[]): SpendCatalogGroup[] {
  const groups: {
    key: string
    group: string
    choices: { key: string; label: string; iconAssetId?: string; items: SpendCatalogItem[] }[]
  }[] = []
  for (const item of items) {
    let group = groups[groups.length - 1]
    if (group === undefined || group.key !== item.group) {
      group = { key: item.group, group: catalog().groups.get(item.group)?.name ?? item.group, choices: [] }
      groups.push(group)
    }

    // **같은 타일은 한 칸으로 접힌다**. 1단계·2단계가 목록에 둘로 서면 사용자가 고를 것이 여섯이
    // 되고, 그 여섯이 실은 셋 × 두 단계라는 사실이 화면에서 사라진다.
    const last = group.choices[group.choices.length - 1]
    if (last !== undefined && last.key === item.tile) {
      last.items.push(item)
      continue
    }
    const tile = catalog().tiles.get(item.tile)
    group.choices.push(compact({ key: item.tile, label: tile?.name ?? item.name, iconAssetId: tile?.iconAssetId, items: [item] }))
  }
  return groups
}

/**
 * 적어 둔 항목 key 에서 **고르던 자리를 되짚는다**.
 *
 * 기록에는 항목 key 만 있고 시트는 **대표와 단계 둘**을 든다. 수정으로 시트를 열려면 그 둘을
 * key 에서 되찾는다. 단계와 축 값은 항목이 들고 있다.
 *
 * **분류를 함께 받는다.** 분류가 다른 기록이 엉뚱한 목록으로 되살아나지 않게 한다.
 *
 * 못 찾으면 `null` 이다. 예외가 아니다. 카탈로그에서 사라진 항목이 기록에는 남아 있을 수 있고,
 * 그때 **시트가 안 열리는 것보다 값만 채워 여는 편이 낫다**(대가).
 */
export function findSpendChoice(
  category: string,
  itemKey: string | null,
): { choice: SpendCatalogChoice; item: SpendCatalogItem } | null {
  if (itemKey === null) return null
  for (const group of allSpendGroupsOf(category)) {
    for (const choice of group.choices) {
      const item = choice.items.find((each) => each.key === itemKey)
      if (item !== undefined) return { choice, item }
    }
  }
  return null
}

/**
 * 기록이 가리키는 항목의 묶음(`boss_buff` · `보스 버프`). 통계가 버프를 묶음별로 나눌 때 쓴다.
 *
 * 카탈로그에서 못 찾으면 `null` 이다.
 */
export function spendGroupOf(category: string, itemKey: string | null): { key: string; name: string } | null {
  const found = findSpendChoice(category, itemKey)
  if (found === null) return null
  return { key: found.item.group, name: catalog().groups.get(found.item.group)?.name ?? found.item.group }
}

/** 묶음의 하루 목록 카드 제목. 모르는 묶음은 `null` 이다. */
export function spendGroupCardTitleOf(groupKey: string): string | null {
  return catalog().groups.get(groupKey)?.cardTitle ?? null
}

/**
 * 안 사는 상태. 형태별 단계는 여기서 시작한다.
 *
 * 클리어하면 그냥 받는 **기본 보상**이라 참조표에 자리가 없다. 값이 0 인 항목이 아니라 항목이
 * 아닌 것이고, 그래서 형태가 전부 이 값이면 적을 지출이 없다.
 */
export const BASE_TIER = '0단계'

/** 한 대표 안에서 단계를 부르는 이름. `tier` 가 없는 항목은 제 이름이 곧 단계다. */
export function tierNameOf(item: SpendCatalogItem): string {
  return item.tier ?? item.name
}

/** 그 대표가 묻는 형태 key 들. 없으면 빈 배열이고 그때 화면은 단계 줄을 하나만 세운다. */
export function formsOf(choice: SpendCatalogChoice | null): readonly string[] {
  return choice?.items[0]?.forms ?? []
}

function itemOfTier(choice: SpendCatalogChoice, tier: string): SpendCatalogItem | undefined {
  return choice.items.find((each) => tierNameOf(each) === tier)
}

/**
 * 고른 단계 값의 **합**. 형태마다 따로 사기 때문이다 (사용자 확인 2026-09-10).
 *
 * 0단계와 모르는 단계는 0 이다. 안 고른 자리를 0 으로 두면 고르기 전에도 합계 줄이 그대로
 * 서고, 저장은 `buildSpendRewardName` 이 `null` 을 내는 것으로 막힌다.
 */
export function spendRewardPrice(
  choice: SpendCatalogChoice,
  tierByForm: Readonly<Record<string, string>>,
): number {
  return formsOf(choice).reduce((sum, form) => {
    const tier = tierByForm[form]
    return sum + (tier === undefined ? 0 : (itemOfTier(choice, tier)?.unitPrice ?? 0))
  }, 0)
}

/**
 * 고른 단계가 주는 세라자르 주화 개수의 **합**. 형태마다 각각 주기 때문이다 (사용자 제공 2026-09-16).
 *
 * 주화를 안 주는 대표와 0단계는 0 이다. 금액(`spendRewardPrice`)과 같은 축으로 세므로 둘이
 * 어긋날 자리가 없다.
 */
export function spendRewardCoins(
  choice: SpendCatalogChoice,
  tierByForm: Readonly<Record<string, string>>,
): number {
  return formsOf(choice).reduce((sum, form) => {
    const tier = tierByForm[form]
    return sum + (tier === undefined ? 0 : (itemOfTier(choice, tier)?.rewardCoinQuantity ?? 0))
  }, 0)
}

/** 주화 개수를 상점에 판 메소로. 지출에서 이만큼 뺀다. */
export function rewardCoinMeso(coins: number): number {
  return coins * rewardCoinPriceMeso()
}

/**
 * 형태별 단계를 이은 이름. `하이마운틴 경험치 1단계, 솔 에르다 2단계`.
 *
 * 하루 목록의 줄 이름이고 기록의 이름 칸에 그때 이름으로도 남는다. **0단계는 안 적는다**. 안 산
 * 것이 적히면 그 줄이 산 것으로 읽힌다.
 *
 * 고른 것이 없으면 `null` 이고, 그 `null` 이 곧 저장할 수 없다는 뜻이다.
 */
export function buildSpendRewardName(
  choice: SpendCatalogChoice,
  tierByForm: Readonly<Record<string, string>>,
): string | null {
  const parts = formsOf(choice).flatMap((form) => {
    const tier = tierByForm[form]
    if (tier === undefined || tier === BASE_TIER || itemOfTier(choice, tier) === undefined) return []
    return [`${spendFormOf(form)?.name ?? form} ${tier}`]
  })
  return parts.length === 0 ? null : `${choice.label} ${parts.join(', ')}`
}

/**
 * 기록에 적는 형태별 항목 key. `{ exp: 'high_mountain_1', sol_erda: 'high_mountain_2' }`.
 *
 * 0단계는 안 적는다. 고른 것이 없으면 `null` 이다.
 */
export function spendRewardItemKeys(
  choice: SpendCatalogChoice,
  tierByForm: Readonly<Record<string, string>>,
): Record<string, string> | null {
  const keys: Record<string, string> = {}
  for (const form of formsOf(choice)) {
    const tier = tierByForm[form]
    const item = tier === undefined || tier === BASE_TIER ? undefined : itemOfTier(choice, tier)
    if (item !== undefined) keys[form] = item.key
  }
  return Object.keys(keys).length === 0 ? null : keys
}

/**
 * 형태별 항목 key 에서 대표와 형태별 단계를 되짚는다. `spendRewardItemKeys` 의 역이다.
 *
 * 한 조각이라도 못 찾으면 `null` 이고 그때 화면은 목록을 세운다. 지어낸 단계로 시트를 열면 안 고른
 * 것이 골라진 채로 서고, 그대로 저장하면 그것이 참이 된다. 기간은 안 본다.
 */
export function findSpendRewardChoice(
  category: string,
  formItemKeys: Readonly<Record<string, string>> | null,
): { choice: SpendCatalogChoice; tierByForm: Record<string, string> } | null {
  if (formItemKeys === null) return null
  let choice: SpendCatalogChoice | null = null
  const tierByForm: Record<string, string> = {}
  for (const [form, itemKey] of Object.entries(formItemKeys)) {
    const found = findSpendChoice(category, itemKey)
    if (found === null || (choice !== null && found.choice.key !== choice.key)) return null
    if (!formsOf(found.choice).includes(form)) return null
    choice = found.choice
    tierByForm[form] = tierNameOf(found.item)
  }
  return choice === null ? null : { choice, tierByForm }
}

/**
 * 형태별 항목 key 를 그 대표의 형태별 단계로. 이 대표의 단계가 아니거나 대표에 없는 형태의 key 는 빼서, 그 형태는 0단계로 선다.
 *
 * 기억한 key 가 참조표에서 사라졌을 때 목록에 없는 단계가 줄에 남지 않게 하는 거름.
 */
export function spendRewardTiersOf(
  choice: SpendCatalogChoice,
  formItemKeys: Readonly<Record<string, string>>,
): Record<string, string> {
  const forms = formsOf(choice)
  const tierByForm: Record<string, string> = {}
  for (const [form, itemKey] of Object.entries(formItemKeys)) {
    const item = choice.items.find((each) => each.key === itemKey)
    if (item !== undefined && forms.includes(form)) tierByForm[form] = tierNameOf(item)
  }
  return tierByForm
}

/**
 * 이름만 저장된 옛 기록의 key. key 칸을 채우는 이관(`storage/sqlite`)만 쓴다.
 *
 * 옛 모양은 셋이다. ① 항목 이름 하나 ② 형태별 단계를 이은 이름(`하이마운틴 EXP 1단계, 솔 2단계`)
 * ③ 항목 이름과 형태 이름을 따로 든 행(`악몽선경 2단계` + `경험치`). 못 찾으면 둘 다 `null` 이고
 * 기록은 이름 그대로 남는다.
 */
export function legacySpendKeysOf(
  category: string,
  itemName: string | null,
  formName: string | null,
): { itemKey: string | null; formItemKeys: Record<string, string> | null } {
  const none = { itemKey: null, formItemKeys: null }
  if (itemName === null) return none
  for (const group of allSpendGroupsOf(category)) {
    for (const choice of group.choices) {
      // 옛 기록은 그때 앱에 서 있던 이름이라, 원본 이름으로 바뀐 항목은 줄인 이름으로 남아 있다.
      const item = choice.items.find((each) => each.name === itemName)
      if (item !== undefined) {
        const form = LEGACY_FORMS.find((each) => each.name === formName)
        if (formName === null || form === undefined || !formsOf(choice).includes(form.key)) {
          return formsOf(choice).length > 0 ? none : { itemKey: item.key, formItemKeys: null }
        }
        return { itemKey: null, formItemKeys: { [form.key]: item.key } }
      }

      const forms = formsOf(choice)
      if (forms.length === 0 || !itemName.startsWith(`${choice.label} `)) continue
      const keys: Record<string, string> = {}
      for (const part of itemName.slice(choice.label.length + 1).split(', ')) {
        const cut = part.lastIndexOf(' ')
        const form = forms.find(
          (each) => (LEGACY_FORMS.find((legacy) => legacy.key === each)?.shortName ?? each) === part.slice(0, cut),
        )
        const found = cut < 0 || form === undefined ? undefined : itemOfTier(choice, part.slice(cut + 1))
        if (form === undefined || found === undefined) return none
        keys[form] = found.key
      }
      return { itemKey: null, formItemKeys: keys }
    }
  }
  return none
}

/** 축 하나와 그 값들. 폼의 줄 하나가 된다. */
export interface SpendOptionAxis {
  readonly axis: string
  readonly values: readonly string[]
}

/**
 * 대표가 묻는 축들. 줄의 차례와 값의 차례는 항목들에 처음 나온 차례다.
 *
 * 축 값이 없는 대표는 빈 배열이고, 그때 화면은 단계 줄을 세운다.
 */
export function optionAxesOf(choice: SpendCatalogChoice | null): SpendOptionAxis[] {
  const axes: { axis: string; values: string[] }[] = []
  for (const item of choice?.items ?? []) {
    for (const [axis, value] of Object.entries(item.options ?? {})) {
      let entry = axes.find((each) => each.axis === axis)
      if (entry === undefined) {
        entry = { axis, values: [] }
        axes.push(entry)
      }
      if (!entry.values.includes(value)) entry.values.push(value)
    }
  }
  return axes
}

/**
 * 한 값을 누른 뒤의 고른 값들. 넷을 차례로 한다.
 *
 * ① 그 값을 가진 항목만 남긴다. ② 다른 축에서 고른 값이 남은 항목에 없으면 지운다. ③ 남은
 * 항목이 다른 축에 값을 하나만 가지면 그 값을 고른다. ④ 남은 항목이 그 축을 아예 안 가지면 그
 * 축은 잠긴다(`isOptionAxisOpen`). 규칙을 타일마다 적지 않는 것은 주문서가 늘 때마다 코드를
 * 고치지 않기 위해서다.
 */
export function pickSpendOption(
  choice: SpendCatalogChoice,
  picked: Readonly<Record<string, string>>,
  axis: string,
  value: string,
): Record<string, string> {
  let remaining = choice.items.filter((item) => item.options?.[axis] === value)
  const next: Record<string, string> = { [axis]: value }

  for (const [other, chosen] of Object.entries(picked)) {
    if (other === axis) continue
    const narrowed = remaining.filter((item) => item.options?.[other] === chosen)
    if (narrowed.length === 0) continue
    next[other] = chosen
    remaining = narrowed
  }

  for (const { axis: other } of optionAxesOf(choice)) {
    if (next[other] !== undefined) continue
    const values = new Set(remaining.map((item) => item.options?.[other]))
    const [only] = values
    if (values.size === 1 && only !== undefined) next[other] = only
  }
  return next
}

/**
 * 그 축을 지금 누를 수 있나. 다른 축에서 고른 값에 맞는 항목 중 하나라도 그 축을 가지면 열려 있다.
 *
 * 귀 장식에서 마력을 고르면 스탯이 없는 항목만 남아 스탯 축이 잠긴다.
 */
export function isOptionAxisOpen(
  choice: SpendCatalogChoice,
  picked: Readonly<Record<string, string>>,
  axis: string,
): boolean {
  return choice.items.some(
    (item) =>
      item.options?.[axis] !== undefined &&
      Object.entries(picked).every(([other, chosen]) => other === axis || item.options?.[other] === chosen),
  )
}

/**
 * 고른 값이 가리키는 항목. 한 항목의 축 값과 **꼭 맞아야** 정해진다. 못 정하면 `null` 이고 그것이
 * 곧 저장할 수 없다는 뜻이다.
 */
export function optionItemOf(
  choice: SpendCatalogChoice,
  picked: Readonly<Record<string, string>>,
): SpendCatalogItem | null {
  const pickedAxes = Object.keys(picked)
  const matches = choice.items.filter((item) => {
    const options = item.options
    if (options === undefined) return false
    const axes = Object.keys(options)
    return axes.length === pickedAxes.length && axes.every((axis) => picked[axis] === options[axis])
  })
  return matches.length === 1 ? matches[0]! : null
}

/**
 * 받은 메포를 메소로 바꾼 값. 메포로 메소를 사는 쪽이라 수수료가 없다.
 *
 * ```
 * 메소 = 메포 × 100,000,000 ÷ 시세
 * ```
 *
 * 곱셈으로 짜면 결과가 **1억 배** 어긋난다. 컬럼 이름을 `meso_per_point` 에서
 * `point_per_100m_meso` 로 고친 이유가 그것이다.
 *
 * 시세가 0 이하면 **0 을 돌려준다.** 어댑터가 저장을 막지만(`storage/spend.ts`) 화면은 입력
 * 중간에 0 을 들고 있을 수 있고, 그때 `Infinity` 가 금액 칸에 들어가면 화면이 깨진다.
 */
export function pointToMeso(pointAmount: number, pointPer100mMeso: number): number {
  if (pointPer100mMeso <= 0) return 0
  return Math.floor((pointAmount * MESO_PER_RATE_UNIT) / pointPer100mMeso)
}

/**
 * 메소 `hundredMillions` 억을 메소마켓에 팔아 받는 메포. 수수료를 떼고 소수점은 올린다.
 *
 * @param mesoMarketFeePercent 판매 수수료율. `null` 은 0 이다
 */
export function receivedPointOf(hundredMillions: number, pointPer100mMeso: number, mesoMarketFeePercent: number | null): number {
  const scaled = hundredMillions * pointPer100mMeso * (100 - (mesoMarketFeePercent ?? 0))
  return Math.floor((scaled + 99) / 100)
}

/**
 * 메포 지출의 메소. 필요한 메포를 받을 수 있는 가장 적은 억 수를 팔았다고 보고, 쓰고 남은 메포는 수수료 없이 메소로 되돌려 뺀다.
 *
 * 시세가 0 이하이거나 요율이 100 이상이면 0 이다.
 *
 * @param mesoMarketFeePercent 그 기록의 메소마켓 수수료율. 요율 없는 옛 기록은 `null` 이고 수수료 0 으로 센다
 */
export function spentPointToMeso(pointAmount: number, pointPer100mMeso: number, mesoMarketFeePercent: number | null): number {
  const keep = 100 - (mesoMarketFeePercent ?? 0)
  if (pointAmount <= 0 || pointPer100mMeso <= 0 || keep <= 0) return 0
  let sold = Math.max(1, Math.ceil((pointAmount * 100) / (pointPer100mMeso * keep)))
  while (sold > 1 && receivedPointOf(sold - 1, pointPer100mMeso, mesoMarketFeePercent) >= pointAmount) sold -= 1
  while (receivedPointOf(sold, pointPer100mMeso, mesoMarketFeePercent) < pointAmount) sold += 1
  const left = receivedPointOf(sold, pointPer100mMeso, mesoMarketFeePercent) - pointAmount
  return sold * MESO_PER_RATE_UNIT - pointToMeso(left, pointPer100mMeso)
}

/**
 * 구입가에 붙는 관세(메소). **시세를 안 물어도 된다**. 관세가 메소 가치 기준 10% 라
 * 메소마켓 시세가 양변에서 상쇄된다.
 */
export function tariffMesoOf(priceMeso: number): number {
  return Math.floor((priceMeso * spendTariffPercent()) / 100)
}

/**
 * 저장에 들어갈 **두 값**. 총액과 그중 관세분.
 *
 * 총액을 함께 내는 이유는 집계가 `meso_amount` 한 칸만 보면 되게 하기 위해서다(관세를 빠뜨려
 * 덜 세는 사고가 구조적으로 없어진다). 관세분을 따로 박는 이유는 요율이 바뀌는 날 **지난달
 * 관세가 소급해 달라지지 않게** 하기 위해서다.
 *
 * 더해서 만들고 빼서 되돌릴 수 있다. `mesoAmount - tariffMeso === priceMeso` 가 언제나 참이다.
 */
export function withTariffMeso(priceMeso: number): { mesoAmount: number; tariffMeso: number } {
  const tariffMeso = tariffMesoOf(priceMeso)
  return { mesoAmount: priceMeso + tariffMeso, tariffMeso }
}
