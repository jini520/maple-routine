/**
 * 보스 처치 기간 · 가계부 기록을 우리 서버로 보내는 창구. 기기가 기준이고 서버는 사본이다.
 */
import type { BossClearPayload, CashbookEntryPayload } from '../types/server-records'
import { deleteRecord, postRecord, type SendResult } from './write'

/** 종류마다의 서버 경로. 묶음은 이 뒤에 `/batch` 가 붙는다. */
export const RECORD_PATHS = {
  bossClear: '/boss-clears',
  cashbookEntry: '/cashbook-entries',
  dropPrice: '/drop-prices',
} as const

/** 처치 기간 한 건을 덮어 적는다. 같은 값을 다시 보내도 서버에 줄이 안 늘어난다. */
export function sendBossClear(headers: Record<string, string>, one: BossClearPayload): Promise<SendResult> {
  return postRecord(headers, RECORD_PATHS.bossClear, one)
}

/** 그 처치가 기기에서 사라졌다(취소 · 기록 삭제). 서버는 줄을 남기고 지운 것으로 표시한다. */
export function deleteBossClear(headers: Record<string, string>, periodRecordId: string): Promise<SendResult> {
  return deleteRecord(headers, RECORD_PATHS.bossClear, periodRecordId)
}

/** 가계부 기록 한 건과 품목을 덮어 적는다. */
export function sendCashbookEntry(headers: Record<string, string>, one: CashbookEntryPayload): Promise<SendResult> {
  return postRecord(headers, RECORD_PATHS.cashbookEntry, one)
}

/** 그 가계부 기록이 기기에서 사라졌다. */
export function deleteCashbookEntry(headers: Record<string, string>, entryRecordId: string): Promise<SendResult> {
  return deleteRecord(headers, RECORD_PATHS.cashbookEntry, entryRecordId)
}
