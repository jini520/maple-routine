/// <reference types="node" />
/**
 * 게임 데이터 사본을 진짜 SQLite 로 태우는 자리.
 *
 * 칸과 표식을 한 트랜잭션으로 쓰는지는 엔진이 판정하는 것이라 목으로는 못 본다.
 */
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { clearGameDataCopy, loadGameDataCopy, saveGameDataCopy } from '../../game-data-copy'
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

describe('게임 데이터 사본', () => {
  it('표식이 없으면 사본이 없는 것이고, 쓰면 칸 전부와 계약 판 · ETag 를 돌려준다', async () => {
    expect(await loadGameDataCopy()).toBeNull()

    await saveGameDataCopy({ contract: 'c1', etag: '"e1"', sections: { worlds: { updatedAt: 't', worlds: [] } } })
    await saveGameDataCopy({ contract: 'c1', etag: '"e2"', sections: { worlds: { updatedAt: 'u', worlds: [1] }, mvpGrades: { grades: [] } } })

    expect(await loadGameDataCopy()).toEqual({
      contract: 'c1',
      etag: '"e2"',
      sections: { worlds: { updatedAt: 'u', worlds: [1] }, mvpGrades: { grades: [] } },
    })
  })

  it('칸을 쓰다 실패하면 표식도 칸도 앞 사본 그대로다', async () => {
    await saveGameDataCopy({ contract: 'c1', etag: '"e1"', sections: { worlds: { worlds: [] } } })
    const db = await getBossProfitDb()
    // 표식을 쓰는 문장이 실패하게 meta 표를 지운다. 칸은 그보다 먼저 쓰인다.
    await db.execute('DROP TABLE game_data_meta')
    await expect(
      saveGameDataCopy({ contract: 'c2', etag: '"e2"', sections: { worlds: { worlds: [9] } } }),
    ).rejects.toThrow()
    const { values } = await db.query('SELECT body FROM game_data_sections WHERE section = ?', ['worlds'])
    expect(values?.[0]?.body).toBe('{"worlds":[]}')
  })

  it('지우면 사본이 없다', async () => {
    await saveGameDataCopy({ contract: 'c1', etag: null, sections: { worlds: { worlds: [] } } })
    await clearGameDataCopy()
    expect(await loadGameDataCopy()).toBeNull()
  })
})
