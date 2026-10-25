/**
 * 화면이 쓰는 기록 모양(`SpendRecord` · `IncomeRecord`)과 가계부 기록 표 셋의 행을 서로 옮기는 자리.
 *
 * 저장 함수(`spend.ts` · `income.ts`)와 버전 15 이관(`sqlite/migrations.ts`)이 같은 변환을 쓴다. DB 를 안 열어서
 * 이관이 이것을 읽어도 순환이 안 생긴다.
 */
import { SPEND_FORM_KEYS, type IncomeCategoryKey, type ItemKindKey, type SpendCategoryKey } from '../lib/cashbook/categories'
import { UNION_TIERS, type UnionTier } from '../lib/cashbook/hunting-meso'
import type { FeePercent } from '../lib/cashbook/item-split'
import { spendItemOf } from '../lib/cashbook/spend-catalog'
import { EMPTY_ITEM, type EntryHunt, type EntryItem, type StoredEntry } from './cashbook-entries'
import type { HuntingIncomeDetail, IncomeRecord } from './income'
import type { SpendRecord } from './spend'

/**
 * 금액 하나를 가중치대로 나눈다. 버린 나머지는 첫 몫에 붙여 합이 원래 값과 같다.
 *
 * 가중치가 하나라도 0 이하이면 전부 첫 몫이다. 단가를 모르는 항목에 몫을 지어내지 않는다.
 */
export function splitAmount(amount: number | null, weights: readonly number[]): Array<number | null> {
  if (amount === null) return weights.map(() => null)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (weights.length === 1 || total <= 0 || weights.some((weight) => weight <= 0)) {
    return weights.map((_, index) => (index === 0 ? amount : 0))
  }
  const parts = weights.map((weight) => Math.floor((amount * weight) / total))
  parts[0] = parts[0]! + amount - parts.reduce((sum, part) => sum + part, 0)
  return parts
}

/** 기록 → 품목. 에픽던전 리워드는 형태 차례대로 형태마다 품목 하나이고 금액은 그 단계의 단가로 나눈다. */
export function spendItemsOf(record: SpendRecord): EntryItem[] {
  const base: EntryItem = {
    ...EMPTY_ITEM,
    itemKindKey: record.itemKind,
    quantity: record.quantity,
    fromLevel: record.levelFrom,
    toLevel: record.levelTo,
    amountMeso: record.mesoAmount,
    tariffMeso: record.tariffMeso,
    amountPoint: record.pointAmount,
    pointPer100mMeso: record.pointPer100mMeso,
    amountCash: record.cashAmount,
  }
  const forms = SPEND_FORM_KEYS.filter((form) => record.formItemKeys?.[form] !== undefined)
  if (forms.length === 0) {
    return [{ ...base, itemKey: record.itemKey, itemName: record.itemKey === null ? record.item : null }]
  }
  const keys = forms.map((form) => record.formItemKeys![form]!)
  const weights = keys.map((key) => spendItemOf(key)?.unitPrice ?? 0)
  const meso = splitAmount(record.mesoAmount, weights)
  const tariff = splitAmount(record.tariffMeso, weights)
  const point = splitAmount(record.pointAmount, weights)
  const cash = splitAmount(record.cashAmount, weights)
  return forms.map((form, index) => ({
    ...base,
    itemKey: keys[index]!,
    formKey: form,
    amountMeso: meso[index]!,
    tariffMeso: tariff[index]!,
    amountPoint: point[index]!,
    amountCash: cash[index]!,
  }))
}

export function spendEntryOf(record: SpendRecord): StoredEntry {
  return {
    head: {
      id: record.id,
      ocid: record.ocid,
      entryType: 'spend',
      categoryKey: record.category,
      entryDate: record.spentOn,
      memo: record.memo,
      createdAt: record.recordedAt,
    },
    items: spendItemsOf(record),
    hunt: null,
  }
}

/** 품목 칸 하나의 합. 전부 비면 `null` 이다. 0 과 빈 칸이 갈린다. */
function sumOf(items: readonly EntryItem[], pick: (item: EntryItem) => number | null): number | null {
  const values = items.map(pick).filter((value): value is number => value !== null)
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0)
}

export function spendRecordOf(entry: StoredEntry): SpendRecord {
  const first = entry.items[0]!
  const forms = entry.items.filter((item) => item.formKey !== null && item.itemKey !== null)
  return {
    id: entry.head.id,
    ocid: entry.head.ocid,
    spentOn: entry.head.entryDate,
    category: entry.head.categoryKey as SpendCategoryKey,
    item: first.itemName,
    itemKey: forms.length > 0 ? null : first.itemKey,
    formItemKeys: forms.length > 0 ? Object.fromEntries(forms.map((item) => [item.formKey!, item.itemKey!])) : null,
    itemKind: first.itemKindKey as ItemKindKey | null,
    levelFrom: first.fromLevel,
    levelTo: first.toLevel,
    quantity: first.quantity,
    mesoAmount: sumOf(entry.items, (item) => item.amountMeso),
    tariffMeso: sumOf(entry.items, (item) => item.tariffMeso),
    pointAmount: sumOf(entry.items, (item) => item.amountPoint),
    pointPer100mMeso: first.pointPer100mMeso,
    cashAmount: sumOf(entry.items, (item) => item.amountCash),
    memo: entry.head.memo,
    recordedAt: entry.head.createdAt,
  }
}

