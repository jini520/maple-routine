/**
 * 추적 캐릭터가 **직접 적은 완료**(`bossKey|difficulty`)를 캐릭터별로 드는 쿼리. 이번 주 · 이번 달 기록만 본다.
 *
 * 스케줄 캐시에 안 쓰고 따로 드는 이유는 다음 동기화가 캐시를 덮기 때문이다. 표시 판정(`displayedBosses`)이 이 값을 받아
 * 카드 · 주간 한도 · today 남은 스케줄에 함께 얹는다.
 *
 * 기간 키가 열쇠다. 목요일 · 1일을 넘기면 화면이 새 열쇠를 읽어 지난주 완료가 안 남는다. 보스 기록의 판이 오르거나 추적
 * 목록이 바뀌면 무효화된다. 전에는 스토어가 기록 판과 기간을 이어 붙인 표식을 포커스마다 견줬다.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import { getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'
import { manualCompletionKey } from '../../lib/boss/manual-completion'
import { getManualBossProfitRecordKeys } from '../../storage/boss-profit'
import { queryKeys } from '../query/keys'
import { readTrackedOcids } from '../schedule-sync/schedule-query'

export type ManualCompletedByOcid = Readonly<Record<string, string[]>>

const EMPTY: ManualCompletedByOcid = {}

/**
 * 실패하면 빈 표다. 그 회차의 카드가 넥슨이 준 그대로 서고 다음 회차가 다시 읽는다. 여기서 던지면 스케줄러 화면 전체가 못 선다.
 */
export async function readManualCompleted(
  ocids: readonly string[],
  periodKeys: readonly string[],
): Promise<ManualCompletedByOcid> {
  if (ocids.length === 0) return EMPTY
  const byOcid: Record<string, string[]> = {}
  try {
    for (const record of await getManualBossProfitRecordKeys([...ocids], [...periodKeys])) {
      const keys = byOcid[record.ocid] ?? []
      keys.push(manualCompletionKey(record.bossKey, record.difficulty))
      byOcid[record.ocid] = keys
    }
  } catch {
    return EMPTY
  }
  return byOcid
}

export function manualCompletedOptions(now: Date) {
  const weeklyKey = getCurrentBossProfitPeriod('weekly', now).periodKey
  const monthlyKey = getCurrentBossProfitPeriod('monthly', now).periodKey
  return queryOptions<ManualCompletedByOcid>({
    queryKey: queryKeys.manualCompleted(weeklyKey, monthlyKey),
    queryFn: async () => readManualCompleted((await readTrackedOcids()) ?? [], [weeklyKey, monthlyKey]),
    staleTime: Number.POSITIVE_INFINITY,
    meta: { tables: ['boss_profit_records'], dependsOn: ['tracked-ocids'] },
  })
}

/** 아직 못 읽었으면 빈 표다. 카드가 넥슨이 준 완료만 그리다가 읽히면 직접 적은 것이 얹힌다. */
export function useManualCompleted(now: Date): ManualCompletedByOcid {
  const { data } = useQuery(manualCompletedOptions(now))
  return data ?? EMPTY
}
