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