/**
 * 사냥 입력 행 ↔ 한 덩어리. 어느 모양인지는 **칸 둘이 가른다**.
 *
 * `typed_meso` 가 있으면 수동이고, 없는데 `missed_mobs` 가 있으면 계산기다. 둘 다 없으면 계산 입력이 없던 때 적힌
 * 행이라 `null` 이고, 그 행은 수동 입력 폼이 합계를 그대로 받아 연다.
 *
 * **친 메소가 `0` 이어도 수동이다.** 조각만 먹은 사냥이 그렇다. `0` 과 `NULL` 이 갈리는 자리라 `??` 로 접으면 그
 * 행이 계산기 행으로 둔갑한다. 소재 수는 품목의 수량 칸이 든다.
 */
function huntOf(hunt: EntryHunt | null, sojae: number | null): HuntingIncomeDetail | null {
  if (hunt === null) return null
  if (hunt.typedMeso !== null) {
    return {
      mode: 'manual',
      typedMeso: hunt.typedMeso,
      fragments: hunt.fragments ?? 0,
      fragmentPrice: hunt.fragmentPrice,
    }
  }
  if (hunt.missedMobs === null) return null
  return {
    mode: 'calculator',
    characterLevel: hunt.characterLevel,
    missedMobs: hunt.missedMobs,
    boosts: hunt.boosts === null || hunt.boosts === '' ? [] : hunt.boosts.split(','),
    sojae: sojae ?? 0,
    fragments: hunt.fragments ?? 0,
    // `0` 으로 접지 않는다. 0 은 0 메소에 판 것이고 `NULL` 은 보관이다.
    fragmentPrice: hunt.fragmentPrice,
    // **`NULL` 은 메획 칸이 생기기 전 행**이고 0 으로 읽는다. 없는 값을 지어내면 옛 기록의 금액이 지금 세는 값과 안 맞는다.
    mesoRate: hunt.mesoRate ?? 0,
    unionTier: unionTierOf(hunt.unionTier),
  }
}

function unionTierOf(value: unknown): UnionTier {
  return UNION_TIERS.includes(value as UnionTier) ? (value as UnionTier) : 3
}

/** 한 덩어리 → 사냥 입력 행. **수동 행은 계산기 칸을 비운다**. 0 을 채우면 놓친 마릿수 0 으로 센 행처럼 읽힌다. */
function huntRowOf(hunt: HuntingIncomeDetail | null): EntryHunt | null {
  if (hunt === null) return null
  if (hunt.mode === 'manual') {
    return {
      characterLevel: null,
      missedMobs: null,
      boosts: null,
      fragments: hunt.fragments,
      fragmentPrice: hunt.fragmentPrice,
      mesoRate: null,
      typedMeso: hunt.typedMeso,
      unionTier: null,
    }
  }
  return {
    characterLevel: hunt.characterLevel,
    missedMobs: hunt.missedMobs,
    boosts: hunt.boosts.join(','),
    fragments: hunt.fragments,
    fragmentPrice: hunt.fragmentPrice,
    mesoRate: hunt.mesoRate,
    typedMeso: null,
    unionTier: hunt.unionTier,
  }
}

export function incomeEntryOf(record: IncomeRecord): StoredEntry {
  const sojae = record.hunt?.mode === 'calculator' ? record.hunt.sojae : null
  return {
    head: {
      id: record.id,
      ocid: record.ocid,
      entryType: 'income',
      categoryKey: record.category,
      entryDate: record.earnedOn,
      memo: record.memo,
      createdAt: record.recordedAt,
    },
    items: [
      {
        ...EMPTY_ITEM,
        itemKey: record.itemKey,
        itemName: record.itemKey === null ? record.item : null,
        itemKindKey: record.itemKind,
        // 사냥의 수량은 소재 수다. 그 줄의 단위(소재)를 갈래 표가 든다.
        quantity: record.category === 'hunting' ? sojae : record.quantity,
        amountMeso: record.mesoAmount,
        saleFeePercent: record.saleFeePercent,
        saleFeeMeso: record.saleFeeMeso,
        saleFeeAuto: record.saleFeeAuto,
        amountPoint: record.pointAmount,
        pointPer100mMeso: record.pointPer100mMeso,
        amountCash: record.cashAmount,
      },
    ],
    hunt: huntRowOf(record.hunt),
  }
}

export function incomeRecordOf(entry: StoredEntry): IncomeRecord {
  const item = entry.items[0]!
  const hunting = entry.head.categoryKey === 'hunting'
  return {
    id: entry.head.id,
    ocid: entry.head.ocid,
    earnedOn: entry.head.entryDate,
    category: entry.head.categoryKey as IncomeCategoryKey,
    item: item.itemName,
    itemKey: item.itemKey,
    mesoAmount: item.amountMeso,
    pointAmount: item.amountPoint,
    pointPer100mMeso: item.pointPer100mMeso,
    cashAmount: item.amountCash,
    quantity: hunting ? null : item.quantity,
    itemKind: item.itemKindKey as ItemKindKey | null,
    saleFeePercent: item.saleFeePercent as FeePercent | null,
    saleFeeMeso: item.saleFeeMeso,
    saleFeeAuto: item.saleFeeAuto,
    hunt: huntOf(entry.hunt, hunting ? item.quantity : null),
    memo: entry.head.memo,
    recordedAt: entry.head.createdAt,
  }
}

