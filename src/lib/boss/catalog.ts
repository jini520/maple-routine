/**
 * 지금 앱이 쓰는 보스 표. 번들 `bosses.json` 으로 시작하고 기기 사본과 서버 응답이 덮는다.
 *
 * `bosses.ts` 의 조회 함수가 전부 이 값을 읽는다. 덮는 흐름은 `features/game-data/sync` 에 있다.
 * 서버 응답과 기기 사본을 받는 자리가 같은 검사(`parseBossCatalog`)를 거친다.
 */
import {
  BOSS_CATALOG_CYCLES,
  type BossCatalog,
  type BossDifficultyRow,
  type BossRow,
} from '../../types/boss-catalog'
import { BOSS_DIFFICULTIES } from '../../types/scheduler'
import {
  compact,
  isBoolean,
  isNonEmptyString,
  isOneOf,
  isPeriodText,
  isPositiveInteger,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { gameTable } from '../game-data/table'

function toBoss(row: Row): BossRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  if (!isNonEmptyString(row.shortName) || !isNonEmptyString(row.portraitAssetId) || !isBoolean(row.isSeasonBoss)) {
    return null
  }
  const validFrom = optional(row.validFrom, isPeriodText)
  const validUntil = optional(row.validUntil, isPeriodText)
  if (validFrom === false || validUntil === false) return null
  return compact({
    id: row.id,
    key: row.key,
    name: row.name,
    shortName: row.shortName,
    isSeasonBoss: row.isSeasonBoss,
    portraitAssetId: row.portraitAssetId,
    validFrom,
    validUntil,
  })
}

function toDifficulty(row: Row): BossDifficultyRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.bossId)) return null
  if (!isOneOf(row.difficulty, BOSS_DIFFICULTIES) || !isOneOf(row.cycle, BOSS_CATALOG_CYCLES)) return null
  if (!isPositiveInteger(row.requiredLevel)) return null
  const maxPartySize = optional(row.maxPartySize, isPositiveInteger)
  const validFrom = optional(row.validFrom, isPeriodText)
  const validUntil = optional(row.validUntil, isPeriodText)
  if (maxPartySize === false || validFrom === false || validUntil === false) return null
  return compact({
    id: row.id,
    bossId: row.bossId,
    difficulty: row.difficulty,
    cycle: row.cycle,
    requiredLevel: row.requiredLevel,
    maxPartySize,
    validFrom,
    validUntil,
  })
}

/**
 * 계약을 지킨 값만 통과시킨다. 어긴 값은 줄 하나가 아니라 **표 전체**가 `null` 이다.
 *
 * 줄 하나만 버리면 그 보스가 화면에서 조용히 사라지고 기록이 설 자리를 잃는다. 표 전체를 버리면
 * 들고 있던 사본이 그대로 선다. 보스마다 난이도 줄이 하나 이상이고 난이도가 겹치지 않으며, 한 보스의 난이도는 주기가 같다.
 * 앱은 보스마다 주기 하나로 기간을 잡는다.
 */
export function parseBossCatalog(value: unknown): BossCatalog | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const bosses = rowsOf(value.bosses, toBoss)
  const bossDifficulties = rowsOf(value.bossDifficulties, toDifficulty)
  if (bosses === null || bossDifficulties === null) return null
  if (!uniqueBy(bosses, (boss) => boss.key) || !uniqueBy(bosses, (boss) => boss.id)) return null
  if (!uniqueBy(bossDifficulties, (row) => row.id)) return null
  if (!uniqueBy(bossDifficulties, (row) => `${row.bossId}:${row.difficulty}`)) return null
  const cycleOf = new Map<string, string>()
  for (const row of bossDifficulties) {
    if ((cycleOf.get(row.bossId) ?? row.cycle) !== row.cycle) return null
    cycleOf.set(row.bossId, row.cycle)
  }
  const ids = new Set(bosses.map((boss) => boss.id))
  if (bossDifficulties.some((row) => !ids.has(row.bossId))) return null
  if (bosses.some((boss) => !cycleOf.has(boss.id))) return null
  return { updatedAt, bosses, bossDifficulties }
}

export const bossCatalogTable = gameTable<BossCatalog>(
  'bosses',
  { updatedAt: null, bosses: [], bossDifficulties: [] },
  parseBossCatalog,
)

/** 표의 첫 값. 앱에서는 빈 표이고 jest 에서는 fixture 다. 테스트가 표를 되돌릴 때 쓴다. */
export const INITIAL_BOSS_CATALOG: BossCatalog = bossCatalogTable.get()

export function getBossCatalog(): BossCatalog {
  return bossCatalogTable.get()
}

/** 표를 통째로 바꾸고 구독자에게 알린다. 같은 객체면 아무 일도 없다. */
export function setBossCatalog(next: BossCatalog): void {
  bossCatalogTable.set(next)
}

/** @returns 구독을 푸는 함수 */
export function subscribeBossCatalog(listener: () => void): () => void {
  return bossCatalogTable.subscribe(listener)
}
