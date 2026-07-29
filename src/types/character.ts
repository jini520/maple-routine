export interface MapleCharacter {
  ocid: string
  name: string
  world: string
  jobClass: string
  level: number
}

export interface MapleAccount {
  accountId: string
  characters: MapleCharacter[]
}

export interface CharacterPickerEntry {
  ocid: string
  name: string
  level: number
  imageUrl: string | null
  // 서버 엠블럼 표시용. character/list(live) 또는 캐시된 character/basic에서 채운다.
  // 목록 도착 전 오래된 캐시 stub 등 world를 아직 모르면 undefined(엠블럼 생략).
  world?: string
}

export interface CharacterBasicProfile {
  name: string
  level: number
  imageUrl: string
  accessFlag: boolean
  // character/basic 응답의 world_name. 이전 캐시엔 없을 수 있어 옵셔널.
  world?: string
  // character/basic 응답의 character_guild_name([[ADR-057]]). 세 상태를 구분한다:
  // 문자열 = 그 길드 소속, null = 가입한 길드 없음(API가 알려준 사실), undefined = 모름
  // (구버전 캐시나 응답에 필드가 없는 경우). "모름"을 "미가입"으로 취급하면 길드 콘텐츠를
  // 잘못 잠그므로 반드시 분리해야 한다.
  guildName?: string | null
}
