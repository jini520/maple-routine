/**
 * 넣은 아이템 칸에 주인으로 보일 캐릭터. 넣은 아이템의 주인은 메이플 ID · 월드인데, 메이플 ID 에는 얼굴이 없어서 그 창고를
 * 쓰는 캐릭터 하나로 보인다.
 */
import { compareByName } from '../../lib/character-order'

/** 얼굴을 고를 때 보는 추적 캐릭터. */
export interface OwnerCharacter {
  ocid: string
  name: string
  level: number
  /** 메이플 ID. 모르면 `null` 이다 */
  accountId: string | null
  /** 월드 key. 모르면 `null` 이다 */
  worldKey: string | null
  /** 조회 불가로 적힌 캐릭터인지 */
  unavailable: boolean
}

function highest(characters: readonly OwnerCharacter[]): OwnerCharacter {
  return [...characters].sort((a, b) => b.level - a.level || compareByName(a.name, b.name))[0]!
}

/**
 * 앱의 대표 캐릭터가 그 메이플 ID · 월드에 있으면 그 캐릭터, 없으면 조회 가능한 캐릭터 가운데 레벨이 가장 높은 캐릭터,
 * 모두 조회 불가면 레벨이 가장 높은 캐릭터. 레벨이 같으면 이름순이다. 그 메이플 ID · 월드에 추적 캐릭터가 없으면 `null` 이다.
 */
export function ownerFaceOcid(
  owner: { accountId: string; worldKey: string },
  characters: readonly OwnerCharacter[],
  representativeOcid: string | null,
): string | null {
  const mine = characters.filter((each) => each.accountId === owner.accountId && each.worldKey === owner.worldKey)
  if (mine.length === 0) return null
  const representative = mine.find((each) => each.ocid === representativeOcid)
  if (representative !== undefined) return representative.ocid
  const available = mine.filter((each) => !each.unavailable)
  return highest(available.length > 0 ? available : mine).ocid
}
