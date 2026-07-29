import { Preferences } from '@capacitor/preferences'
import { STORAGE_KEYS } from './keys'
import { BOSS_PROFIT_TABLE_NAMES, getBossProfitDb } from './sqlite/db'

// 캐시 데이터 삭제 — 인증·사용자 설정만 남기고 나머지 저장 데이터를 지운다.
// trackingMode·dropEffect는 재조회로 복구되는 캐시가 아니라 사용자가 명시적으로 고른 취향 설정이라
// theme과 같이 보존한다(ADR-052 결정 1). 어떤 그룹을 골라도 이 5개는 삭제 대상이 아니다.
const KEEP_KEYS = new Set<string>([
  STORAGE_KEYS.apiKey,
  STORAGE_KEYS.selectedAccountId,
  STORAGE_KEYS.theme,
  STORAGE_KEYS.trackingMode,
  STORAGE_KEYS.dropEffect,
])

// ADR-058: 삭제 단위는 2그룹이다. 사용자가 해결하려는 갈등은 "용량은 비우고 싶은데 복구 불가능한
// 기록은 남기고 싶다" 하나뿐이라, 그 축을 정확히 가르는 최소 분할만 둔다.
export type CacheDataGroupId = 'general' | 'bossRecords'

export type CacheDataSelection = Record<CacheDataGroupId, boolean>

const ALL_GROUPS: CacheDataSelection = { general: true, bossRecords: true }

// ADR-058 결정 2 — 명시 목록을 갖는 쪽은 bossRecords뿐이고, general은 아래에서 차집합으로
// 파생된다. 두 그룹을 다 열거하면 어느 그룹에도 안 잡히는 테이블이 생기고, 그건 ADR-052가 없앤
// "새 테이블이 삭제 목록에서 누락된다"는 결함의 부호만 뒤집힌 형태다(영영 안 지워짐).
//
// period_checks가 기록과 같은 그룹인 이유(결정 3): 이 표식만 남고 기록이 사라지면 loadPeriod의
// isPeriodChecked 가드가 백필을 건너뛰어(ADR-023), API가 아직 주는 최근 2주치마저 되살릴 수 없다.
// 수익과 드롭을 더 쪼개지 않는 이유(결정 5): 수익만 지우고 드롭이 남으면 고아 드롭 행이 되어 같은
// 보스를 다시 잡을 때 예전 드롭이 되살아나 붙는다(ADR-052).
export const BOSS_RECORD_TABLE_NAMES: readonly string[] = [
  'boss_profit_records',
  'boss_drop_records',
  'boss_profit_period_checks',
]

// db.ts에 테이블이 추가되면 자동으로 여기 들어와 계속 삭제 대상으로 남는다.
export const GENERAL_TABLE_NAMES: readonly string[] = BOSS_PROFIT_TABLE_NAMES.filter(
  (table) => !BOSS_RECORD_TABLE_NAMES.includes(table),
)

function tablesFor(selection: CacheDataSelection): readonly string[] {
  return [
    ...(selection.general ? GENERAL_TABLE_NAMES : []),
    ...(selection.bossRecords ? BOSS_RECORD_TABLE_NAMES : []),
  ]
}

// 선택한 그룹만 지운다. 인자를 생략하면 두 그룹 모두 — 선택 삭제 도입 전과 같은 전체 삭제다.
export async function clearCacheData(selection: CacheDataSelection = ALL_GROUPS): Promise<void> {
  if (selection.general) {
    const { keys } = await Preferences.keys()
    await Promise.all(
      keys.filter((key) => !KEEP_KEYS.has(key)).map((key) => Preferences.remove({ key })),
    )
  }

  const tables = tablesFor(selection)
  if (tables.length === 0) {
    return
  }

  const db = await getBossProfitDb()
  for (const table of tables) {
    await db.execute(`DELETE FROM ${table};`)
  }
}

// 설정 화면의 "캐시 데이터 삭제" 행·확인 모달에 보여줄 근사치(바이트)를 그룹별로 낸다 — 각 값은
// 그 그룹이 실제로 지우는 것과 동일한 범위만 합산하므로, 사용자는 "무엇을 포기하면 얼마가
// 비는지"를 보고 고를 수 있다. 행에 쓰는 총합은 두 값의 합으로 파생한다(ADR-058 결정 8).
export async function getCacheDataSizes(): Promise<Record<CacheDataGroupId, number>> {
  let general = 0

  const { keys } = await Preferences.keys()
  for (const key of keys) {
    if (KEEP_KEYS.has(key)) continue
    const { value } = await Preferences.get({ key })
    if (value !== null) general += byteLength(value)
  }

  const db = await getBossProfitDb()
  general += await tableBytes(db, GENERAL_TABLE_NAMES)
  const bossRecords = await tableBytes(db, BOSS_RECORD_TABLE_NAMES)

  return { general, bossRecords }
}

interface QueryableDb {
  query: (statement: string) => Promise<{ values?: unknown[] }>
}

async function tableBytes(db: QueryableDb, tables: readonly string[]): Promise<number> {
  let bytes = 0
  for (const table of tables) {
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
