/**
 * 월드 리프한 기간에 같은 처치가 옛 ocid 와 새 ocid 로 한 번씩 선 기록의 짝짓기.
 *
 * 리프 전 완료가 새 ocid 로 넘어와 자동 기록이 같은 처치를 한 번 더 쓴다. 기록 키가 ocid 를 품어
 * upsert 가 그 중복을 못 막으므로, 짝을 찾아 옛 기록을 지우고 새 기록 하나로 센다.
 */
import { dropTileIdentity } from '../../lib/boss/boss-drops'
import { getBossDropRecords, replaceBossDropRecords, type BossDropRecord } from '../../storage/boss-drops'
import {
  deleteBossProfitRecord,
  getBossProfitRecords,
  getEarliestBossProfitPeriodKeys,
  upsertBossProfitRecord,
  type BossProfitRecord,
} from '../../storage/boss-profit'
import { getCharacterWorldLeaps, type CharacterWorldLeap } from '../../storage/character-world-leaps'
import type { BossCycle } from '../../types'
import type { RecordedDrop } from '../../types/drops'
import { toRecordedDrop } from './rows'

export interface WorldLeapRecordPair {
  /** 지울 옛 기록 */
  stale: BossProfitRecord
  /** 남길 새 기록. 파티원 수를 옛 값으로 덮었으면 바뀐 `partySize`·`payoutMeso` 를 든다 */
  kept: BossProfitRecord
  /** `kept` 를 다시 써야 하는가 */
  keptChanged: boolean
}

export interface WorldLeapRecordPairsInput {
  fromOcid: string
  toOcid: string
  /**
   * 새 ocid 의 주기별 가장 이른 기록 기간(`getEarliestBossProfitPeriodKeys`). 리프한 주와 그 달이다.
   *
   * 새 ocid 는 리프 전 날짜를 못 불러 그 앞 기간 기록을 가질 수 없다. 짝을 이 기간에서만 찾는 것은
   * 연결이 틀렸을 때 다른 기간의 기록을 지키기 위해서다.
   */
  leapPeriodKeys: Partial<Record<BossCycle, string>>
  records: readonly BossProfitRecord[]
}

/**
 * 옛 기록을 지우고 새 기록을 남길 짝들.
 *
 * 새 기록의 파티원 수는 **1 일 때만** 옛 값으로 덮는다. 새 ocid 는 설정이 없어 대개 기본값 1 로
 * 기록되고, 2 이상은 사용자가 새 카드에서 고친 값이다.
 */
export function planWorldLeapRecordPairs(input: WorldLeapRecordPairsInput): WorldLeapRecordPair[] {
  const inLeapPeriod = (record: BossProfitRecord): boolean =>
    input.leapPeriodKeys[record.cycle] === record.periodKey

  const pairs: WorldLeapRecordPair[] = []
  for (const stale of input.records) {
    if (stale.ocid !== input.fromOcid || !inLeapPeriod(stale)) continue

    const kept = input.records.find(
      (candidate) =>
        candidate.ocid === input.toOcid &&
        candidate.bossKey === stale.bossKey &&
        candidate.difficulty === stale.difficulty &&
        candidate.periodKey === stale.periodKey,
    )
    if (kept === undefined) continue

    if (kept.partySize === 1 && stale.partySize !== 1) {
      const partySize = stale.partySize
      pairs.push({
        stale,
        kept: { ...kept, partySize, payoutMeso: Math.floor(kept.priceMeso / partySize) },
        keptChanged: true,
      })
      continue
    }
    pairs.push({ stale, kept, keptChanged: false })
  }
  return pairs
}

/**
 * 새 카드 드롭에 옛 카드 드롭을 합친 목록.
 *
 * 같은 드롭은 같은 타일(`dropTileIdentity`)이다. 새 카드 드롭은 그대로 두고, 옛 카드 드롭은 새 카드에 없는
 * 타일만 앞선 하나씩 붙인다. 한 카드는 같은 타일을 하나만 든다(`BossDropSheet`).
 */
export function mergeWorldLeapDrops(
  keptDrops: readonly RecordedDrop[],
  staleDrops: readonly RecordedDrop[],
): RecordedDrop[] {
  const seenTiles = new Set(keptDrops.map(dropTileIdentity))
  const appended = staleDrops.filter((drop) => {
    const tile = dropTileIdentity(drop)
    if (seenTiles.has(tile)) return false
    seenTiles.add(tile)
    return true
  })
  return [...keptDrops, ...appended]
}

function dropsOf(drops: readonly BossDropRecord[], record: BossProfitRecord): RecordedDrop[] {
  return drops
    .filter(
      (drop) =>
        drop.ocid === record.ocid &&
        drop.bossKey === record.bossKey &&
        drop.difficulty === record.difficulty &&
        drop.periodKey === record.periodKey,
    )
    .sort((a, b) => a.dropIndex - b.dropIndex)
    .map(toRecordedDrop)
}

async function cleanUpLink(link: CharacterWorldLeap, now: Date): Promise<number> {
  const leapPeriodKeys = await getEarliestBossProfitPeriodKeys(link.toOcid)
  const periodKeys = Object.values(leapPeriodKeys)
  if (periodKeys.length === 0) {
    return 0
  }

  const ocids = [link.fromOcid, link.toOcid]
  const pairs = planWorldLeapRecordPairs({
    fromOcid: link.fromOcid,
    toOcid: link.toOcid,
    leapPeriodKeys,
    records: await getBossProfitRecords(ocids, periodKeys),
  })
  if (pairs.length === 0) {
    return 0
  }

  const drops = await getBossDropRecords(ocids, periodKeys)
  const recordedAt = now.toISOString()
  // 쓰기는 차례로 한다. 단일 공유 커넥션이라 겹치면 트랜잭션이 던진다.
  for (const { stale, kept, keptChanged } of pairs) {
    const keptDrops = dropsOf(drops, kept)
    const staleDrops = dropsOf(drops, stale)
    const merged = mergeWorldLeapDrops(keptDrops, staleDrops)

    // 새 쪽을 먼저 쓰고 옛 쪽을 지운다. 중간에 앱이 죽어도 다음 회차가 같은 짝을 다시 찾고, 이미 합친
    // 드롭은 같은 타일이라 다시 안 붙는다.
    if (merged.length > keptDrops.length) {
      await replaceBossDropRecords(kept.ocid, kept.bossKey, kept.difficulty, kept.periodKey, merged, recordedAt)
    }
    if (keptChanged) {
      await upsertBossProfitRecord(kept)
    }
    if (staleDrops.length > 0) {
      await replaceBossDropRecords(stale.ocid, stale.bossKey, stale.difficulty, stale.periodKey, [], recordedAt)
    }
    await deleteBossProfitRecord(stale)
  }
  return pairs.length
}

/**
 * 이어진 두 ocid 마다 리프한 기간의 중복 기록을 정리하는 회차. 지운 옛 기록 수를 돌려준다.
 *
 * 연결은 `character_world_leaps` 에서만 읽는다. 이름·직업 연결은 `character/list` 를 받은 자리가 먼저 써
 * 둔다. 기록을 쓰는 두 자리(창 기록 · 자동 기록) 뒤에서 부른다.
 */
export async function cleanUpWorldLeapDuplicates(now: Date): Promise<number> {
  let removed = 0
  for (const link of await getCharacterWorldLeaps()) {
    try {
      removed += await cleanUpLink(link, now)
    } catch {
      // 한 연결의 실패가 나머지를 막으면 안 된다. 다음 회차가 같은 짝을 다시 찾는다.
    }
  }
  return removed
}
