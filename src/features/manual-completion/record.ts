/**
 * 직접 적은 완료를 쓰고 · 고치고 · 지우는 자리.
 *
 * 기록은 자동 기록과 **같은 표**(`boss_profit_records`)에 들어가고 `source` 칸만 다르다. 세는 방법이
 * 한 글자도 안 달라야 스케줄러 카드 · 주간 한도 · 가계부가 같은 값을 말한다.
 *
 * 금액은 여기서 계산한다. 그 기간의 가격 줄과 파티 인원으로 `floor(priceMeso / partySize)` 이고,
 * 자동 기록이 쓰는 식과 같은 것이다.
 */
import { findPriceEntry } from '../../lib/boss/boss-crystal-prices'
import { getBossDropRecords, replaceBossDropRecords } from '../../storage/boss-drops'
import { getBossPartySize } from '../../storage/boss-party-settings'
import {
  deleteBossProfitRecord,
  setBossProfitDefeatedOn,
  upsertBossProfitRecord,
  type BossProfitRecordKey,
} from '../../storage/boss-profit'
import type { BossCycle, BossDifficulty } from '../../types'
import { migrateDropsToConfirmedDifficulty } from '../boss-profit/drops-loader'
import { withSqliteFallback } from '../boss-profit/sqlite-guards'

export interface ManualCompletionInput {
  ocid: string
  bossKey: string
  /** 기록에 박을 보스 이름. 보이는 이름은 보스 표에서 찾는다. */
  bossName: string
  cycle: BossCycle
  periodKey: string
  difficulty: BossDifficulty
  partySize: number
  /** 잡은 날(KST `YYYY-MM-DD`). 사용자가 고른 날이고 날짜 캐기가 다시 안 정한다. */
  defeatedOn: string
  world: string | null
  worldKey: string | null
  /** 고치기 전 난이도. 바뀌었으면 옛 키의 기록을 지우고 드롭을 새 키로 옮긴다. */
  previousDifficulty?: BossDifficulty
}

/**
 * 파티 관리에 설정된 그 보스 · 그 난이도의 인원. 없거나 읽기가 실패하면 `null` 이다.
 *
 * 완료 기록 시트가 이 값으로 시작한다. 실패를 `null` 로 삼키는 것은 인원을 못 읽었다고 시트를 못
 * 여는 것보다 1 인으로 여는 편이 낫기 때문이다(자동 기록과 같은 기본값).
 */
export async function loadConfiguredPartySize(
  ocid: string,
  bossKey: string,
  difficulty: BossDifficulty,
): Promise<number | null> {
  return withSqliteFallback(getBossPartySize(ocid, bossKey, difficulty), null)
}

/** 가격을 모르는 조합은 기록할 수 없다. 금액 없이 완료만 남으면 이 화면이 세는 것이 틀린다. */
export class UnpricedBossError extends Error {
  constructor() {
    super('결정석 가격을 모르는 보스입니다')
    this.name = 'UnpricedBossError'
  }
}

/**
 * 직접 적은 완료 한 줄을 쓴다. 이미 있으면 그 줄을 고친다.
 *
 * 난이도를 바꾸면 기록 키가 바뀌므로 **옛 줄을 지우고** 드롭을 새 키로 옮긴다. 드롭 이관은 난이도가
 * 확정될 때 쓰는 그 함수라, 새 난이도에서 못 얻는 아이템은 그쪽이 거른다.
 */
export async function saveManualCompletion(input: ManualCompletionInput, now: Date): Promise<void> {
  const price = findPriceEntry(input.bossKey, input.difficulty, input.periodKey, now)
  if (price === undefined || price.priceMeso === null) {
    throw new UnpricedBossError()
  }

  const changedDifficulty =
    input.previousDifficulty !== undefined && input.previousDifficulty !== input.difficulty

  await upsertBossProfitRecord({
    ocid: input.ocid,
    bossKey: input.bossKey,
    boss: input.bossName,
    difficulty: input.difficulty,
    cycle: input.cycle,
    periodKey: input.periodKey,
    partySize: input.partySize,
    priceMeso: price.priceMeso,
    payoutMeso: Math.floor(price.priceMeso / input.partySize),
    recordedAt: now.toISOString(),
    world: input.world,
    worldKey: input.worldKey,
    source: 'manual',
  })
  await setBossProfitDefeatedOn(
    {
      ocid: input.ocid,
      bossKey: input.bossKey,
      difficulty: input.difficulty,
      periodKey: input.periodKey,
    },
    input.defeatedOn,
  )

  if (!changedDifficulty) return

  // 옛 난이도의 드롭을 새 키로 옮긴 뒤에 옛 줄을 지운다. 순서를 바꾸면 그 사이에 앱이 죽었을 때
  // 드롭만 남고 기록이 사라진다.
  const drops = await getBossDropRecords([input.ocid], [input.periodKey])
  await migrateDropsToConfirmedDifficulty(
    {
      ocid: input.ocid,
      bossKey: input.bossKey,
      difficulty: input.difficulty,
      periodKey: input.periodKey,
    },
    drops,
    now,
  )
  await deleteBossProfitRecord({
    ocid: input.ocid,
    bossKey: input.bossKey,
    difficulty: input.previousDifficulty as BossDifficulty,
    periodKey: input.periodKey,
  })
}

/**
 * 직접 적은 완료를 취소한다. **그 기록의 드롭도 함께 지운다.**
 *
 * 남기면 고아 드롭이 된다. 정리 회차가 언젠가 지우지만 그때까지 드롭만 있는 행이 화면에 선다.
 */
export async function cancelManualCompletion(key: BossProfitRecordKey, now: Date): Promise<void> {
  await replaceBossDropRecords(
    key.ocid,
    key.bossKey,
    key.difficulty,
    key.periodKey,
    [],
    now.toISOString(),
  )
  await deleteBossProfitRecord(key)
}
