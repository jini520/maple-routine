/// <reference types="node" />
/**
 * MVP 등급 이력과 캐릭터 소속 표를 진짜 SQLite 로 태우는 자리.
 *
 * 옛 판이 남긴 등급 빈(`NULL`) 줄의 처리와 `MIN` · `MAX` 로 넓히는 upsert 는 엔진이 판정하는 것이라 목으로는 못 본다.
 */
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { deleteEmptyMvpGradeRows, getMvpGradeHistories, replaceMvpGradeHistory } from '../../mvp-grades'
import { getCharacterAccountSightings, recordCharacterAccounts } from '../../character-accounts'
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

describe('mvp_grade_history', () => {
  it('ID 마다 이력을 통째로 바꾸고 시작 날짜 차례로 읽는다', async () => {
    await replaceMvpGradeHistory('A', [
      { startDate: '2026-07-30', grade: 'gold' },
      { startDate: '2026-06-11', grade: 'silver' },
    ], '2026-09-22T00:00:00.000Z')
    await replaceMvpGradeHistory('B', [{ startDate: '2026-09-17', grade: 'normal' }], '2026-09-22T00:00:00.000Z')
    await replaceMvpGradeHistory('A', [
      { startDate: '2026-06-11', grade: 'silver' },
      { startDate: '2026-09-17', grade: 'diamond' },
    ], '2026-09-22T00:00:00.000Z')

    const histories = await getMvpGradeHistories()
    expect(histories.get('A')).toEqual([
      { startDate: '2026-06-11', grade: 'silver' },
      { startDate: '2026-09-17', grade: 'diamond' },
    ])
    expect(histories.get('B')).toEqual([{ startDate: '2026-09-17', grade: 'normal' }])
  })

  describe('옛 판이 남긴 등급 빈 줄', () => {
    beforeEach(async () => {
      await replaceMvpGradeHistory('A', [
        { startDate: '2026-05-07', grade: 'red' },
        { startDate: '2026-06-11', grade: 'silver' },
      ], '2026-09-22T00:00:00.000Z')
      const db = await getBossProfitDb()
      await db.run(
        `INSERT INTO mvp_grade_history (account_id, from_date, grade, updated_at) VALUES ('A', '2026-05-21', NULL, '2026-09-22T00:00:00.000Z')`,
      )
    })

    it('읽을 때 건너뛴다', async () => {
      expect((await getMvpGradeHistories()).get('A')).toEqual([
        { startDate: '2026-05-07', grade: 'red' },
        { startDate: '2026-06-11', grade: 'silver' },
      ])
    })

    it('빈 줄만 지우고 지운 수를 돌려준다', async () => {
      expect(await deleteEmptyMvpGradeRows()).toBe(1)
      expect(await deleteEmptyMvpGradeRows()).toBe(0)
      expect((await getMvpGradeHistories()).get('A')).toHaveLength(2)
    })
  })

  it('빈 이력으로 바꾸면 그 ID 가 목록에서 빠진다', async () => {
    await replaceMvpGradeHistory('A', [{ startDate: '2026-06-11', grade: 'silver' }], '2026-09-22T00:00:00.000Z')
    await replaceMvpGradeHistory('A', [], '2026-09-22T00:00:00.000Z')

    expect((await getMvpGradeHistories()).has('A')).toBe(false)
  })
})

describe('character_accounts', () => {
  const accounts = (name: string) => [
    { accountId: 'A', characters: [{ ocid: 'x', name, world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 }] },
  ]

  it('같은 캐릭터를 다시 보면 처음 본 날과 마지막으로 본 날만 넓힌다', async () => {
    await recordCharacterAccounts(accounts('루디'), '2026-09-10', null)
    await recordCharacterAccounts(accounts('루디'), '2026-09-22', null)
    await recordCharacterAccounts(accounts('루디'), '2026-09-15', null)

    expect(await getCharacterAccountSightings()).toEqual([
      { ocid: 'x', name: '루디', accountId: 'A', firstSeenOn: '2026-09-10', lastSeenOn: '2026-09-22' },
    ])
  })

  it('이름을 바꾸면 옛 이름의 줄을 지우지 않고 새 줄을 더한다', async () => {
    await recordCharacterAccounts(accounts('루디'), '2026-09-10', null)
    await recordCharacterAccounts(accounts('루디2'), '2026-09-22', null)

    const names = (await getCharacterAccountSightings()).map((row) => row.name).sort()
    expect(names).toEqual(['루디', '루디2'])
  })
})
