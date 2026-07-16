import type {
  CharacterBasicProfile,
  MapleAccount,
  NexonCharacterBasicResponse,
  NexonCharacterListResponse,
} from '../../types'

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

export function normalizeCharacterBasic(wire: NexonCharacterBasicResponse): CharacterBasicProfile {
  return {
    name: wire.character_name,
    level: wire.character_level,
    imageUrl: wire.character_image,
    accessFlag: wire.access_flag === 'true',
    world: wire.world_name,
  }
}
