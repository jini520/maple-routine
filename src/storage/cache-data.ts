import { Preferences } from '@capacitor/preferences'
import { STORAGE_KEYS } from './keys'
import { BOSS_PROFIT_TABLE_NAMES, getBossProfitDb } from './sqlite/db'

// 캐시 데이터 삭제 — 인증·사용자 설정만 남기고 나머지 저장 데이터를 전부 지운다.
// (Preferences: 스케줄/캐릭터 캐시·추적 목록·마지막 선택 등 / SQLite: db.ts가 정의한 모든 테이블)
// trackingMode·dropEffect는 재조회로 복구되는 캐시가 아니라 사용자가 명시적으로 고른 취향 설정이라
// theme과 같이 보존한다(ADR-052 결정 1).
const KEEP_KEYS = new Set<string>([
  STORAGE_KEYS.apiKey,
  STORAGE_KEYS.selectedAccountId,
  STORAGE_KEYS.theme,
  STORAGE_KEYS.trackingMode,
  STORAGE_KEYS.dropEffect,
])

export async function clearCacheData(): Promise<void> {
  const { keys } = await Preferences.keys()
  await Promise.all(
    keys.filter((key) => !KEEP_KEYS.has(key)).map((key) => Preferences.remove({ key })),
  )

  const db = await getBossProfitDb()
  for (const table of BOSS_PROFIT_TABLE_NAMES) {
    await db.execute(`DELETE FROM ${table};`)
  }
}

// 설정 화면의 "캐시 데이터 삭제" 행에 삭제될 용량을 보여주기 위한 근사치(바이트) — clearCacheData가
// 지우는 것과 동일한 범위(KEEP_KEYS 제외 Preferences + 같은 SQLite 테이블 목록)만 합산한다.
export async function getCacheDataSize(): Promise<number> {
  let bytes = 0

  const { keys } = await Preferences.keys()
  for (const key of keys) {
    if (KEEP_KEYS.has(key)) continue
    const { value } = await Preferences.get({ key })
    if (value !== null) bytes += byteLength(value)
  }

  const db = await getBossProfitDb()
  for (const table of BOSS_PROFIT_TABLE_NAMES) {
    const { values } = await db.query(`SELECT * FROM ${table}`)
    for (const row of values ?? []) {
      for (const value of Object.values(row as Record<string, unknown>)) {
        bytes += byteLength(String(value ?? ''))
      }
    }
  }

  return bytes
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}
