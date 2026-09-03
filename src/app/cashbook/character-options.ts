/**
 * 캐릭터 고르개의 보기. 맨 앞이 `선택 안함` 이다.
 *
 * `ocid = null` 이 계정 단위이고 그것이 기본이다. 두 시트가 같은 목록을 그리므로 그 규칙을 한
 * 자리에 둔다. 라벨이 갈리면 같은 뜻이 화면마다 다르게 읽힌다.
 */
import type { SelectOption } from '../../components/organisms/SelectField/SelectField'

/** 안 고른 상태의 이름. 계정 단위 를 사용자 말로 옮긴 것이다. */
export const NO_CHARACTER_LABEL = '선택 안함'

export function characterOptions(
  characters: ReadonlyArray<{ ocid: string; name: string }>,
): SelectOption[] {
  return [
    { value: null, label: NO_CHARACTER_LABEL },
    ...characters.map((character) => ({ value: character.ocid, label: character.name })),
  ]
}
