/**
 * 당겨서 새로고침 하나. today 와 수익 · 지출 층이 부른다.
 *
 * 회차 → 13일 창 → 오늘 강화 내역 순이다. 회차가 지금 기간의 완료를 기록하고 처치 날짜를 캐며, 창은 조회 원장에 없는 지난
 * 날만 채운다. 창까지 채워야 처치 날짜 소거법에 필요한 어제 관측이 있고 기록이 아직 없는 지난 날이 비지 않는다. 오늘 강화는
 * 하루치라 어느 당김에나 든다. 전에는 today 를 당겨도 강화와 처치 날짜가 안 돌아 이번 주 수입 · 지출이 그대로였다.
 *
 * 컨텐츠 · 보스 스케줄러의 당김은 이것이 아니라 `refreshSchedules` 다. 그 두 화면은 창과 강화를 안 그린다.
 */
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { collectEnhancementHistory } from '../enhancement-history/collect'
import { readTrackedOcidsSync } from '../schedule-sync/read-schedule'
import { refreshSchedules } from '../schedule-sync/schedule-query'
import { syncScheduleWindow } from '../schedule-window/sync'

/** 오늘 하루의 강화 내역. 수집기가 오늘은 매번 다시 받는다. 던지지 않는다. */
export async function collectTodayEnhancement(now: Date): Promise<void> {
  await collectEnhancementHistory([getCurrentKstDateKey(now)], now).catch(() => undefined)
}

export async function pullRefresh(): Promise<void> {
  await refreshSchedules()
  const now = new Date()
  // 회차가 추적 목록을 읽었으므로 캐시에 있다. 추적이 없으면 채울 창도 없다.
  const ocids = readTrackedOcidsSync() ?? []
  if (ocids.length > 0) await syncScheduleWindow(ocids, now).catch(() => undefined)
  await collectTodayEnhancement(now)
}
