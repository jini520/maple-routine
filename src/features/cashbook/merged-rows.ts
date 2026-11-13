/**
 * 하루 목록에서 헥사 매트릭스 · 아이템 구매 기록을 캐릭터마다 한 줄로 합치는 일.
 *
 * 기록 원장(`ledgerDays`)은 그대로 기록마다 하나다. today · 통계가 같은 원장을 읽기 때문이다.
 */
import { getAssetImage } from '../../lib/assets/asset-lookup'
import { cashbookCategoryOf, type SpendCategoryKey } from '../../lib/cashbook/categories'
import type { ImageAssetRef } from '../../types/image-asset'
import { spendMesoOf, type DayRecord, type ManualDayRecord, type RecordCard } from './records'
import { recordIconOf } from './row-icon'

const MERGED_CATEGORIES = ['hexa_matrix', 'item_purchase'] as const

export type MergedCategory = (typeof MERGED_CATEGORIES)[number]

export type SpendDayRecord = Extract<ManualDayRecord, { kind: 'spend' }>

/** 같은 날 · 같은 캐릭터 · 같은 갈래의 기록 둘 이상을 묶은 줄. */
export interface MergedDayRow {
  kind: 'merged'
  category: MergedCategory
  ocid: string
  characterName: string
  /** 적은 순 */
  records: readonly SpendDayRecord[]
}

export type DayRow = DayRecord | MergedDayRow

function isMergedCategory(category: SpendCategoryKey): category is MergedCategory {
  return (MERGED_CATEGORIES as readonly string[]).includes(category)
}

interface MergeTarget {
  key: string
  entry: SpendDayRecord
}

function mergeTargetOf(entry: DayRecord): MergeTarget | null {
  if (entry.kind !== 'spend') return null
  const { category, ocid } = entry.record
  // 캐릭터가 없는 옛 기록은 누구 것인지 몰라 묶지 않는다.
  if (ocid === null || !isMergedCategory(category)) return null
  return { key: `${category}:${ocid}`, entry }
}

function byRecordedAt(left: SpendDayRecord, right: SpendDayRecord): number {
  return left.record.recordedAt.localeCompare(right.record.recordedAt)
}

/**
 * 묶을 기록을 합친 줄로 바꾼 그날 줄. 묶음이 한 건이면 그 줄 그대로다.
 *
 * 합친 줄의 자리는 묶인 기록 가운데 가장 먼저 적은 기록의 자리.
 */
export function mergeDayRows(records: readonly DayRecord[]): DayRow[] {
  const groups = new Map<string, SpendDayRecord[]>()
  for (const entry of records) {
    const target = mergeTargetOf(entry)
    if (target === null) continue
    const group = groups.get(target.key)
    if (group === undefined) groups.set(target.key, [target.entry])
    else group.push(target.entry)
  }
  for (const group of groups.values()) group.sort(byRecordedAt)

  const rows: DayRow[] = []
  for (const entry of records) {
    const target = mergeTargetOf(entry)
    const group = target === null ? undefined : groups.get(target.key)
    if (group === undefined || group.length < 2) {
      rows.push(entry)
      continue
    }
    const [first] = group
    if (first !== entry) continue
    rows.push({
      kind: 'merged',
      category: first.record.category as MergedCategory,
      ocid: first.record.ocid as string,
      characterName: first.characterName,
      records: group,
    })
  }
  return rows
}

/** 펼침 상태가 쓰는 줄의 신원. 기록 줄의 신원(기록 `id`)과 겹치지 않는다. */
export function mergedRowKeyOf(row: MergedDayRow): string {
  return `merged:${row.category}:${row.ocid}`
}

/** 첫 줄은 기록 줄과 같은 `캐릭터 · 갈래 카드 제목`, 둘째 줄은 묶인 건수. */
export function mergedRowCardOf(row: MergedDayRow): RecordCard {
  const title = cashbookCategoryOf('spend', row.category)?.cardTitle ?? row.category
  return {
    title: row.characterName === '' ? title : `${row.characterName} · ${title}`,
    detail: `${row.records.length}건`,
  }
}

export function mergedRowMesoOf(row: MergedDayRow): number {
  return row.records.reduce((sum, entry) => sum + spendMesoOf(entry.record), 0)
}

/**
 * 합친 줄의 왼쪽 그림. 없으면 `null` 이고 화면이 지출 아이콘을 그린다.
 *
 * 아이템 구매는 금액이 큰 기록부터(같으면 먼저 적은 기록부터) 보아 그림이 있는 첫 아이템의 그림이다. 갈래 카드의
 * 구매 그림은 그 아이템을 산 기록으로 읽혀 쓰지 않는다. 헥사 매트릭스는 갈래 카드의 헥사 매트릭스 그림이다.
 */
export function mergedRowIconOf(row: MergedDayRow): ImageAssetRef | null {
  if (row.category === 'hexa_matrix') return getAssetImage(cashbookCategoryOf('spend', row.category)?.iconAssetId)
  const byPrice = [...row.records].sort(
    (left, right) => spendMesoOf(right.record) - spendMesoOf(left.record) || byRecordedAt(left, right),
  )
  for (const entry of byPrice) {
    const icon = recordIconOf(entry)
    if (icon !== null) return icon
  }
  return null
}
