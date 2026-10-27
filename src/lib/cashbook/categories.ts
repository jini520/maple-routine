/**
 * 가계부의 갈래 · 아이템 종류를 읽는 자리(`cashbookCategories` 칸). 에픽던전 형태는 지출 목록 칸이 든다
 * (`lib/cashbook/spend-catalog`).
 *
 * 이름 · 카드 제목 · 그림 · 설명 · 단위는 서버 표가 들고 관리 화면이 고친다. 기록은 key 를 저장하고 화면은 이 표에서
 * 이름을 찾으므로, 이름을 바꿔도 옛 기록이 따라온다.
 *
 * key 목록은 여기 코드에 남는다. 앱이 그 key 로 입력 폼을 가르기 때문이다. 서버가 더한 갈래는 key 가 이 목록에
 * 없어 목록에 이름만 서고 못 고른다. 앱에 그 폼이 생길 때까지다.
 */
import type { CashbookCategoriesTable, CashbookCategoryRow, CashbookItemKindRow } from '../../types/game-data'
import {
  compact,
  isBoolean,
  isNonEmptyString,
  isOneOf,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { gameTable, derive } from '../game-data/table'

/** 앱이 입력 폼을 아는 지출 갈래. 차례는 서버 표가 정한다. */
export const SPEND_CATEGORY_KEYS = ['content', 'event_bm', 'buff', 'scroll', 'symbol', 'item_purchase', 'etc'] as const
export type SpendCategoryKey = (typeof SPEND_CATEGORY_KEYS)[number]

/** 앱이 입력 폼을 아는 수익 갈래. 서버 표의 맨 앞이 기본 갈래다. */
export const INCOME_CATEGORY_KEYS = ['hunting', 'sol_erda_fragment', 'item_sale', 'etc'] as const
export type IncomeCategoryKey = (typeof INCOME_CATEGORY_KEYS)[number]

/** 아이템 구매 · 판매의 종류. 게임 인벤토리 탭이다. 수량 · 관세는 서버 표의 단위 · 관세 칸이 가른다. */
export const ITEM_KIND_KEYS = ['equipment', 'consumable', 'etc'] as const
export type ItemKindKey = (typeof ITEM_KIND_KEYS)[number]

/** 에픽던전 추가 리워드가 값을 받는 형태. 이름은 지출 목록 칸의 `forms` 가 든다. */
export const SPEND_FORM_KEYS = ['exp', 'sol_erda'] as const
export type SpendFormKey = (typeof SPEND_FORM_KEYS)[number]

/** 갈래 하나. `known` 이 거짓이면 앱에 그 입력 폼이 없어 못 고른다. */
export interface CashbookCategory<K extends string = string> {
  readonly key: K
  readonly name: string
  /** 하루 목록 카드 첫 줄. 묶음이 있는 지출 갈래는 묶음의 카드 제목이 대신 선다. */
  readonly cardTitle: string
  /** `src/assets/items/` 의 파일명. */
  readonly icon: string
  /**
   * 갈래 카드에만 서는 한 줄. 넘치면 말줄임표로 잘린다. 기기마다 가로 비율이 달라 다 들어간다고 못 박을 수가
   * 없고, 잘리는 쪽을 받기로 했다(사용자 지정 2026-09-21).
   */
  readonly description: string
  /** 묶음이 없는 갈래의 수량 단위(사냥의 소재 등). */
  readonly unit?: string
  readonly known: boolean
}

export interface ItemKind {
  readonly key: ItemKindKey
  readonly name: string
  /** 수량 단위. 없으면 수량이 없다. */
  readonly unit?: string
  readonly hasTariff: boolean
}

const ENTRY_TYPES = ['income', 'spend'] as const

function toCategory(row: Row): CashbookCategoryRow | null {
  if (!isOneOf(row.entryType, ENTRY_TYPES) || !isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  if (!isNonEmptyString(row.cardTitle) || !isNonEmptyString(row.iconFile) || typeof row.description !== 'string') return null
  const unit = optional(row.unit, isNonEmptyString)
  if (unit === false) return null
  return compact({
    entryType: row.entryType,
    key: row.key,
    name: row.name,
    cardTitle: row.cardTitle,
    iconFile: row.iconFile,
    description: row.description,
    unit,
  })
}

function toItemKind(row: Row): CashbookItemKindRow | null {
  if (!isNonEmptyString(row.key) || !isNonEmptyString(row.name) || !isBoolean(row.hasTariff)) return null
  const unit = optional(row.unit, isNonEmptyString)
  if (unit === false) return null
  return compact({ key: row.key, name: row.name, unit, hasTariff: row.hasTariff })
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다. */
export function parseCashbookCategories(value: unknown): CashbookCategoriesTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const categories = rowsOf(value.categories, toCategory)
  const itemKinds = rowsOf(value.itemKinds, toItemKind)
  if (categories === null || itemKinds === null) return null
  if (!uniqueBy(categories, (each) => `${each.entryType}.${each.key}`) || !uniqueBy(itemKinds, (each) => each.key)) {
    return null
  }
  return { updatedAt, categories, itemKinds }
}

export const cashbookCategoriesTable = gameTable('cashbookCategories', { updatedAt: null, categories: [], itemKinds: [] }, parseCashbookCategories)

function categoryOf<K extends string>(row: CashbookCategoryRow, knownKeys: readonly K[]): CashbookCategory {
  return compact({
    key: row.key,
    name: row.name,
    cardTitle: row.cardTitle,
    icon: row.iconFile,
    description: row.description,
    unit: row.unit,
    known: (knownKeys as readonly string[]).includes(row.key),
  })
}

const index = derive(cashbookCategoriesTable, (table) => ({
  spend: table.categories.filter((row) => row.entryType === 'spend').map((row) => categoryOf(row, SPEND_CATEGORY_KEYS)),
  income: table.categories.filter((row) => row.entryType === 'income').map((row) => categoryOf(row, INCOME_CATEGORY_KEYS)),
  itemKinds: table.itemKinds
    .filter((row): row is CashbookItemKindRow & { key: ItemKindKey } => isOneOf(row.key, ITEM_KIND_KEYS))
    .map((row): ItemKind => compact({ key: row.key, name: row.name, unit: row.unit, hasTariff: row.hasTariff })),
}))

/** 지출 갈래. **차례가 곧 화면**이다. */
export function spendCategories(): readonly CashbookCategory[] {
  return index().spend
}

/** 수익 갈래. **차례가 곧 화면**이고 앱이 아는 첫 갈래가 기본 갈래다. */
export function incomeCategories(): readonly CashbookCategory[] {
  return index().income
}

/** 아이템 종류. 앱이 모르는 key 는 뺀다. 수량 · 관세를 가를 수 없어서다. */
export function itemKinds(): readonly ItemKind[] {
  return index().itemKinds
}

/** 표에 없는 key 는 key 글자 그대로다. 서버에서 갈래가 사라지지는 않지만 옛 사본에 없을 수 있다. */
export function spendCategoryNameOf(key: string): string {
  return spendCategories().find((each) => each.key === key)?.name ?? key
}

export function incomeCategoryNameOf(key: string): string {
  return incomeCategories().find((each) => each.key === key)?.name ?? key
}

export function itemKindNameOf(key: ItemKindKey): string {
  return itemKinds().find((each) => each.key === key)?.name ?? key
}

/** 갈래 하나. 표에 없는 key 는 `null` 이다. */
export function cashbookCategoryOf(entryType: 'income' | 'spend', key: string): CashbookCategory | null {
  const list = entryType === 'income' ? incomeCategories() : spendCategories()
  return list.find((each) => each.key === key) ?? null
}

/** 아이템 종류의 수량 단위. 장비처럼 수량이 없으면 `undefined` 다. */
export function itemKindUnitOf(kind: ItemKindKey): string | undefined {
  return itemKinds().find((each) => each.key === kind)?.unit
}

/** 곱할 수량이 있는가. 단위가 있는 종류만 수량을 센다. */
export function countsQuantity(kind: ItemKindKey): boolean {
  return itemKinds().find((each) => each.key === kind)?.unit !== undefined
}

/** 구매 관세가 붙는 종류인가. 월드 간 거래가 되는 종류만 붙는다. */
export function hasTariff(kind: ItemKindKey): boolean {
  return itemKinds().find((each) => each.key === kind)?.hasTariff ?? false
}

/**
 * 이름만 저장된 옛 기록의 이름 → key. key 칸을 채우는 이관(`storage/sqlite`)만 쓴다.
 *
 * 그때 기록에 적힌 이름이라 서버 표가 아니라 여기 고정한다. 서버에서 이름을 바꾸면 옛 이름을 못 찾는다.
 */
const LEGACY_SPEND_CATEGORY_NAMES: Readonly<Record<string, SpendCategoryKey>> = {
  컨텐츠: 'content',
  '이벤트·BM': 'event_bm',
  버프: 'buff',
  주문서: 'scroll',
  '심볼 강화': 'symbol',
  '아이템 구매': 'item_purchase',
  기타: 'etc',
}
const LEGACY_INCOME_CATEGORY_NAMES: Readonly<Record<string, IncomeCategoryKey>> = {
  사냥: 'hunting',
  '솔 에르다 조각': 'sol_erda_fragment',
  '아이템 판매': 'item_sale',
  기타: 'etc',
}
const LEGACY_ITEM_KIND_NAMES: Readonly<Record<string, ItemKindKey>> = { 장비: 'equipment', 소비: 'consumable', 기타: 'etc' }

export function spendCategoryKeyOfName(name: string): SpendCategoryKey | null {
  return LEGACY_SPEND_CATEGORY_NAMES[name] ?? null
}

export function incomeCategoryKeyOfName(name: string): IncomeCategoryKey | null {
  return LEGACY_INCOME_CATEGORY_NAMES[name] ?? null
}

export function itemKindKeyOfName(name: string): ItemKindKey | null {
  return LEGACY_ITEM_KIND_NAMES[name] ?? null
}
