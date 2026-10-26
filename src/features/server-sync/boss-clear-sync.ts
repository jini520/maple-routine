/**
 * 보스 처치 기간을 서버로 보내는 종류. 기기가 기준이고 서버는 사본이다.
 *
 * 처치를 쓰는 자리(동기화 · 직접 완료 · 날짜 채우기 · 수수료 다시 매기기 등)가 바뀐 기간 행 id 를 대기 표에 넣고 전송을
 * 깨운다(`report.ts`). 한 번에 수백 건이 바뀌는 자리가 있어 건마다 바로 요청을 내지 않는다.
 */
import type { BossProfitRecordKey } from '../../storage/boss-profit'
import { enqueueServerSync } from '../../storage/server-sync-queue'
import { findBossPeriodIds, getBossClearSource, type BossClearSource } from '../../storage/server-sync-sources'
import { deleteBossClear, sendBossClear } from '../../server/records'
import type { BossClearPayload } from '../../types/server-records'
import type { SyncHandler } from './sweep'

/** 대기 표의 `record_type` 칸에 들어가는 값. */
export const BOSS_CLEAR_RECORD_TYPE = 'boss-clear'

/** 기간 행에서 서버로 보낼 값. 칸 이름만 서버 쪽으로 바꾼다. */
export function bossClearPayloadOf(source: BossClearSource): BossClearPayload {
  return {
    periodRecordId: source.periodId,
    ocid: source.ocid,
    boss: source.bossKey,
    difficulty: source.difficulty,
    cycle: source.cycle,
    periodKey: source.periodKey,
    worldKey: source.worldKey,
    priceMeso: source.priceMeso,
    payoutMeso: source.payoutMeso,
    splitMode: source.splitMode,
    partySize: source.partySize,
    myShare: source.myShare,
    sharesTotal: source.sharesTotal,
    splitFeePercent: source.splitFeePercent,
    defeatedDate: source.defeatedDate,
    source: source.source,
  }
}

/** 고리가 쓰는 함수 둘. 처치가 아니게 된 기간은 `null` 이고 서버에서 지운다. */
export const bossClearHandler: SyncHandler<BossClearPayload> = {
  read: async (periodId) => {
    const source = await getBossClearSource(periodId)
    return source === null ? null : bossClearPayloadOf(source)
  },
  send: (headers, periodId, value) => (value === null ? deleteBossClear(headers, periodId) : sendBossClear(headers, value)),
}

/**
 * 바뀐 기간 행을 대기 표에 넣는다. **던지지 않는다.** 사용자가 보는 것은 저장이고 전송은 거기 얹힌 일이다. 전송을 깨우는 것은
 * `report.ts` 다.
 *
 * @param now 대기 표에 적는 시각. 테스트가 고정한다
 */
export async function enqueueBossClears(periodIds: readonly string[], now: Date): Promise<void> {
  try {
    for (const id of periodIds) await enqueueServerSync(BOSS_CLEAR_RECORD_TYPE, id, now.toISOString())
  } catch {
    // 대기 표를 못 열었다. 기기 저장은 끝났고, 이 기록은 과거 올리기도 이미 지났다면 다음 저장 때 다시 들어간다.
  }
}

/** 키로 쓰는 자리용. 행이 없는 키는 건너뛴다. 지운 기간은 키로 못 찾으므로 지우기 전에 부른다. */
export async function enqueueBossClearsOf(keys: readonly BossProfitRecordKey[], now: Date): Promise<void> {
  const ids = await findBossPeriodIds(keys).catch(() => [])
  await enqueueBossClears(ids, now)
}
