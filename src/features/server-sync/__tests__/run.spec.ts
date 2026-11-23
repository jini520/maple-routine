/**
 * 한 번의 동기화. 올리기를 먼저 해야 아직 못 올린 기기 값이 받은 값에 덮이지 않고, 올리기의 거절로 지운 줄의 서버 값이 같은 동기화에
 * 들어온다.
 *
 * 처음 동기화는 거꾸로 받기를 먼저 끝낸다. 다른 기기가 먼저 올린 줄을 받아 유일 기준이 같은 기기 줄을 서버 id 로 바꾼 뒤에 올려야, 그
 * 줄이 `duplicate_record` 로 지워지며 드롭까지 사라지지 않는다.
 */
import type { FirstServerSync } from '../../../storage/server-sync-first'
import type { PullSummary } from '../pull'
import { runServerSync, type RunDeps } from '../run'

const DONE: FirstServerSync = { queuedAt: '2026-11-24T00:00:00.000Z', pulled: true }

function pulled(finished: boolean): PullSummary {
  return { pages: 1, applied: 0, skipped: 0, stopped: !finished, finished }
}

function setup(options: { first?: FirstServerSync | null; pulls?: boolean[] } = {}) {
  const order: string[] = []
  let first = options.first === undefined ? DONE : options.first
  const pulls = [...(options.pulls ?? [true, true])]
  const deps: RunDeps = {
    prepareAccounts: jest.fn(async () => {
      order.push('accounts')
    }),
    push: jest.fn(async (pushOptions) => {
      order.push(`push ${pushOptions.firstQueuedAt ?? '-'}`)
    }),
    pull: jest.fn(async (pullOptions) => {
      order.push(`pull ${pullOptions.firstQueuedAt ?? '-'}`)
      return pulled(pulls.shift() ?? true)
    }),
    identity: jest.fn(async () => ({ 'x-maple-id-hash': 'h' })),
    underMaintenance: jest.fn(async () => {
      order.push('maintenance')
      return false
    }),
    getFirstSync: jest.fn(async () => first),
    enqueueAll: jest.fn(async () => {
      order.push('enqueue')
      first = { queuedAt: 'Q', pulled: false }
      return first
    }),
    markPulled: jest.fn(async (marked: FirstServerSync) => {
      order.push('pulled')
      first = { ...marked, pulled: true }
    }),
  }
  return { deps, order }
}

it('처음 동기화를 마친 기기는 계정을 알리고 올린 뒤 받는다', async () => {
  const { deps, order } = setup()

  await runServerSync(deps)

  expect(order).toEqual(['accounts', `push ${DONE.queuedAt}`, 'pull -'])
  expect(deps.enqueueAll).not.toHaveBeenCalled()
})

// 남은 대기 줄의 기록은 받기가 건너뛰어 덮이지 않는다. 받기까지 멈추면 다른 기기의 기록이 그 동기화에 안 들어온다.
it('계정 알리기나 올리기가 던져도 받고, 받기가 던져도 던지지 않는다', async () => {
  const { deps } = setup()
  ;(deps.prepareAccounts as jest.Mock).mockRejectedValue(new Error('저장소'))
  ;(deps.push as jest.Mock).mockRejectedValue(new Error('저장소'))
  ;(deps.pull as jest.Mock).mockRejectedValue(new Error('저장소'))

  await expect(runServerSync(deps)).resolves.toBeUndefined()
  expect(deps.pull).toHaveBeenCalledTimes(1)
})

describe('처음 동기화', () => {
  // 처음 동기화의 받기만 id 없는 Preferences 기록의 서버 값을 남긴다. 올린 뒤의 받기는 평소 받기다.
  it('표시가 없으면 기록을 모두 넣고, 받기를 먼저 끝낸 뒤 올리고 한 번 더 받는다. 넣기를 마친 시각은 앞의 받기에만 넘긴다', async () => {
    const { deps, order } = setup({ first: null })

    await runServerSync(deps)

    expect(order).toEqual(['accounts', 'maintenance', 'enqueue', 'pull Q', 'pulled', 'push Q', 'pull -'])
  })

  // 다시 넣으면 받은 줄까지 대기 표에 들어가 서버로 되돌아간다.
  it('표시가 있으면 다시 넣지 않는다', async () => {
    const { deps } = setup({ first: null })

    await runServerSync(deps)
    await runServerSync(deps)

    expect(deps.enqueueAll).toHaveBeenCalledTimes(1)
    expect(deps.underMaintenance).toHaveBeenCalledTimes(1)
  })

  // 받지 못한 쪽에 유일 기준이 같은 서버 줄이 있으면 기기 줄이 서버 id 로 바뀌지 않은 채 올라가 지워진다.
  it('받기를 끝내지 못하면 올리지 않고, 다음 동기화가 받기부터 한다', async () => {
    const { deps, order } = setup({ first: null, pulls: [false, true, true] })

    await runServerSync(deps)
    expect(order).toEqual(['accounts', 'maintenance', 'enqueue', 'pull Q'])

    order.length = 0
    await runServerSync(deps)
    expect(order).toEqual(['accounts', 'pull Q', 'pulled', 'push Q', 'pull -'])
  })

  it('받기가 던져도 올리지 않는다', async () => {
    const { deps, order } = setup({ first: { queuedAt: 'Q', pulled: false } })
    ;(deps.pull as jest.Mock).mockRejectedValue(new Error('저장소'))

    await runServerSync(deps)

    expect(order).toEqual(['accounts'])
    expect(deps.push).not.toHaveBeenCalled()
    expect(deps.markPulled).not.toHaveBeenCalled()
  })

  // 신원이 없으면 받기를 끝낼 수 없다. 점검 중에는 새 서버가 아직 없다. 받기를 먼저 끝내야 해서 올리지도 않는다.
  it('신원이 없거나 점검 중이면 시작하지 않고 아무것도 보내지 않는다', async () => {
    const anonymous = setup({ first: null })
    ;(anonymous.deps.identity as jest.Mock).mockResolvedValue(null)
    await runServerSync(anonymous.deps)
    expect(anonymous.order).toEqual(['accounts'])

    const locked = setup({ first: null })
    ;(locked.deps.underMaintenance as jest.Mock).mockResolvedValue(true)
    await runServerSync(locked.deps)
    expect(locked.order).toEqual(['accounts'])
    expect(locked.deps.enqueueAll).not.toHaveBeenCalled()
  })
})
