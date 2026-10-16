/**
 * 보스 표 조회. 보스를 key 로 찾는 자리는 전부 이 모듈을 거친다.
 *
 * 표는 `catalog.ts` 가 든다. 번들 `src/data/bosses.json` 으로 시작하고 기기 사본과 서버 응답이
 * 덮는다. 기록 · 캐시 · 데이터 파일은 보스 key 를 들고, 이름 · 주기 · 요구 레벨 · 초상은 이 표에서
 * 찾는다. API 이름에서 key 를 얻는 규칙도 여기 하나다(`bossKeyOfApiName`).
 */
import { BOSS_DIFFICULTIES, type BossCycle, type BossDifficulty } from '../../types'
import type { BossCatalog, BossCatalogBoss, BossCatalogCycle } from '../../types/boss-catalog'
import { type EffectivePeriod, getCurrentBossProfitPeriod, isEffectiveIn } from './boss-profit-period'
import { getBossCatalog, subscribeBossCatalog } from './catalog'

/** 관리 화면의 묶음. 시즌 보스(eventWeekly)도 주기는 주간이다. */
export type BossSection = 'weekly' | 'eventWeekly' | 'monthly'

export interface BossEntry {
  key: string
  /** Nexon API `content_name` 표기. 화면에 보이는 이름이다. */
  name: string
  /** 좁은 자리의 이름. 길어서 줄인 넷 말고는 `name` 과 같다. */
  alias: string
  /** 표의 난이도 줄 차례 그대로다. */
  difficulties: BossDifficulty[]
  requiredLevels: Partial<Record<BossDifficulty, number>>
  portraitSlug: string
  section: BossSection
  cycle: BossCycle
  /** 시즌 보스는 주간 12마리 한도와 결정석 판매 수에서 빠진다. */
  isSeasonBoss: boolean
  /** 유효 기간. KST 글자. 없으면 처음부터 · 끝없이. */
  from?: string
  until?: string
  /** 난이도의 유효 기간. 기간을 든 난이도만 있다. 없으면 보스의 기간 그대로다. */
  difficultyPeriods?: Partial<Record<BossDifficulty, EffectivePeriod>>
}

const SECTION_OF_CYCLE: Record<BossCatalogCycle, BossSection> = {
  weekly: 'weekly',
  event_weekly: 'eventWeekly',
  monthly: 'monthly',
}

function toEntry(boss: BossCatalogBoss): BossEntry {
  const requiredLevels: Partial<Record<BossDifficulty, number>> = {}
  const difficultyPeriods: Partial<Record<BossDifficulty, EffectivePeriod>> = {}
  for (const row of boss.difficulties) {
    requiredLevels[row.difficulty] = row.requiredLevel
    if (row.from !== undefined || row.until !== undefined) {
      difficultyPeriods[row.difficulty] = {
        ...(row.from === undefined ? {} : { from: row.from }),
        ...(row.until === undefined ? {} : { until: row.until }),
      }
    }
  }
  return {
    key: boss.key,
    name: boss.name,
    alias: boss.alias,
    difficulties: boss.difficulties.map((row) => row.difficulty),
    requiredLevels,
    portraitSlug: boss.portraitSlug,
    section: SECTION_OF_CYCLE[boss.cycle],
    cycle: boss.cycle === 'monthly' ? 'monthly' : 'weekly',
    isSeasonBoss: boss.cycle === 'event_weekly',
    ...(boss.from === undefined ? {} : { from: boss.from }),
    ...(boss.until === undefined ? {} : { until: boss.until }),
    ...(Object.keys(difficultyPeriods).length === 0 ? {} : { difficultyPeriods }),
  }
}

/** API 이름을 맞추는 규칙. NFC 로 맞추고 공백을 모두 지운다. 공백 방향이 보스마다 달라서다. */
function comparableName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '')
}

interface CatalogIndex {
  entries: readonly BossEntry[]
  byKey: Map<string, { entry: BossEntry; index: number }>
  keyByComparableName: Map<string, string>
}

