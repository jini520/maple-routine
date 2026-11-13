/**
 * 화면 FAQ 표(`faqs` 칸) 조회. 묶음 하나가 시트 하나다.
 *
 * 묶음 목록은 서버 표의 줄이다. 새 화면은 아래 key 목록에 한 줄을 더하고 물음표를 달면 되고, 서버는 관리 화면에서
 * 같은 key 의 묶음을 더한다. 서버에만 있는 묶음은 쓰지 않는다.
 */
import type { FaqBlock, FaqSheetContent } from '../../types/faq'
import type { FaqItemRow, FaqSheetRow, FaqsTable } from '../../types/game-data'
import { isNonEmptyString, isRow, rowsOf, uniqueBy, updatedAtOf, type Row } from '../game-data/contract'
import { gameTable } from '../game-data/table'

/**
 * 앱이 여는 묶음의 key. 페이지는 라우트 이름, 안내 줄은 기능 폴더 이름을 소문자와 붙임표로 쓴다.
 *
 * 서버 묶음 key 와 글자가 같아야 한다. 다르면 그 화면의 물음표가 뜨지 않는다.
 */
export const FAQ_SHEET_KEYS = [
  'sign-in',
  'mvp-grade-confirm',
  'today',
  'content',
  'boss',
  'appointments',
  'profit',
  'cashbook',
  'stats',
  'inventory',
  'utility',
  'settings',
  'content-manage',
  'boss-manage',
  'drop-history',
  'drop-price',
  'utility-item-split',
  'utility-boss-profit-calculator',
  'utility-boss-profit-calculator-records',
  'settings-characters',
  'settings-mvp-grade',
  'settings-mvp-grade-history',
  'settings-notices',
  'settings-notice-detail',
  'settings-notice-alerts',
  'settings-release-notes',
  'settings-theme',
  'settings-text-size',
  'settings-bar-order',
  'app-settings',
  'settings-about',
  'settlement',
  'nexon-maintenance',
  'manual-completion',
] as const
export type FaqSheetKey = (typeof FAQ_SHEET_KEYS)[number]

/** 서버가 쓰기 때 지키는 key 형식. 소문자 · 숫자 · 붙임표 */
const SHEET_KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/

function toSheet(row: Row): FaqSheetRow | null {
  if (!isNonEmptyString(row.key) || !SHEET_KEY.test(row.key) || !isNonEmptyString(row.title)) return null
  return { key: row.key, title: row.title }
}

/** 아는 종류는 블록, 모르는 종류는 `undefined`(버린다), 형식 위반은 `null`. */
function toBlock(value: unknown): FaqBlock | undefined | null {
  if (!isRow(value) || !isNonEmptyString(value.kind)) return null
  if (value.kind !== 'paragraph') return undefined
  return isNonEmptyString(value.text) ? { kind: 'paragraph', text: value.text } : null
}

/** 남는 블록이 없는 문항은 `undefined`(뺀다), 형식 위반은 `null`. */
function toItem(row: Row): FaqItemRow | undefined | null {
  if (!isNonEmptyString(row.sheet) || !isNonEmptyString(row.question) || !Array.isArray(row.answer)) return null
  const answer: FaqBlock[] = []
  for (const value of row.answer) {
    const block = toBlock(value)
    if (block === null) return null
    if (block !== undefined) answer.push(block)
  }
  return answer.length === 0 ? undefined : { sheet: row.sheet, question: row.question, answer }
}

function itemsOf(value: unknown): FaqItemRow[] | null {
  if (!Array.isArray(value)) return null
  const items: FaqItemRow[] = []
  for (const raw of value) {
    if (!isRow(raw)) return null
    const item = toItem(raw)
    if (item === null) return null
    if (item !== undefined) items.push(item)
  }
  return items
}

/**
 * 계약을 지킨 값만 통과시킨다. 어긴 값은 표 전체가 `null` 이다.
 *
 * 모르는 종류의 블록과 그 때문에 빈 문항은 계약 위반이 아니라 버린다. 서버가 새 종류를 쓰기 시작해도 옛 앱이 칸 전체를
 * 버리지 않게 하려는 것이다. 묶음도 문항도 비어도 된다.
 */
export function parseFaqs(value: unknown): FaqsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const sheets = rowsOf(value.sheets, toSheet, { allowEmpty: true })
  if (sheets === null || !uniqueBy(sheets, (sheet) => sheet.key)) return null
  const items = itemsOf(value.items)
  if (items === null) return null
  return { updatedAt, sheets, items }
}

export const faqsTable = gameTable('faqs', { updatedAt: null, sheets: [], items: [] }, parseFaqs)

/** 묶음 하나의 시트. 묶음이 없거나 문항이 하나도 없으면 `null` 이다. */
export function faqSheetOf(table: FaqsTable, key: string): FaqSheetContent | null {
  const sheet = table.sheets.find((row) => row.key === key)
  if (sheet === undefined) return null
  const items = table.items
    .filter((item) => item.sheet === key)
    .map((item) => ({ question: item.question, answer: item.answer }))
  return items.length === 0 ? null : { title: sheet.title, items }
}
