/// <reference types="node" />
/**
 * 새로 깐 기기가 다시 매기기 요청을 건너뛰는 것을 진짜 SQLite 로 태운다.
 *
 * 새로 깐 기기의 합계는 지금 코드로 받은 것이라 고칠 것이 없다. 건너뛰지 않으면 넥슨 로그인 계정은 가계부를 새로고침할 때마다
 * 60일씩 지난 내역을 다시 받고 그 합계를 서버에 다시 올린다.
 */
import { loadRecomputeProgress } from '../../enhancement-recomputes'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

jest.mock('../../../lib/enhancement/recompute-requests', () => ({
  ...jest.requireActual('../../../lib/enhancement/recompute-requests'),
  RECOMPUTE_REQUESTS: [],
}))
const requests = (jest.requireMock('../../../lib/enhancement/recompute-requests') as { RECOMPUTE_REQUESTS: { id: string }[] })
  .RECOMPUTE_REQUESTS

let real: RealSqlite

function setRequests(ids: string[]): void {
  requests.splice(0, requests.length, ...ids.map((id) => ({ id, from: '2025-01-01', to: '2099-12-31', kinds: ['starforce'], superiorOnly: false })))
}

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  setRequests([])
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

it('DB 를 처음 만들면 그때의 요청을 모든 넥슨 계정에서 끝난 것으로 읽는다', async () => {
  setRequests(['starforce-stars-876', 'superior-starforce-1029'])

  await getBossProfitDb()

  for (const account of ['account-login', 'account-key']) {
    const progress = await loadRecomputeProgress(account)
    expect(progress.get('starforce-stars-876')?.completed).toBe(true)
    expect(progress.get('superior-starforce-1029')?.completed).toBe(true)
  }
})

// 그 사이에 이 기기가 옛 코드로 받은 합계가 있을 수 있다. 1.0.14 에서 올라온 기기도 DB 가 이미 있어 같은 길을 탄다.
it('DB 가 이미 있으면 그 뒤 번들에 든 요청은 건너뛰지 않는다', async () => {
  setRequests(['starforce-stars-876'])
  await getBossProfitDb()
  await closeBossProfitDb()

  setRequests(['starforce-stars-876', 'new-request'])
  await getBossProfitDb()

  const progress = await loadRecomputeProgress('account-login')
  expect(progress.get('starforce-stars-876')?.completed).toBe(true)
  expect(progress.has('new-request')).toBe(false)
})

it('계정의 진행 줄이 있어도 건너뛸 요청은 끝난 것으로 읽는다', async () => {
  setRequests(['starforce-stars-876'])
  await getBossProfitDb()
  real.inspect((db) =>
    db
      .prepare(
        `INSERT INTO enhancement_recomputes (nexon_account_id, request_key, done_through_date, completed_at, updated_at)
         VALUES ('account-login', 'starforce-stars-876', '2025-03-01', NULL, '2026-11-25T00:00:00.000Z')`,
      )
      .run(),
  )

  expect((await loadRecomputeProgress('account-login')).get('starforce-stars-876')?.completed).toBe(true)
})
