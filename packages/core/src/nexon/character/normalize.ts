import type {
  CharacterBasicProfile,
  MapleAccount,
  NexonCharacterBasicResponse,
  NexonCharacterListResponse,
} from '../../types'

// ADR-127: 캐릭터가 0명인 메이플 ID는 여기서 걸러진다. `MapleAccount` 의 뜻이 "응답에 있던 계정"이
// 아니라 **"고를 수 있는 계정"** 이라서다 — 이 값을 쓰는 네 자리(온보딩 스토어·설정 계정 변경·계정
// 선택 프로브·피커 로스터)가 전부 캐릭터가 있다는 전제로 쓰고, 그 전제가 깨지자 계정 선택 화면이
// 대표 캐릭터를 세우지 못해 **렌더 중에 던졌다**(AccountSelectionList → pickRepresentativeCharacter,
// 2026-08-12 테스터 보고). 사슬의 가장 위 고리를 끊어 그 상태가 애초에 존재하지 않게 한다 — 아래
// (프로브 판정·렌더 폴백)에서 막으면 "캐릭터 0명 계정"을 아는 코드가 세 곳으로 흩어진다.
export function normalizeCharacterList(wire: NexonCharacterListResponse): MapleAccount[] {
  return wire.account_list
    .filter((account) => account.character_list.length > 0)
    .map((account) => ({
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
