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

// ADR-057: "가입한 길드 없음"(null·빈 문자열)과 "모름"(필드 자체가 응답에 없음)을 갈라둔다.
// 앞은 길드 콘텐츠를 잠그는 근거지만, 뒤는 근거가 아니라 정보 부재라 잠그면 안 된다.
function normalizeGuildName(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) {
    return undefined
  }
  return raw === null || raw.trim() === '' ? null : raw
}

export function normalizeCharacterBasic(wire: NexonCharacterBasicResponse): CharacterBasicProfile {
  return {
    name: wire.character_name,
    level: wire.character_level,
    imageUrl: wire.character_image,
    accessFlag: wire.access_flag === 'true',
    world: wire.world_name,
    guildName: normalizeGuildName(wire.character_guild_name),
  }
}
