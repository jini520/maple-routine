/// <reference types="node" />
/**
 * 서버로 보낼 기록의 주인을 `character_accounts` 에서 찾는 두 읽기를 진짜 SQLite 로 태운다.
 */
import { getCharacterOwnersOfOcids, getMapleIdsByNexonAccount, recordCharacterAccounts } from '../../character-accounts'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

const 목록 = (accountId: string, ocid: string, name: string) => [
  { accountId, characters: [{ ocid, name, world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 }] },
]

// 드롭은 그 캐릭터의 메이플 ID 를 싣고 그 계정의 신원으로 보낸다. 이름을 바꾼 캐릭터는 줄이 여럿이라 마지막으로 본 줄이 답이다.
it('ocid 마다 마지막으로 본 줄의 메이플 ID 와 넥슨 계정을 찾고, 계정을 모르면 계정 칸만 비운다', async () => {
  await getBossProfitDb()
  await recordCharacterAccounts(목록('maple-1', 'o-이름바꿈', '옛이름'), '2026-10-01', 'account-a')
  await recordCharacterAccounts(목록('maple-1', 'o-이름바꿈', '새이름'), '2026-10-05', 'account-a')
  await recordCharacterAccounts(목록('maple-2', 'o-모름', '모름'), '2026-10-02', null)

  const owners = await getCharacterOwnersOfOcids(['o-이름바꿈', 'o-모름', 'o-없음'])

  expect(Object.fromEntries(owners)).toEqual({
    'o-이름바꿈': { mapleId: 'maple-1', nexonAccountId: 'account-a' },
    'o-모름': { mapleId: 'maple-2', nexonAccountId: null },
  })
})

// 메이플 ID 는 계정마다 그 계정의 신원으로 서버에 알린다. 계정을 모르는 줄의 메이플 ID 는 어느 신원으로도 알릴 수 없다.
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
