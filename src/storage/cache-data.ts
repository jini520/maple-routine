import { preferences } from './ports'
import { characterBasicCacheKey, STORAGE_KEYS } from './keys'
import { SPLIT_COLUMN_NAMES } from './boss-periods'
import { getCachedCharacterBasic } from './character-basic-cache'
import { addMissingCharacterProfile, type CharacterProfileSnapshot } from './character-profiles'
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'

// 데이터 삭제. 사용자가 고른 그룹이 목록으로 든 키와 표만 지운다. 목록에 없는 것은 어떤 선택에서도 남는다.
// 화면에 적지 않은 것을 함께 지우면 사용자가 모르는 것을 잃는다. 새 키 · 새 표는 그룹 목록에 더해야만 지워진다.
export type CacheDataGroupId = 'manual' | 'boss' | 'cashbook' | 'enhancement' | 'cache'

export type CacheDataSelection = Record<CacheDataGroupId, boolean>

/** 수동 선택 항목의 키. 캐릭터 · 월드 · 계정마다 붙는 것은 접두사로 적는다. */
const MANUAL_KEY_PREFIXES = ['manualTrackedContent:', 'worldSharedProgress:', 'accountSharedProgress:']
const MANUAL_KEYS = new Set<string>([
  STORAGE_KEYS.lastHunts,
  STORAGE_KEYS.lastHuntSelection,
  STORAGE_KEYS.lastHuntToggles,
  STORAGE_KEYS.lastPointRate,
])

function isManualKey(key: string): boolean {
  return MANUAL_KEYS.has(key) || MANUAL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
}

/** 조회 캐시의 키. 표는 `query_cache` 다. `scheduleProbe:*` 는 13일 창이 읽는 원장이라 들지 않는다. */
const CACHE_KEY_PREFIXES = ['schedulerCache:', 'characterBasicCache:', 'mesoRateCache:']

function isCacheKey(key: string): boolean {
  return key === STORAGE_KEYS.eventWorldNames || CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
}

/** 기록을 지우는 그룹. `cache` 는 다시 받는 값만 지운다. */
const RECORD_GROUPS: readonly CacheDataGroupId[] = ['manual', 'boss', 'cashbook', 'enhancement']

// 품목 · 사냥 입력은 기록의 자식이라 기록과 함께 지워야 고아가 안 생긴다. 강화 레벨 기억은 기록에서 나온 값이라
// 기록만 지우고 남기면 다음 기록의 강화 전 칸이 지운 기록의 레벨로 선다.
const CASHBOOK_TABLES = ['cashbook_entries', 'cashbook_entry_items', 'cashbook_entry_hunt_inputs', 'remembered_levels']

// 확인 기록만 남으면 그 날짜를 다시 부르지 않아 합계가 빈 채로 굳는다. 셋을 함께 지워야 다시 받는다.
const ENHANCEMENT_TABLES = ['enhancement_totals', 'enhancement_history_checks', 'enhancement_recomputes']

const NULL_SPLIT = SPLIT_COLUMN_NAMES.map((column) => `${column} = NULL`).join(', ')

// 보스 기록 표 셋은 한 표에 두 그룹의 행이 섞여 있어 행 단위로 지운다. 조합 행이 처치와 드롭의 부모라 표를 통째로
// 지우면 외래키를 따라 다른 그룹까지 사라진다.

/** 처치와 드롭. 그 기간 값이 없는 기간 행은 함께 지운다. */
const CLEAR_BOSS_RECORDS = [
  'DELETE FROM boss_drops',
  `DELETE FROM boss_party_periods WHERE clear_status = 'cleared' OR split_mode IS NULL`,
]

/** 파티 분배 설정과 그 기간 값. 드롭이 남은 기간은 행을 남기고 분배 칸만 비운다. */
const CLEAR_BOSS_SPLITS = [
  `UPDATE boss_parties SET ${NULL_SPLIT}`,
  `DELETE FROM boss_party_periods
    WHERE clear_status = 'open' AND NOT EXISTS (SELECT 1 FROM boss_drops WHERE period_id = boss_party_periods.id)`,
  `UPDATE boss_party_periods SET ${NULL_SPLIT} WHERE clear_status = 'open'`,
]

/** 설정도 기간도 없는 조합 행. 남기면 기록을 지웠는데 조합만 남는다. */
const PRUNE_BOSS_PARTIES = `DELETE FROM boss_parties
  WHERE split_mode IS NULL AND NOT EXISTS (SELECT 1 FROM boss_party_periods WHERE party_id = boss_parties.id)`

