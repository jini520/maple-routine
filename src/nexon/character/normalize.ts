import type { MapleAccount, NexonCharacterListResponse } from '../../types'

export function normalizeCharacterList(wire: NexonCharacterListResponse): MapleAccount[] {
  return wire.account_list.map((account) => ({
    accountId: account.account_id,
    characters: account.character_list.map((character) => ({
      ocid: character.ocid,
      name: character.character_name,
      world: character.world_name,
      jobClass: character.character_class,
      level: character.character_level,
    })),
  }))
}
