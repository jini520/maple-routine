/**
 * 지금 앱이 쓰는 보스 표. 번들 `bosses.json` 으로 시작하고 기기 사본과 서버 응답이 덮는다.
 *
 * `bosses.ts` 의 조회 함수가 전부 이 값을 읽는다. 덮는 흐름은 `features/bosses/store` 에 있다.
 * 서버 응답과 기기 사본을 받는 자리가 같은 검사(`parseBossCatalog`)를 거친다.
 */
import bundled from '../../data/bosses.json'
import {
  BOSS_CATALOG_CYCLES,
  type BossCatalog,
  type BossCatalogBoss,
  type BossCatalogCycle,
  type BossCatalogDifficulty,
  type BossCatalogRules,
} from '../../types/boss-catalog'
import { BOSS_DIFFICULTIES, type BossDifficulty } from '../../types/scheduler'

export const BUNDLED_BOSS_CATALOG: BossCatalog = bundled as BossCatalog

let current: BossCatalog = BUNDLED_BOSS_CATALOG
const listeners = new Set<() => void>()

export function getBossCatalog(): BossCatalog {
  return current
}

/** 표를 통째로 바꾸고 구독자에게 알린다. 같은 객체면 아무 일도 없다. */
export function setBossCatalog(next: BossCatalog): void {
  if (next === current) return
  current = next
  for (const listener of listeners) listener()
}

/** @returns 구독을 푸는 함수 */
export function subscribeBossCatalog(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function toDifficulty(value: unknown): BossCatalogDifficulty | null {
  if (typeof value !== 'object' || value === null) return null
  const row = value as Record<string, unknown>
  if (!(BOSS_DIFFICULTIES as readonly unknown[]).includes(row.difficulty)) return null
  if (!isPositiveInteger(row.requiredLevel)) return null
  return { difficulty: row.difficulty as BossDifficulty, requiredLevel: row.requiredLevel }
}

function toBoss(value: unknown): BossCatalogBoss | null {
  if (typeof value !== 'object' || value === null) return null
  const boss = value as Record<string, unknown>
  if (!isNonEmptyString(boss.key) || !isNonEmptyString(boss.name) || !isNonEmptyString(boss.alias)) return null
  if (!isNonEmptyString(boss.portraitSlug)) return null
  if (!(BOSS_CATALOG_CYCLES as readonly unknown[]).includes(boss.cycle)) return null
  if (!Array.isArray(boss.difficulties) || boss.difficulties.length === 0) return null

  const difficulties: BossCatalogDifficulty[] = []
  for (const raw of boss.difficulties) {
    const row = toDifficulty(raw)
    if (row === null || difficulties.some((d) => d.difficulty === row.difficulty)) return null
    difficulties.push(row)
  }
  const from = toPeriodText(boss.from)
  const until = toPeriodText(boss.until)
  if (from === false || until === false) return null
  return {
    key: boss.key,
    name: boss.name,
    alias: boss.alias,
    cycle: boss.cycle as BossCatalogCycle,
    portraitSlug: boss.portraitSlug,
    difficulties,
    ...(from === undefined ? {} : { from }),
    ...(until === undefined ? {} : { until }),
  }
}

const PERIOD_TEXT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/

/** 기간 글자. 없음(`null` · 빠짐)은 `undefined`, 모양이 틀리면 `false`. */
function toPeriodText(value: unknown): string | undefined | false {
  if (value === null || value === undefined) return undefined
  return typeof value === 'string' && PERIOD_TEXT.test(value) ? value : false
}

function toRules(value: unknown): BossCatalogRules | null {
  if (typeof value !== 'object' || value === null) return null
  const rules = value as Record<string, unknown>
  if (!isPositiveInteger(rules.weeklyBossSelectionLimit) || !isPositiveInteger(rules.weeklyCrystalSaleLimit)) return null
  return {
    weeklyBossSelectionLimit: rules.weeklyBossSelectionLimit,
    weeklyCrystalSaleLimit: rules.weeklyCrystalSaleLimit,
  }
}

/**
 * 계약을 지킨 값만 통과시킨다. 어긴 값은 줄 하나가 아니라 **표 전체**가 `null` 이다.
 *
 * 줄 하나만 버리면 그 보스가 화면에서 조용히 사라지고 기록이 설 자리를 잃는다. 표 전체를 버리면
 * 들고 있던 사본이 그대로 선다.
 */
export function parseBossCatalog(value: unknown): BossCatalog | null {
  if (typeof value !== 'object' || value === null) return null
  const catalog = value as Record<string, unknown>

  if (catalog.updatedAt !== null && typeof catalog.updatedAt !== 'string') return null
  const rules = toRules(catalog.rules)
  if (rules === null) return null
  if (!Array.isArray(catalog.bosses) || catalog.bosses.length === 0) return null

  const bosses: BossCatalogBoss[] = []
  for (const raw of catalog.bosses) {
    const boss = toBoss(raw)
    if (boss === null || bosses.some((b) => b.key === boss.key)) return null
    bosses.push(boss)
  }
  return { updatedAt: catalog.updatedAt, rules, bosses }
}
