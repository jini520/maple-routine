/**
 * 게임 데이터의 기기 사본(`game_data_sections` · `game_data_meta`)을 읽고 쓰는 자리.
 *
 * 칸과 표식을 한 트랜잭션으로 쓴다. 표식이 있으면 칸과 그림을 다 받은 사본이고, 잠금 화면은 그것을 믿고 풀린다.
 * 쓰다 실패하면 앞 사본이 그대로 남는다.
 */
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'

export interface GameDataCopy {
  /** 사본을 쓴 앱의 계약 판. 지금 앱과 다르면 읽을 수 없는 사본이다 */
  contract: string
  /** 그 응답의 ETag. 다음 요청이 `If-None-Match` 로 보낸다 */
  etag: string | null
  /** 칸 이름 → 서버 응답의 그 칸 */
  sections: Record<string, unknown>
}

/** 표식이 없으면 `null`. */
export async function loadGameDataCopy(): Promise<GameDataCopy | null> {
  const db = await getBossProfitDb()
  const meta = new Map(
    ((await db.query('SELECT key, value FROM game_data_meta')).values ?? []).map((row) => [
      row.key as string,
      row.value as string,
    ]),
  )
  const contract = meta.get('contract')
  if (contract === undefined) return null
  const sections: Record<string, unknown> = {}
  for (const row of (await db.query('SELECT section, body FROM game_data_sections')).values ?? [])
    sections[row.section as string] = JSON.parse(row.body as string) as unknown
  return { contract, etag: meta.get('etag') ?? null, sections }
}

/** 사본을 통째로 바꾼다. 이번에 없는 칸은 지운다. */
export async function saveGameDataCopy(copy: GameDataCopy): Promise<void> {
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    await db.run('DELETE FROM game_data_sections')
    for (const [section, body] of Object.entries(copy.sections))
      await db.run('INSERT INTO game_data_sections (section, body) VALUES (?, ?)', [section, JSON.stringify(body)])
    await db.run('DELETE FROM game_data_meta')
    await db.run('INSERT INTO game_data_meta (key, value) VALUES (?, ?)', ['contract', copy.contract])
    if (copy.etag !== null) await db.run('INSERT INTO game_data_meta (key, value) VALUES (?, ?)', ['etag', copy.etag])
  })
}

export async function clearGameDataCopy(): Promise<void> {
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    await db.run('DELETE FROM game_data_meta')
    await db.run('DELETE FROM game_data_sections')
  })
}
