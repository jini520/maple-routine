/**
 * 사용 로그를 적는 자리. 적기가 실패해도 던지지 않는다. 사용자가 하던 일을 사용 로그 때문에 막지 않는다.
 *
 * @example recordUsageAction('drop-save')
 */
import { appendUsageEvent } from '../../storage/usage-events'
import type { UsageEvent } from '../../types/usage-event'
import { createUsageTracker } from './tracker'

/** 세는 동작. 다른 동작을 셀 때는 여기에 이름을 더하고 부르는 자리를 더한다. */
export type UsageActionName = 'drop-save' | 'cashbook-add'

async function appendQuietly(event: UsageEvent): Promise<void> {
  try {
    await appendUsageEvent(event)
  } catch {
    // 저장소가 안 열렸다. 사건 하나를 잃는다.
  }
}

export const usageTracker = createUsageTracker(appendQuietly)

export function recordUsageAction(name: UsageActionName): void {
  void appendQuietly({ type: 'action', name, durationMs: null, at: new Date().toISOString() })
}
