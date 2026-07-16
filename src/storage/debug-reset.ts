import { Preferences } from '@capacitor/preferences'
import { STORAGE_KEYS } from './keys'
import { getBossProfitDb } from './sqlite/db'

// 임시 디버그 기능 — API 키·선택 계정·테마만 남기고 나머지 저장 데이터를 전부 지운다.
// (Preferences: 스케줄/캐릭터 캐시·추적 목록·마지막 선택 등 / SQLite: 보스 수익 기록·파티 설정·기간 체크)
// 프로덕션 로직과 분리하기 위해 이 파일 안에서만 처리한다 — SQLite도 db.ts를 수정하지 않고 공개
// API(getBossProfitDb)만 써서 비운다. 배포 전 이 파일과 설정 화면의 DebugResetSection을 삭제하면 끝.
const KEEP_KEYS = new Set<string>([
  STORAGE_KEYS.apiKey,
  STORAGE_KEYS.selectedAccountId,
  STORAGE_KEYS.theme,
])

export async function clearAppDataExceptAuth(): Promise<void> {
  const { keys } = await Preferences.keys()
  await Promise.all(
    keys.filter((key) => !KEEP_KEYS.has(key)).map((key) => Preferences.remove({ key })),
  )

  const db = await getBossProfitDb()
  await db.execute('DELETE FROM boss_profit_records;')
  await db.execute('DELETE FROM boss_party_settings;')
  await db.execute('DELETE FROM boss_profit_period_checks;')
}
