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
}

export interface CharacterBasicProfile {
  name: string
  level: number
  imageUrl: string
  accessFlag: boolean
}
