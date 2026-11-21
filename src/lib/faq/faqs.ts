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
  'trade-history',
  'utility',
  'settings',
  'content-manage',
  'boss-manage',
  'drop-history',
  'drop-price',
  'utility-maspi',
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
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !SHEET_KEY.test(row.key)) return null
  if (!isNonEmptyString(row.title)) return null
  return { id: row.id, key: row.key, title: row.title }
}

function toItem(row: Row): FaqItemRow | null {
  if (!isNonEmptyString(row.sheetId) || !isNonEmptyString(row.question)) return null
  if (!isNonEmptyString(row.answer) || row.answer.trim() === '') return null
  return { sheetId: row.sheetId, question: row.question, answer: row.answer }
}

/**
 * 계약을 지킨 값만 통과시킨다. 어긴 값은 표 전체가 `null` 이다.
 *
 * 묶음도 문항도 비어도 된다. 문항은 이 칸의 묶음을 가리켜야 한다.
 */
export function parseFaqs(value: unknown): FaqsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const faqSheets = rowsOf(value.faqSheets, toSheet, { allowEmpty: true })
  const faqItems = rowsOf(value.faqItems, toItem, { allowEmpty: true })
  if (faqSheets === null || faqItems === null) return null
  if (!uniqueBy(faqSheets, (sheet) => sheet.key) || !uniqueBy(faqSheets, (sheet) => sheet.id)) return null
  const sheetIds = new Set(faqSheets.map((sheet) => sheet.id))
  if (faqItems.some((item) => !sheetIds.has(item.sheetId))) return null
  return { updatedAt, faqSheets, faqItems }
}

export const faqsTable = gameTable<FaqsTable>('faqs', { updatedAt: null, faqSheets: [], faqItems: [] }, parseFaqs)

/** 답 글을 문단으로. 빈 줄(공백만 있는 줄 포함)이 문단을 나누고, 빈 문단은 버린다. */
function paragraphsOf(answer: string): FaqBlock[] {
  return answer
    .split(/\n[ \t]*\n/)
    .map((text) => text.trim())
    .filter((text) => text !== '')
    .map((text) => ({ kind: 'paragraph', text }))
}

/** 묶음 하나의 시트. 묶음이 없거나 문항이 하나도 없으면 `null` 이다. */
export function faqSheetOf(table: FaqsTable, key: string): FaqSheetContent | null {
  const sheet = table.faqSheets.find((row) => row.key === key)
  if (sheet === undefined) return null
  const items = table.faqItems
    .filter((item) => item.sheetId === sheet.id)
    .map((item) => ({ question: item.question, answer: paragraphsOf(item.answer) }))
  return items.length === 0 ? null : { title: sheet.title, items }
}
