import { QueryClient } from '@tanstack/react-query'

import { startRecordInvalidation } from '../invalidation'
import { queryKeys } from '../keys'

jest.mock('../../../storage/boss-profit', () => ({ subscribeBossProfitRecordsRevision: jest.fn() }))
jest.mock('../../../storage/boss-drops', () => ({ subscribeBossDropRecordsRevision: jest.fn() }))
jest.mock('../../../storage/income', () => ({ subscribeIncomeRecordsRevision: jest.fn() }))
jest.mock('../../../storage/spend', () => ({ subscribeSpendRecordsRevision: jest.fn() }))
jest.mock('../../../storage/enhancement-totals', () => ({ subscribeEnhancementTotalsRevision: jest.fn() }))
jest.mock('../../../storage/schedule-probe-ledger', () => ({ subscribeScheduleProbeLedgerRevision: jest.fn() }))

const subscribers = {
  boss_profit_records: jest.requireMock('../../../storage/boss-profit').subscribeBossProfitRecordsRevision as jest.Mock,
  boss_drop_records: jest.requireMock('../../../storage/boss-drops').subscribeBossDropRecordsRevision as jest.Mock,
  income_records: jest.requireMock('../../../storage/income').subscribeIncomeRecordsRevision as jest.Mock,
  spend_records: jest.requireMock('../../../storage/spend').subscribeSpendRecordsRevision as jest.Mock,
  enhancement_totals: jest.requireMock('../../../storage/enhancement-totals').subscribeEnhancementTotalsRevision as jest.Mock,
  schedule_probe_ledger: jest.requireMock('../../../storage/schedule-probe-ledger').subscribeScheduleProbeLedgerRevision as jest.Mock,
}

/** 구독 함수가 받은 리스너. 표의 판이 올랐다고 알리는 데 쓴다. */
function listenerOf(table: keyof typeof subscribers): () => void {
  return subscribers[table].mock.calls[0][0] as () => void
}

let client: QueryClient
let stop: () => void
const unsubscribes = Object.values(subscribers).map(() => jest.fn())

beforeEach(() => {
  jest.clearAllMocks()
  Object.values(subscribers).forEach((subscribe, index) => subscribe.mockReturnValue(unsubscribes[index]))
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } })
  stop = startRecordInvalidation(client)
})

afterEach(() => {
  stop()
  client.clear()
})

function isStale(queryKey: readonly unknown[]): boolean {
  return client.getQueryState(queryKey)?.isInvalidated === true
}

describe('표의 판', () => {
  it('판이 오르면 그 표를 적은 쿼리만 무효화된다', () => {
    client.setQueryData(queryKeys.ledgerDays('2026-10-01', '2026-10-31'), {})
    client.getQueryCache().find({ queryKey: queryKeys.ledgerDays('2026-10-01', '2026-10-31') })!.setOptions({
      queryKey: queryKeys.ledgerDays('2026-10-01', '2026-10-31'),
      meta: { tables: ['boss_profit_records', 'income_records'] },
    })
    client.setQueryData(queryKeys.dropHistory(), {})
    client.getQueryCache().find({ queryKey: queryKeys.dropHistory() })!.setOptions({
      queryKey: queryKeys.dropHistory(),
      meta: { tables: ['boss_drop_records'] },
    })
    client.setQueryData(queryKeys.scheduleRound(), {})

    listenerOf('income_records')()

    expect(isStale(queryKeys.ledgerDays('2026-10-01', '2026-10-31'))).toBe(true)
    expect(isStale(queryKeys.dropHistory())).toBe(false)
    expect(isStale(queryKeys.scheduleRound())).toBe(false)
  })

  it('떼면 구독 여섯이 풀린다', () => {
    stop()
    for (const unsubscribe of unsubscribes) expect(unsubscribe).toHaveBeenCalledTimes(1)
    // afterEach 가 한 번 더 불러도 두 번 풀지 않는다.
    stop = () => undefined
  })
})

describe('기대는 쿼리', () => {
  it('회차가 새 데이터를 들면 `schedule-round` 에 기댄 쿼리가 무효화된다', () => {
    client.setQueryData(queryKeys.bossProfitPeriod('weekly', '2026-10-29'), {})
    client.getQueryCache().find({ queryKey: queryKeys.bossProfitPeriod('weekly', '2026-10-29') })!.setOptions({
      queryKey: queryKeys.bossProfitPeriod('weekly', '2026-10-29'),
      meta: { dependsOn: ['schedule-round'] },
    })
    client.setQueryData(queryKeys.ledgerDays('a', 'b'), {})

    client.setQueryData(queryKeys.scheduleRound(), { fetchedAt: 'now' })

    expect(isStale(queryKeys.bossProfitPeriod('weekly', '2026-10-29'))).toBe(true)
    expect(isStale(queryKeys.ledgerDays('a', 'b'))).toBe(false)
  })

  it('다른 쿼리가 바뀌는 것은 안 센다', () => {
    client.setQueryData(queryKeys.bossProfitPeriod('weekly', '2026-10-29'), {})
    client.getQueryCache().find({ queryKey: queryKeys.bossProfitPeriod('weekly', '2026-10-29') })!.setOptions({
      queryKey: queryKeys.bossProfitPeriod('weekly', '2026-10-29'),
      meta: { dependsOn: ['schedule-round'] },
    })

    client.setQueryData(queryKeys.schedule('a'), { state: {} })

    expect(isStale(queryKeys.bossProfitPeriod('weekly', '2026-10-29'))).toBe(false)
  })
})
