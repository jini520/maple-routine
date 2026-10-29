/**
 * 캐릭터 고르개의 보기. 맨 앞이 `선택 안함` 이다.
 *
 * `ocid = null` 이 계정 단위이고 그것이 기본이다. 두 시트가 같은 목록을 그리므로 그 규칙을 한
 * 자리에 둔다. 라벨이 갈리면 같은 뜻이 화면마다 다르게 읽힌다.
 */
import type { SelectOption } from '../../components/organisms/SelectField/SelectField'
import { worldEmblemUrl } from '../../lib/assets/asset-lookup'
import type { SelectDecor } from './select-value'

/** 안 고른 상태의 이름. 계정 단위 를 사용자 말로 옮긴 것이다. */
export const NO_CHARACTER_LABEL = '선택 안함'

export function characterOptions(
  characters: ReadonlyArray<{ ocid: string; name: string }>,
): SelectOption[] {
  return [{ value: null, label: NO_CHARACTER_LABEL }, ...requiredCharacterOptions(characters)]
}

/**
 * 캐릭터를 꼭 골라야 하는 폼의 보기. `선택 안함` 이 없다.
 *
 * 사냥 기록이 쓴다. 솔 에르다 조각 보관이 캐릭터별이라 캐릭터 없는 사냥 기록의 조각은 갈 곳이 없다.
 */
export function requiredCharacterOptions(
  characters: ReadonlyArray<{ ocid: string; name: string }>,
): SelectOption[] {
  return characters.map((character) => ({ value: character.ocid, label: character.name }))
}

/** 월드 엠블럼의 크기. 닫힌 줄과 목록 줄이 같다. */
const WORLD_ICON_SIZE = 16

/**
 * 캐릭터 드롭다운 줄에 붙는 것. 월드 엠블럼은 늘, 레벨과 목록 글자는 자리마다 고른다.
 *
 * @param characters 시트가 받은 캐릭터
 * @param extra `level` 은 사냥 폼, `notes` 는 조각 칸의 `보유 n개`(ocid 별)
 */
export function characterDecorOf(
  characters: ReadonlyArray<{ ocid: string; worldKey: string | null; level?: number | null }>,
  extra: { level?: boolean; notes?: Readonly<Record<string, string>> } = {},
): (ocid: string) => SelectDecor | null {
  return (ocid) => {
    const character = characters.find((each) => each.ocid === ocid)
    if (character === undefined) return null
    return {
      icon: worldEmblemUrl(character.worldKey),
      iconSize: WORLD_ICON_SIZE,
      level: extra.level === true ? (character.level ?? null) : null,
      listNote: extra.notes?.[ocid] ?? null,
    }
  }
}
