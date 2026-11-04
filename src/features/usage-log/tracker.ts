/**
 * 방문과 화면 사건을 적는 시점을 정하는 상태.
 *
 * 화면은 떠날 때 머문 시간과 함께 적는다. 백그라운드로 가는 것도 떠나는 것이라, 백그라운드에 있던 시간은 체류에 들지 않는다.
 * 돌아오면 같은 화면을 새로 잰다.
 */
import type { UsageEvent } from '../../types/usage-event'

/** 이만큼 비웠다 돌아오면 방문을 새로 센다. 짧으면 알림을 잠깐 본 것까지 방문으로 잡힌다. */
export const VISIT_GAP_MS = 30 * 60_000

export interface UsageTracker {
  /** 앱을 새로 열었다 */
  start(now: Date): Promise<void>
  background(now: Date): Promise<void>
  foreground(now: Date): Promise<void>
  /** 보이는 화면의 라우트 이름 */
  screen(name: string, now: Date): Promise<void>
}

/** @param append 사건 하나를 기기 표에 적는 함수 */
export function createUsageTracker(append: (event: UsageEvent) => Promise<void>): UsageTracker {
  let current: { name: string; since: Date } | null = null
  let pausedName: string | null = null
  let backgroundAt: Date | null = null

  const visit = (now: Date) => append({ type: 'visit', name: '', durationMs: null, at: now.toISOString() })

  async function leave(now: Date): Promise<void> {
    if (current === null) return
    const { name, since } = current
    current = null
    await append({ type: 'screen', name, durationMs: now.getTime() - since.getTime(), at: since.toISOString() })
  }

  return {
    start: visit,
    async background(now) {
      if (backgroundAt !== null) return
      backgroundAt = now
      pausedName = current?.name ?? null
      await leave(now)
    },
    async foreground(now) {
      if (backgroundAt === null) return
      const away = now.getTime() - backgroundAt.getTime()
      backgroundAt = null
      if (pausedName !== null) current = { name: pausedName, since: now }
      pausedName = null
      if (away >= VISIT_GAP_MS) await visit(now)
    },
    async screen(name, now) {
      if (backgroundAt !== null) {
        // 백그라운드에서 화면이 바뀌면(알림을 눌러 연 화면 등) 돌아올 때 그 화면부터 잰다.
        pausedName = name
        return
      }
      if (current?.name === name) return
      await leave(now)
      current = { name, since: now }
    },
  }
}
