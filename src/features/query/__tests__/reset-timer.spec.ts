import { QueryClient } from '@tanstack/react-query'

import { startResetBoundaryTimer, useResetBoundaryTick } from '../reset-timer'

// 2026-10-30 KST 23:59:30
const BEFORE_MIDNIGHT = new Date('2026-10-30T14:59:30.000Z')

describe('startResetBoundaryTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(BEFORE_MIDNIGHT)
    useResetBoundaryTick.setState({ tick: 0 })
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('KST 자정에 넥슨 쿼리를 무효화하고 틱을 올린 뒤 다음 자정을 다시 건다', () => {
    const client = new QueryClient()
    client.setQueryData(['schedule', 'a'], { v: 1 })
    client.getQueryCache().find({ queryKey: ['schedule', 'a'] })!.setOptions({ queryKey: ['schedule', 'a'], meta: { source: 'nexon' } })
    client.setQueryData(['ledger-days', '2026-10'], { v: 1 })
    const stop = startResetBoundaryTimer(client)

    jest.advanceTimersByTime(29_999)
    expect(useResetBoundaryTick.getState().tick).toBe(0)

    jest.advanceTimersByTime(1)
    expect(useResetBoundaryTick.getState().tick).toBe(1)
    expect(client.getQueryState(['schedule', 'a'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['ledger-days', '2026-10'])?.isInvalidated).toBe(false)

    jest.advanceTimersByTime(24 * 60 * 60 * 1000)
    expect(useResetBoundaryTick.getState().tick).toBe(2)

    stop()
    jest.advanceTimersByTime(24 * 60 * 60 * 1000)
    expect(useResetBoundaryTick.getState().tick).toBe(2)
  })
})