function indexOf(catalog: BossCatalog): CatalogIndex {
  const entries = catalog.bosses.map(toEntry)
  return {
    entries,
    byKey: new Map(entries.map((entry, index) => [entry.key, { entry, index }])),
    keyByComparableName: new Map(entries.map((entry) => [comparableName(entry.name), entry.key])),
  }
}

let index = indexOf(getBossCatalog())

/** 표의 차례(배열 순서)가 곧 앱 전체의 보스 순서다. 표가 덮이면 다시 대입하고, import 한 쪽은 바인딩으로 새 값을 본다. */
export let BOSS_ENTRIES: readonly BossEntry[] = index.entries

// 이름이 비슷하지만 단위가 다른 별개 한도라 나란히 둔다. CLEAR_LIMIT 은 캐릭터당 주간 보스 등록/처치
// 한도(12), CRYSTAL_SALE_LIMIT 은 월드당 주간 결정석 판매 한도(90).
export let WEEKLY_BOSS_CLEAR_LIMIT: number = getBossCatalog().rules.weeklyBossSelectionLimit
export let WEEKLY_CRYSTAL_SALE_LIMIT: number = getBossCatalog().rules.weeklyCrystalSaleLimit

subscribeBossCatalog(() => {
  const catalog = getBossCatalog()
  index = indexOf(catalog)
  BOSS_ENTRIES = index.entries
  WEEKLY_BOSS_CLEAR_LIMIT = catalog.rules.weeklyBossSelectionLimit
  WEEKLY_CRYSTAL_SALE_LIMIT = catalog.rules.weeklyCrystalSaleLimit
})

/** 표의 한 줄. 모르는 key 와 key 없음은 `null` 이다. */
export function findBoss(key: string | null | undefined): BossEntry | null {
  return key == null ? null : (index.byKey.get(key)?.entry ?? null)
}

/**
 * 보이는 보스 이름. 표 이름이고, 모르는 key 면 넘긴 이름이다.
 *
 * @example bossNameOf(record.bossKey, record.boss)
 */
export function bossNameOf(key: string | null | undefined, fallbackName: string): string {
  return findBoss(key)?.name ?? fallbackName
}

/**
 * 좁은 자리의 보스 이름. 표의 `alias` 이고, 모르는 key 면 넘긴 이름이다.
 *
 * @example bossAliasOf(boss.bossKey, boss.bossName)
 */
export function bossAliasOf(key: string | null | undefined, fallbackName: string): string {
  return findBoss(key)?.alias ?? fallbackName
}

/** API 이름(또는 옛 기록의 보스 이름)에서 key. 표에 없으면 `null` 이다. */
export function bossKeyOfApiName(name: string): string | null {
  return index.keyByComparableName.get(comparableName(name)) ?? null
}

/** 표의 차례. 표에 없는 key 는 맨 뒤(`Number.MAX_SAFE_INTEGER`)다. */
export function bossReferenceOrder(key: string | null | undefined): number {
  return key == null ? Number.MAX_SAFE_INTEGER : (index.byKey.get(key)?.index ?? Number.MAX_SAFE_INTEGER)
}

/** 주기. 표에 없는 key 는 `null` 이다. */
export function bossCycleOf(key: string | null | undefined): BossCycle | null {
  return findBoss(key)?.cycle ?? null
}

export function isSeasonBoss(key: string | null | undefined): boolean {
  return findBoss(key)?.isSeasonBoss ?? false
}

/** 지원 난이도. 표에 없는 key 는 빈 배열이다. */
export function supportedDifficultiesOf(key: string | null | undefined): BossDifficulty[] {
  return findBoss(key)?.difficulties ?? []
}

/** 보스+난이도의 요구 레벨. 표에 없거나 값이 없으면 `null` 이다. */
export function bossRequiredLevel(key: string | null | undefined, difficulty: BossDifficulty): number | null {
  return findBoss(key)?.requiredLevels[difficulty] ?? null
}

