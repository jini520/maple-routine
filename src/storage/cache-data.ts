import { Preferences } from '@capacitor/preferences'
import { STORAGE_KEYS } from './keys'
import { getBossProfitDb } from './sqlite/db'

// 캐시 데이터 삭제 — API 키·선택 계정·테마만 남기고 나머지 저장 데이터를 전부 지운다.
// (Preferences: 스케줄/캐릭터 캐시·추적 목록·마지막 선택 등 / SQLite: 보스 수익 기록·파티 설정·기간 체크)
const KEEP_KEYS = new Set<string>([
  STORAGE_KEYS.apiKey,
  STORAGE_KEYS.selectedAccountId,
  STORAGE_KEYS.theme,
])

const CLEARED_TABLES = ['boss_profit_records', 'boss_party_settings', 'boss_profit_period_checks'] as const

export async function clearCacheData(): Promise<void> {
  const { keys } = await Preferences.keys()
  await Promise.all(
    keys.filter((key) => !KEEP_KEYS.has(key)).map((key) => Preferences.remove({ key })),
  )

  const db = await getBossProfitDb()
  for (const table of CLEARED_TABLES) {
    await db.execute(`DELETE FROM ${table};`)
  }
}

// 설정 화면의 "캐시 데이터 삭제" 행에 삭제될 용량을 보여주기 위한 근사치(바이트) — clearCacheData가
// 지우는 것과 동일한 범위(KEEP_KEYS 제외 Preferences + 이 세 SQLite 테이블)만 합산한다.
export async function getCacheDataSize(): Promise<number> {
  let bytes = 0

  const { keys } = await Preferences.keys()
  for (const key of keys) {
    if (KEEP_KEYS.has(key)) continue
    const { value } = await Preferences.get({ key })
    if (value !== null) bytes += byteLength(value)
  }

  const db = await getBossProfitDb()
  for (const table of CLEARED_TABLES) {
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
