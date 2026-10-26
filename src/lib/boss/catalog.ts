/**
 * 지금 앱이 쓰는 보스 표. 번들 `bosses.json` 으로 시작하고 기기 사본과 서버 응답이 덮는다.
 *
 * `bosses.ts` 의 조회 함수가 전부 이 값을 읽는다. 덮는 흐름은 `features/game-data/sync` 에 있다.
 * 서버 응답과 기기 사본을 받는 자리가 같은 검사(`parseBossCatalog`)를 거친다.
 */
import {
  BOSS_CATALOG_CYCLES,
  type BossCatalog,
  type BossCatalogBoss,
  type BossCatalogDifficulty,
  type BossCatalogRules,
} from '../../types/boss-catalog'
import { BOSS_DIFFICULTIES } from '../../types/scheduler'
import {
  compact,
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

function toDifficulty(row: Row): BossCatalogDifficulty | null {
  if (!isOneOf(row.difficulty, BOSS_DIFFICULTIES) || !isPositiveInteger(row.requiredLevel)) return null
  const maxPartySize = optional(row.maxPartySize, isPositiveInteger)
  const from = optional(row.from, isPeriodText)
  const until = optional(row.until, isPeriodText)
  if (maxPartySize === false || from === false || until === false) return null
  return compact({ difficulty: row.difficulty, requiredLevel: row.requiredLevel, maxPartySize, from, until })
}

function toBoss(row: Row): BossCatalogBoss | null {
  if (!isNonEmptyString(row.key) || !isNonEmptyString(row.name) || !isNonEmptyString(row.alias)) return null
  if (!isNonEmptyString(row.portraitSlug) || !isOneOf(row.cycle, BOSS_CATALOG_CYCLES)) return null
  const difficulties = rowsOf(row.difficulties, toDifficulty)
  if (difficulties === null || !uniqueBy(difficulties, (each) => each.difficulty)) return null
  const from = optional(row.from, isPeriodText)
  const until = optional(row.until, isPeriodText)
  if (from === false || until === false) return null
  return compact({
    key: row.key,
    name: row.name,
    alias: row.alias,
    cycle: row.cycle,
    portraitSlug: row.portraitSlug,
    difficulties,
    from,
    until,
  })
}

function toRules(value: unknown): BossCatalogRules | null {
  if (!isRow(value)) return null
  const { weeklyBossSelectionLimit, weeklyCrystalSaleLimit, defaultMaxPartySize } = value
  if (!isPositiveInteger(weeklyBossSelectionLimit) || !isPositiveInteger(weeklyCrystalSaleLimit)) return null
  if (!isPositiveInteger(defaultMaxPartySize)) return null
  return { weeklyBossSelectionLimit, weeklyCrystalSaleLimit, defaultMaxPartySize }
}

/**
 * 계약을 지킨 값만 통과시킨다. 어긴 값은 줄 하나가 아니라 **표 전체**가 `null` 이다.
 *
 * 줄 하나만 버리면 그 보스가 화면에서 조용히 사라지고 기록이 설 자리를 잃는다. 표 전체를 버리면
 * 들고 있던 사본이 그대로 선다.
 */
export function parseBossCatalog(value: unknown): BossCatalog | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const rules = toRules(value.rules)
  if (rules === null) return null
  const bosses = rowsOf(value.bosses, toBoss)
  if (bosses === null || !uniqueBy(bosses, (boss) => boss.key)) return null
  return { updatedAt, rules, bosses }
}

export const bossCatalogTable = gameTable('bosses', { updatedAt: null, rules: { weeklyBossSelectionLimit: 0, weeklyCrystalSaleLimit: 0, defaultMaxPartySize: 0 }, bosses: [] }, parseBossCatalog)

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
