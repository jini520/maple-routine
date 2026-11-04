/// <reference types="node" />
/**
 * 사용 로그를 쌓고 꺼내는 표를 진짜 SQLite 로 태운다. 상한이 없으면 신원이 없는 기기에서 표가 끝없이 자란다.
 */
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { appendUsageEvent, clearUsageEvents, takeUsageEvents, USAGE_EVENTS_MAX } from '../../usage-events'
import type { UsageEvent } from '../../../types/usage-event'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

const screen = (n: number): UsageEvent => ({
  type: 'screen',
  name: `S${n}`,
  durationMs: n,
  at: new Date(Date.UTC(2026, 10, 4, 0, 0, n)).toISOString(),
})

beforeEach(async () => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  await getBossProfitDb()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

it('적은 차례대로 꺼내고, 꺼낸 것은 표에서 지운다', async () => {
  await appendUsageEvent(screen(1))
  await appendUsageEvent({ type: 'visit', name: '', durationMs: null, at: screen(0).at })

  await expect(takeUsageEvents()).resolves.toEqual([
    screen(1),
    { type: 'visit', name: '', durationMs: null, at: screen(0).at },
  ])
  await expect(takeUsageEvents()).resolves.toEqual([])
})

it('상한을 넘으면 오래된 것부터 지운다', async () => {
  for (let n = 0; n < USAGE_EVENTS_MAX + 2; n += 1) await appendUsageEvent(screen(n))

  const taken = await takeUsageEvents()

  expect(taken).toHaveLength(USAGE_EVENTS_MAX)
  expect(taken[0]).toEqual(screen(2))
})

it('비우면 아무것도 안 남는다', async () => {
  await appendUsageEvent(screen(1))

  await clearUsageEvents()

  await expect(takeUsageEvents()).resolves.toEqual([])
})
