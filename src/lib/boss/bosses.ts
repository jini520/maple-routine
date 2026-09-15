/**
 * 보스 마스터 표(`src/data/weekly-bosses.json`) 조회. 보스를 key 로 찾는 자리는 전부 이 모듈을 거친다.
 *
 * 기록 · 캐시 · 데이터 파일은 보스 key 를 들고, 이름 · 주기 · 요구 레벨 · 초상은 이 표에서 찾는다.
 * API 이름에서 key 를 얻는 규칙도 여기 하나다(`bossKeyOfApiName`).
 */
import weeklyBossesData from '../../data/weekly-bosses.json'
import type { BossCycle, BossDifficulty } from '../../types'

/** 관리 화면의 묶음. 시즌 보스(eventWeekly)도 주기는 주간이다. */
export type BossSection = 'weekly' | 'eventWeekly' | 'monthly'

export interface BossEntry {
  key: string
  /** Nexon API `content_name` 표기. 화면에 보이는 이름이다. */
  name: string
  difficulties: BossDifficulty[]
  requiredLevels?: Partial<Record<BossDifficulty, number>>
  portraitSlug?: string
  /** 출시 전 보스. 표에는 남기고 보스 관리 목록에서만 숨긴다. 출시되면 이 칸을 지운다. */
  status?: 'unreleased'
  section: BossSection
  cycle: BossCycle
  /** 시즌 보스는 주간 12마리 한도와 결정석 판매 수에서 빠진다. */
  isSeasonBoss: boolean
}

type RawBossEntry = Omit<BossEntry, 'section' | 'cycle' | 'isSeasonBoss'>

function entriesOf(section: BossSection): BossEntry[] {
  return (weeklyBossesData[section] as RawBossEntry[]).map((entry) => ({
    ...entry,
    section,
    cycle: section === 'monthly' ? 'monthly' : 'weekly',
    isSeasonBoss: section === 'eventWeekly',
  }))
}

/** 표의 차례(weekly → eventWeekly → monthly)가 곧 앱 전체의 보스 순서다. */
export const BOSS_ENTRIES: readonly BossEntry[] = [
  ...entriesOf('weekly'),
  ...entriesOf('eventWeekly'),
  ...entriesOf('monthly'),
]

// 이름이 비슷하지만 단위가 다른 별개 한도라 나란히 둔다. CLEAR_LIMIT 은 캐릭터당 주간 보스 등록/처치
// 한도(12), CRYSTAL_SALE_LIMIT 은 월드당 주간 결정석 판매 한도(90).
export const WEEKLY_BOSS_CLEAR_LIMIT: number = weeklyBossesData.weeklyBossSelectionLimit
export const WEEKLY_CRYSTAL_SALE_LIMIT: number = weeklyBossesData.weeklyCrystalSaleLimit

const entryByKey = new Map(BOSS_ENTRIES.map((entry, index) => [entry.key, { entry, index }]))

/** API 이름을 맞추는 규칙. NFC 로 맞추고 공백을 모두 지운다. 공백 방향이 보스마다 달라서다. */
function comparableName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '')
}

const keyByComparableName = new Map(BOSS_ENTRIES.map((entry) => [comparableName(entry.name), entry.key]))

/** 표의 한 줄. 모르는 key 와 key 없음은 `null` 이다. */
export function findBoss(key: string | null | undefined): BossEntry | null {
  return key == null ? null : (entryByKey.get(key)?.entry ?? null)
}

/**
 * 보이는 보스 이름. 표 이름이고, 모르는 key 면 넘긴 이름이다.
 *
 * @example bossNameOf(record.bossKey, record.boss)
 */
export function bossNameOf(key: string | null | undefined, fallbackName: string): string {
  return findBoss(key)?.name ?? fallbackName
}

/** API 이름(또는 옛 기록의 보스 이름)에서 key. 표에 없으면 `null` 이다. */
export function bossKeyOfApiName(name: string): string | null {
  return keyByComparableName.get(comparableName(name)) ?? null
}

/** 표의 차례. 표에 없는 key 는 맨 뒤(`Number.MAX_SAFE_INTEGER`)다. */
export function bossReferenceOrder(key: string | null | undefined): number {
  return key == null ? Number.MAX_SAFE_INTEGER : (entryByKey.get(key)?.index ?? Number.MAX_SAFE_INTEGER)
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
  return findBoss(key)?.requiredLevels?.[difficulty] ?? null
}

export function bossPortraitSlugOf(key: string | null | undefined): string | null {
  return findBoss(key)?.portraitSlug ?? null
}

export function bossesInSection(section: BossSection): BossEntry[] {
  return BOSS_ENTRIES.filter((entry) => entry.section === section)
}
