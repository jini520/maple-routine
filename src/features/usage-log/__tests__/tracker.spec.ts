/**
 * 방문과 화면 사건을 언제 적는지. 방문을 너무 자주 세거나 체류에 백그라운드 시간을 넣으면 관리 화면의 숫자가 부푼다.
 */
import { createUsageTracker, VISIT_GAP_MS } from '../tracker'
import type { UsageEvent } from '../../../types/usage-event'

const T0 = Date.parse('2026-11-04T01:00:00.000Z')
const at = (ms: number) => new Date(T0 + ms)

function setup() {
  const events: UsageEvent[] = []
  const tracker = createUsageTracker(async (event) => {
    events.push(event)
  })
  return { events, tracker }
}

describe('방문', () => {
  it('앱을 새로 열면 방문을 적는다', async () => {
    const { events, tracker } = setup()

    await tracker.start(at(0))

    expect(events).toEqual([{ type: 'visit', name: '', durationMs: null, at: at(0).toISOString() }])
  })

  it('30분 넘게 비웠다 돌아오면 방문을 적고, 그보다 짧으면 안 적는다', async () => {
    const { events, tracker } = setup()
    await tracker.start(at(0))

    await tracker.background(at(1000))
    await tracker.foreground(at(1000 + VISIT_GAP_MS - 1))
    await tracker.background(at(2 * VISIT_GAP_MS))
    await tracker.foreground(at(3 * VISIT_GAP_MS))

    expect(events.filter((event) => event.type === 'visit').map((event) => event.at)).toEqual([
      at(0).toISOString(),
      at(3 * VISIT_GAP_MS).toISOString(),
    ])
  })
})

describe('화면', () => {
  it('화면이 바뀌면 앞 화면을 머문 시간과 함께 적는다', async () => {
    const { events, tracker } = setup()

    await tracker.screen('Today', at(0))
    await tracker.screen('Boss', at(4000))

    expect(events).toEqual([{ type: 'screen', name: 'Today', durationMs: 4000, at: at(0).toISOString() }])
  })

  // 상태 변화는 같은 화면 안에서도 온다(파라미터 · 안쪽 스택). 그때마다 적으면 본 횟수가 부푼다.
  it('같은 화면으로 상태만 바뀌면 적지 않는다', async () => {
    const { events, tracker } = setup()

    await tracker.screen('Today', at(0))
    await tracker.screen('Today', at(1000))

    expect(events).toEqual([])
  })

  // 넣으면 앱을 켜 둔 채 잠든 하룻밤이 그 화면의 체류로 잡힌다.
  it('백그라운드로 가면 그 화면을 끊어 적고, 돌아오면 같은 화면을 다시 잰다', async () => {
    const { events, tracker } = setup()
    await tracker.screen('Boss', at(0))

    await tracker.background(at(3000))
    await tracker.foreground(at(60_000))
    await tracker.screen('Today', at(62_000))

    expect(events.filter((event) => event.type === 'screen')).toEqual([
      { type: 'screen', name: 'Boss', durationMs: 3000, at: at(0).toISOString() },
      { type: 'screen', name: 'Boss', durationMs: 2000, at: at(60_000).toISOString() },
    ])
  })
})
