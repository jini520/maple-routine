/**
 * 지금 기기에 예약해 둔 로컬 알림의 원장. Preferences 의 JSON 한 칸.
 *
 * OS 는 예약 목록을 앱에 주지 않아 우리가 적어 둔다. 재조정이 이것과 계획을 비교해 예약 · 취소한다.
 * 깨진 JSON 은 빈 목록으로 읽고 모양이 틀린 항목은 그 항목만 버린다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export interface NotificationLedgerEntry {
  id: number
  kind: string
  /** 울릴 시각(ms) */
  fireAt: number
  title: string
  body: string
}

function isEntry(value: unknown): value is NotificationLedgerEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.id === 'number' &&
    typeof entry.kind === 'string' &&
    typeof entry.fireAt === 'number' &&
    typeof entry.title === 'string' &&
    typeof entry.body === 'string'
  )
}

export async function getNotificationLedger(): Promise<NotificationLedgerEntry[]> {
  const raw = await preferences.get(STORAGE_KEYS.notificationLedger)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

export async function setNotificationLedger(entries: readonly NotificationLedgerEntry[]): Promise<void> {
  await preferences.set(STORAGE_KEYS.notificationLedger, JSON.stringify(entries))
}
