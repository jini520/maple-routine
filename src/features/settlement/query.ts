/**
 * 넥슨이 결산 중인가. today 와 수익 · 지출 층의 안내 줄이 이 쿼리를 본다.
 *
 * 복귀마다 받는다(`refetchOnWindowFocus: 'always'`). 새벽 결산 중 배경에 두었다가 돌아오면 다음 동기화 회차를 기다리지
 * 않고 줄이 걷힌다. 스케줄러를 부르는 회차 넷은 `refreshSettlement` 로 함께 묻는다. 겹친 호출은 쿼리가 하나로 접는다.
 *
 * 닫은 기록은 기기 값이라 쿼리가 아니라 아래 스토어(`useSettlementDismissal`)가 든다. 서버가 말하는 결산과 사용자가 닫은
 * 결산은 다른 사실이다.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { create } from 'zustand'

import { getKstDateKeyDaysAgo } from '../../lib/scheduler/reset-clock'
import { fetchSettlement } from '../../server/settlement'
import { dismissSettlement, getDismissedSettlementAt } from '../../storage/settlement-banner'
import type { Settlement } from '../../types/settlement'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'

/** 못 받은 것(`null`)과 결산 아님은 다른 사실이지만 화면이 하는 일은 같다. 둘 다 줄을 안 세운다. */
export const settlementOptions = queryOptions<Settlement | null>({
  queryKey: queryKeys.settlement(),
  queryFn: fetchSettlement,
  staleTime: Number.POSITIVE_INFINITY,
  refetchOnWindowFocus: 'always',
  meta: { source: 'server' },
})

/** 신선해도 다시 묻는다. 스케줄러를 부르는 회차가 부른다. 답이 늦어도 회차가 늦으면 안 되므로 기다리지 않는 것이 맞다. */
export async function refreshSettlement(): Promise<void> {
  await queryClient.fetchQuery({ ...settlementOptions, staleTime: 0 }).catch(() => undefined)
}

/** 결산을 먼저 읽는 시각의 끝(KST). 지금까지 잰 결산이 0시부터 2시 정각까지였다. */
const SETTLEMENT_READ_END_HOUR = 2
/** 받은 결산 상태를 다시 쓰는 시간. 서버는 10분마다 확인하므로 1분 늦어도 판정은 같다. */
const SETTLEMENT_REUSE_MS = 60_000

/**
 * 결산 중이라 넥슨에 묻지 않을 어제 날짜(KST). 아니면 `null`.
 *
 * 0시 ~ 2시 회차만 서버의 결산 상태를 먼저 읽는다. 넥슨 AI 에이전트 가이드가 `OPENAPI00009` 를 되풀이해 부르지 말라고 해서다.
 * 서버가 결산이 아니라거나 모른다고 하거나 답을 못 받으면 `null` 이다. 서버가 죽었을 때 어제 날짜를 아예 못 받으면 안 된다.
 *
 * @example const skip = await settlingYesterdayOf(now) // 그 날짜의 조회를 건너뛴다
 */
export async function settlingYesterdayOf(now: Date): Promise<string | null> {
  const kstHour = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCHours()
  if (kstHour >= SETTLEMENT_READ_END_HOUR) return null
  // 캐릭터마다 부르므로 1분 안의 답은 다시 쓴다. 매번 물으면 회차 하나가 우리 서버 nginx 의 속도 제한(초당 10건)에 닿는다.
  const settlement = await queryClient
    .fetchQuery({ ...settlementOptions, staleTime: SETTLEMENT_REUSE_MS })
    .catch(() => null)
  return settlement?.settling === true ? getKstDateKeyDaysAgo(now, 1) : null
}

interface SettlementDismissalState {
  /** 닫을 때 기억한 결산의 시작 시각. 기기에 남는다. 아직 안 읽었으면 `null`. */
  dismissedAt: string | null
  /** 저장된 값을 올린다. 읽은 뒤에는 다시 안 읽는다. */
  restore: () => Promise<void>
  /** 이번 결산을 닫는다. 시작 시각을 모르면 닫을 것도 없다. */
  dismiss: (startedAt: string | null) => Promise<void>
}

let restored: Promise<void> | null = null

export const useSettlementDismissal = create<SettlementDismissalState>()((set) => ({
  dismissedAt: null,
  restore() {
    restored ??= getDismissedSettlementAt()
      .then((dismissedAt) => set({ dismissedAt }))
      .catch(() => undefined)
    return restored
  },
  async dismiss(startedAt) {
    if (startedAt === null) return
    // 저장 실패는 삼킨다. 이번 실행 동안은 줄이 내려가고, 다음에 켜면 한 번 더 서는데 거짓이 아니라 이미 읽은 안내를
    // 다시 보는 일이다.
    await dismissSettlement(startedAt).catch(() => undefined)
    set({ dismissedAt: startedAt })
  },
}))

/** 테스트 전용. 복원 약속이 모듈 수준이라 테스트끼리 오염된다. */
export function resetSettlementDismissalForTests(): void {
  restored = null
  useSettlementDismissal.setState({ dismissedAt: null })
}

/** 결산 중이고 이번 결산을 안 닫았을 때만 참. */
export function isSettlementVisible(settlement: Settlement | null | undefined, dismissedAt: string | null): boolean {
  return settlement?.settling === true && settlement.startedAt !== null && settlement.startedAt !== dismissedAt
}

export interface SettlementBannerState {
  visible: boolean
  /** 이번 결산 동안 줄을 닫는다. 다음 밤 결산은 시작 시각이 달라 다시 선다. */
  dismiss: () => Promise<void>
}

export function useSettlementBanner(): SettlementBannerState {
  const { data } = useQuery(settlementOptions)
  const dismissedAt = useSettlementDismissal((state) => state.dismissedAt)
  const restore = useSettlementDismissal((state) => state.restore)
  // 닫은 기록은 기기에 있다. 앱을 다시 켠 뒤 첫 회차가 그것을 모르면 이미 닫은 줄이 한 번 선다.
  useEffect(() => {
    void restore()
  }, [restore])

  return {
    visible: isSettlementVisible(data, dismissedAt),
    dismiss: () => useSettlementDismissal.getState().dismiss(data?.startedAt ?? null),
  }
}
