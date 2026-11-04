/**
 * 쌓인 사건을 묶어 보내는 일. 실패한 묶음을 되살리면 기기 표가 커지고, 신원 없이 꺼내면 사건이 사라진다.
 */
import { flushUsageEvents, type FlushDeps } from '../flush'
import type { UsageEvent, UsageEventBatch } from '../../../types/usage-event'

const HEADERS = { 'x-api-key-hash': 'a'.repeat(64) }
const EVENT: UsageEvent = { type: 'visit', name: '', durationMs: null, at: '2026-11-04T01:00:00.000Z' }

function setup(over: Partial<FlushDeps> = {}) {
  const sent: UsageEventBatch[] = []
  const take = jest.fn(async () => [EVENT])
  const deps: FlushDeps = {
    identity: async () => HEADERS,
    take,
    send: async (_headers, batch) => {
      sent.push(batch)
      return { outcome: 'sent' }
    },
    platform: () => 'android',
    appVersion: () => '1.0.13',
    ...over,
  }
  return { deps, sent, take }
}

it('꺼낸 사건을 플랫폼 · 앱 버전과 묶어 보낸다', async () => {
  const { deps, sent } = setup()

  await flushUsageEvents(deps)

  expect(sent).toEqual([{ platform: 'android', appVersion: '1.0.13', events: [EVENT] }])
})

it('신원이 없으면 꺼내지 않고 표에 둔다', async () => {
  const { deps, take, sent } = setup({ identity: async () => null })

  await flushUsageEvents(deps)

  expect(take).not.toHaveBeenCalled()
  expect(sent).toEqual([])
})

it('보내기가 실패해도 던지지 않고 다시 넣지 않는다', async () => {
  const { deps, take } = setup({ send: async () => ({ outcome: 'no-response' }) })

  await expect(flushUsageEvents(deps)).resolves.toBeUndefined()
  expect(take).toHaveBeenCalledTimes(1)
})

it('쌓인 것이 없으면 보내지 않는다', async () => {
  const send = jest.fn()
  const { deps } = setup({ take: async () => [], send })

  await flushUsageEvents(deps)

  expect(send).not.toHaveBeenCalled()
})

// 백그라운드 진입과 부팅이 겹치면 같은 묶음을 두 번 꺼내려 한다. 하나로 모아야 요청이 하나다.
it('겹쳐 부르면 한 번만 돈다', async () => {
  const { deps, take } = setup()

  await Promise.all([flushUsageEvents(deps), flushUsageEvents(deps)])

  expect(take).toHaveBeenCalledTimes(1)
})