export function bossPortraitSlugOf(key: string | null | undefined): string | null {
  return findBoss(key)?.portraitSlug ?? null
}

export function bossesInSection(section: BossSection): BossEntry[] {
  return index.entries.filter((entry) => entry.section === section)
}

/**
 * 보스가 그 기간에 유효한가. 기간의 첫날이 `until` 앞이고 `from` 뒤면 참이다. 드롭 표 줄과 같은 판정이다.
 *
 * 표에 없는 key 는 참이다. 표가 못 가리는 보스를 여기서 숨기면 안 된다. 지난 기간은 그대로 서고 끝난 뒤의
 * 기간에서만 빠진다. 시즌 보스가 시즌이 끝난 뒤 새 챌린저스 월드에 서지 않게 하는 자리다.
 *
 * @param now 경계가 기간 첫날 안에 시각까지 들 때만 쓴다
 */
export function isBossActiveIn(
  key: string | null | undefined,
  periodKey: string,
  now?: Date,
  /**
   * 난이도까지 받으면 그 난이도의 기간이 보스의 기간을 **칸마다 덮는다**. 난이도 줄이 든 칸은 그 값이고, 안 든 칸은
   * 보스의 값이다. 보스 10-11 ~ 10-23 에 하드만 10-12 ~ 10-21 이면 하드는 후자, 나머지는 전자다.
   */
  difficulty?: BossDifficulty | string,
): boolean {
  const entry = findBoss(key)
  if (entry === null) return true
  const own = difficulty === undefined ? undefined : entry.difficultyPeriods?.[difficulty as BossDifficulty]
  return isEffectiveIn({ from: own?.from ?? entry.from, until: own?.until ?? entry.until }, periodKey, now)
}

/**
 * 그 기간에 유효한 난이도. 표 차례 그대로다. 난이도마다 보스의 기간을 자기 기간으로 덮어 본다. 표에 없는 key 는 빈 배열이다.
 *
 * 기록을 고치는 자리는 그 행의 난이도가 여기 없어도 남겨야 한다. 지난 기록이 기간 밖 난이도를 들 수 있어서다.
 */
export function activeDifficultiesOf(key: string | null | undefined, periodKey: string, now?: Date): BossDifficulty[] {
  const entry = findBoss(key)
  if (entry === null) return []
  return entry.difficulties.filter((difficulty) => isBossActiveIn(key, periodKey, now, difficulty))
}

/** 목록에 그 난이도가 없으면 표 차례 자리에 끼운다. 기록을 고치는 자리가 쓴다. 표에 없는 난이도는 맨 뒤다. */
export function withOwnDifficulty(active: BossDifficulty[], own: BossDifficulty | string): BossDifficulty[] {
  if ((active as string[]).includes(own)) return active
  const order = BOSS_DIFFICULTIES as readonly string[]
  const merged = [...active, own as BossDifficulty]
  return merged.sort((a, b) => (order.indexOf(a) === -1 ? order.length : order.indexOf(a)) - (order.indexOf(b) === -1 ? order.length : order.indexOf(b)))
}

/** 지금 기간에 유효한 난이도. 그 보스의 주기로 기간을 잡는다. */
export function activeDifficultiesNow(key: string | null | undefined, now: Date = new Date()): BossDifficulty[] {
  const entry = findBoss(key)
  if (entry === null) return []
  return activeDifficultiesOf(key, getCurrentBossProfitPeriod(entry.cycle, now).periodKey, now)
}

/** 지금 기간에 유효한 묶음의 보스. 관리 화면과 약속 보스 고르개가 쓴다. */
export function activeBossesInSection(section: BossSection, now: Date = new Date()): BossEntry[] {
  const periodKey = getCurrentBossProfitPeriod(section === 'monthly' ? 'monthly' : 'weekly', now).periodKey
  return bossesInSection(section).filter((entry) => activeDifficultiesOf(entry.key, periodKey, now).length > 0)
}
