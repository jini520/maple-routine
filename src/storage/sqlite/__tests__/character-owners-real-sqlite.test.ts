/// <reference types="node" />
/**
 * 서버에 알릴 메이플 ID 를 `character_accounts` 에서 찾는 읽기를 진짜 SQLite 로 태운다.
 */
import {
  getMapleIdsByNexonAccount,
  getMapleIdsOfNexonAccountUngated,
  recordCharacterAccounts,
} from '../../character-accounts'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { holdRecordsUntil } from '../../record-hold'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
})

afterEach(async () => {
  holdRecordsUntil(Promise.resolve())
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

const 목록 = (accountId: string, ocid: string, name: string) => [
  { accountId, characters: [{ ocid, name, world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 }] },
]

// 메이플 ID 는 메인 신원으로 알리고 부계정의 것은 등록이 알린다. 계정을 모르는 줄의 메이플 ID 는 어느 계정의 것인지 모른다.
it('넥슨 계정마다 그 계정의 메이플 ID 를 겹치지 않게 모은다', async () => {
  await getBossProfitDb()
  await recordCharacterAccounts(목록('maple-1', 'o-1', '하나'), '2026-10-01', 'account-a')
  await recordCharacterAccounts(목록('maple-1', 'o-2', '둘'), '2026-10-01', 'account-a')
  await recordCharacterAccounts(목록('maple-2', 'o-3', '셋'), '2026-10-01', 'account-a')
  await recordCharacterAccounts(목록('maple-3', 'o-4', '넷'), '2026-10-01', 'account-b')
  await recordCharacterAccounts(목록('maple-4', 'o-5', '다섯'), '2026-10-01', null)

  const byAccount = await getMapleIdsByNexonAccount()

  expect(Object.fromEntries(byAccount)).toEqual({ 'account-a': ['maple-1', 'maple-2'], 'account-b': ['maple-3'] })
})

// 키 사용자의 서버 신원이 이 값에서 나온다. 변환이 실패한 실행에서도 사용 로그를 보내야 해서, 변환이 기록을 막는 동안에도 읽힌다.
it('한 넥슨 계정의 메이플 ID 를 겹치지 않게 읽고, 기기 변환이 기록을 막는 동안에도 기다리지 않는다', async () => {
  await getBossProfitDb()
  await recordCharacterAccounts(목록('maple-2', 'o-1', '하나'), '2026-10-01', 'account-a')
  await recordCharacterAccounts(목록('maple-1', 'o-2', '둘'), '2026-10-01', 'account-a')
  await recordCharacterAccounts(목록('maple-2', 'o-3', '셋'), '2026-10-01', 'account-a')
  await recordCharacterAccounts(목록('maple-3', 'o-4', '넷'), '2026-10-01', 'account-b')
  holdRecordsUntil(new Promise<void>(() => {}))

  await expect(getMapleIdsOfNexonAccountUngated('account-a')).resolves.toEqual(['maple-1', 'maple-2'])
  await expect(getMapleIdsOfNexonAccountUngated('account-없음')).resolves.toEqual([])
})
