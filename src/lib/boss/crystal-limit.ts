/**
 * 주간 결정석 판매 한도를 따로 세는 묶음(한도 줄)을 가르는 규칙과, 한도를 넘긴 처치를 고르는 규칙.
 *
 * @see docs/features/boss-profit.md 의 `결정석 칸`
 */
import type { BossCycle } from '../../types/scheduler'
import { isChallengersWorld } from '../world/worlds'
import { compareBossOrder } from './boss-matching'
import { isSeasonBoss } from './bosses'

/** 게임이 한도를 메이플 ID 마다 세기 시작한 주의 키(목요일, KST). 세는 방식도 함께 바뀌어 서버 표가 아닌 코드의 값 */
export const CRYSTAL_LIMIT_PER_MAPLE_ID_FROM = '2026-11-19'

/** 메이플 ID 안에서 챌린저스가 아닌 월드를 함께 세는 한도 줄의 열쇠 */
export const GENERAL_LIMIT_LINE = 'general'

/** 그 주가 한도를 메이플 ID 마다 세는 주인지 여부. 아니면 월드마다 세는 주 */
export function countsCrystalLimitPerMapleId(weekKey: string): boolean {
  return weekKey >= CRYSTAL_LIMIT_PER_MAPLE_ID_FROM
}

/**
 * 메이플 ID 안에서 그 월드가 드는 한도 줄의 열쇠.
 *
 * @param weekKey 주 키(목요일 `YYYY-MM-DD`)
 * @returns 메이플 ID 마다 세는 주는 챌린저스 월드만 제 월드 key 이고 나머지는 `general`, 그 전 주는 월드 key
 */
export function crystalLimitLineKey(worldKey: string, weekKey: string): string {
  if (!countsCrystalLimitPerMapleId(weekKey)) return worldKey
  return isChallengersWorld(worldKey) ? worldKey : GENERAL_LIMIT_LINE
}

/** 한도 판정에 드는 처치 기록 한 건. */
export interface CrystalLimitRecord {
  /** 기간 행 id */
  id: string
  ocid: string
  bossKey: string
  difficulty: string
  cycle: BossCycle
  /** 주 키(목요일 `YYYY-MM-DD`) */
  periodKey: string
  worldKey: string | null
  /** 0 으로 읽기 전의 결정석 내 몫 */
  payoutMeso: number
  /** 분배 방식 `제외`. 판 결정석이 아니라 한도에 안 든다 */
  crystalExcluded: boolean
}

export interface CrystalLimitOptions {
  /** 한도 줄 하나의 주간 판매 한도 */
  limit: number
  /** ocid → 메이플 ID. 없는 캐릭터의 기록은 어느 한도 줄에도 안 든다 */
  mapleIdOfOcid: Readonly<Record<string, string>>
  /** 캐릭터 관리의 추적 순서. 내 몫이 같을 때 앞 캐릭터부터 고른다 */
  orderedOcids: readonly string[]
}

/**
 * 한도 줄마다 넘친 개수만큼, 내 몫이 낮은 처치부터 고르는 함수.
 *
 * @returns 0 메소로 읽을 기간 행 id
 */
export function overCrystalLimitIds(
  records: readonly CrystalLimitRecord[],
  options: CrystalLimitOptions,
): Set<string> {
  const lines = new Map<string, CrystalLimitRecord[]>()
  for (const record of records) {
    if (record.cycle !== 'weekly' || isSeasonBoss(record.bossKey) || record.crystalExcluded) continue
    if (record.worldKey === null) continue
    const mapleId = options.mapleIdOfOcid[record.ocid]
    if (mapleId === undefined) continue
    const key = `${record.periodKey}|${mapleId}|${crystalLimitLineKey(record.worldKey, record.periodKey)}`
    lines.set(key, [...(lines.get(key) ?? []), record])
  }

  const rankOf = new Map(options.orderedOcids.map((ocid, index) => [ocid, index]))
  const rank = (ocid: string): number => rankOf.get(ocid) ?? Number.POSITIVE_INFINITY
  const over = new Set<string>()
  for (const line of lines.values()) {
    if (line.length <= options.limit) continue
    const ordered = [...line].sort(
      (left, right) =>
        left.payoutMeso - right.payoutMeso ||
        compareRank(rank(left.ocid), rank(right.ocid)) ||
        (left.ocid === right.ocid ? 0 : left.ocid < right.ocid ? -1 : 1) ||
        compareBossOrder({ boss: left.bossKey, difficulty: left.difficulty }, { boss: right.bossKey, difficulty: right.difficulty }),
    )
    for (const record of ordered.slice(0, line.length - options.limit)) over.add(record.id)
  }
  return over
}

/** 모르는 차례(무한대)끼리는 같다고 보는 비교. 빼면 NaN 이 되어 차례가 흔들린다 */
function compareRank(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1
}