function statementsFor(selection: CacheDataSelection): string[] {
  return [
    ...(selection.cashbook ? CASHBOOK_TABLES.map((table) => `DELETE FROM ${table}`) : []),
    ...(selection.enhancement ? ENHANCEMENT_TABLES.map((table) => `DELETE FROM ${table}`) : []),
    ...(selection.boss ? CLEAR_BOSS_RECORDS : []),
    ...(selection.manual ? CLEAR_BOSS_SPLITS : []),
    ...(selection.boss || selection.manual ? [PRUNE_BOSS_PARTIES] : []),
    ...(selection.cache ? ['DELETE FROM query_cache'] : []),
    // 대기 표가 남으면 방금 지운 기록마다 서버로 지우기 요청이 간다. 서버 사본은 남긴다. 캐시만 지우면 기록이 그대로라
    // 비우지 않는다. 비우면 아직 못 보낸 드롭 시세가 사라진다.
    ...(RECORD_GROUPS.some((group) => selection[group]) ? ['DELETE FROM server_sync_queue'] : []),
  ]
}

/**
 * `characterBasicCache:*` 의 프로필. 표에 없는 캐릭터는 이 키가 이름이 남은 마지막 자리일 수 있어, 그대로 지우면 기록에서
 * 그 캐릭터의 줄이 사라진다. `updatedAt` 은 캐시가 적어 둔 시각이다.
 */
async function legacyProfilesOf(keys: readonly string[]): Promise<CharacterProfileSnapshot[]> {
  const prefix = characterBasicCacheKey('')
  const ocids = keys.filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length))
  const entries = await Promise.all(ocids.map(async (ocid) => ({ ocid, entry: await getCachedCharacterBasic(ocid) })))
  return entries.flatMap(({ ocid, entry }) =>
    entry === null || entry.profile.name === ''
      ? []
      : [
          {
            ocid,
            name: entry.profile.name,
            imageUrl: entry.profile.imageUrl,
            world: entry.profile.world ?? null,
            worldKey: entry.profile.worldKey ?? null,
            level: entry.profile.level,
            jobClass: entry.profile.jobClass ?? null,
            updatedAt: entry.cachedAt,
          },
        ],
  )
}

/** 고른 그룹만 지운다. 표는 트랜잭션 하나로 지우고, 끝나면 `VACUUM` 으로 파일을 줄인다. */
export async function clearCacheData(selection: CacheDataSelection): Promise<void> {
  if (!Object.values(selection).some(Boolean)) return

  const keys = await preferences.keys()
  const profiles = selection.cache ? await legacyProfilesOf(keys) : []
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    for (const statement of statementsFor(selection)) await db.execute(statement)
    for (const profile of profiles) await addMissingCharacterProfile(profile)
  })
  // Preferences 는 트랜잭션에 들지 못해 표가 다 지워진 뒤에 지운다. 표 지우기가 실패하면 아무것도 안 지워진다.
  const removed = keys.filter((key) => (selection.manual && isManualKey(key)) || (selection.cache && isCacheKey(key)))
  await Promise.all(removed.map((key) => preferences.remove(key)))
  // 행을 지워도 SQLite 는 그 공간을 파일 안에 빈 칸으로 남긴다. 트랜잭션 안에서는 돌지 않는다.
  await db.execute('VACUUM')
}

/** 칸마다 보일 건수. 그 그룹을 지우면 사라지는 기록의 수다. */
export interface CacheDataCounts {
  /** 수동 추적 항목이 있는 캐릭터 수 */
  manualCharacters: number
  bossClears: number
  bossDrops: number
  cashbookEntries: number
  /** 강화 합계가 있는 날 수 */
  enhancementDays: number
  /** 이 그룹의 Preferences 키 수. 저장된 쿼리 수는 `features/settings/cache-data.ts` 가 더한다 */
  cacheEntries: number
}

export async function getCacheDataCounts(): Promise<CacheDataCounts> {
  const keys = await preferences.keys()
  const db = await getBossProfitDb()
  const scalar = async (statement: string): Promise<number> => {
    const { values } = await db.query(statement)
    return Number((values?.[0] as { n?: unknown } | undefined)?.n ?? 0)
  }

  return {
    manualCharacters: keys.filter((key) => key.startsWith('manualTrackedContent:')).length,
    bossClears: await scalar(`SELECT count(*) AS n FROM boss_party_periods WHERE clear_status = 'cleared'`),
    bossDrops: await scalar('SELECT count(*) AS n FROM boss_drops'),
    cashbookEntries: await scalar('SELECT count(*) AS n FROM cashbook_entries'),
    enhancementDays: await scalar('SELECT count(DISTINCT history_date) AS n FROM enhancement_totals'),
    cacheEntries: keys.filter(isCacheKey).length,
  }
}
