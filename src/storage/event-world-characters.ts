/**
 * 이벤트 월드에서 본 캐릭터 이름(`event_world_characters`)을 읽고 쓰는 자리.
 *
 * @see docs/persistence/sqlite.md `event_world_characters`
 */
import { getBossProfitDb } from './sqlite/db'

/** 이벤트 월드 스타포스 줄에서 본 캐릭터 하나. */
export interface EventWorldCharacter {
  characterName: string
  worldKey: string
}

/** 본 이름을 남긴다. 같은 계정 · 이름 · 월드는 한 줄이다. */
export async function rememberEventWorldCharacters(
  nexonAccountId: string,
  characters: readonly EventWorldCharacter[],
  now: Date,
): Promise<void> {
  if (characters.length === 0) return
  const db = await getBossProfitDb()
  const at = now.toISOString()
  for (const { characterName, worldKey } of characters) {
    await db.run(
      `INSERT INTO event_world_characters (nexon_account_id, character_name, world_key, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (nexon_account_id, character_name, world_key) DO UPDATE SET updated_at = excluded.updated_at`,
      [nexonAccountId, characterName, worldKey, at],
    )
  }
}

/** 그 계정에서 본 이름별 월드 key. */
export async function loadEventWorldCharacters(nexonAccountId: string): Promise<Map<string, string[]>> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    'SELECT character_name, world_key FROM event_world_characters WHERE nexon_account_id = ? ORDER BY character_name, world_key',
    [nexonAccountId],
  )
  const byName = new Map<string, string[]>()
  for (const row of values ?? []) {
    const name = row.character_name as string
    byName.set(name, [...(byName.get(name) ?? []), row.world_key as string])
  }
  return byName
}
