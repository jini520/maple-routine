/**
 * 지금 보여 줄 캐릭터를 고르는 한 가지 규칙.
 *
 * 선택은 스토어 하나가 갖지만 고를 수 있는 목록은 화면마다 다르다. 각 스케줄러 스토어의
 * `characters` 는 자기 동기화 결과라, 공유된 선택이 그 목록에 아직(또는 이미) 없는 순간이
 * 실재한다. 그 순간에 무엇을 보여 줄지가 이 함수다. 규칙을 화면에 두면 공유했는데 화면마다
 * 다른 캐릭터 가 된다.
 *
 * `ocid` 가 아니라 캐릭터를 돌려주는 것은 호출부 넷이 전부 고른 ocid 를 구해 곧바로 그 캐릭터를
 * 찾기 때문이다. 중간값이 쓰이는 자리가 없어 두 단계를 한 번에 돌려준다.
 */
export function resolveSelectedCharacter<T extends { readonly ocid: string }>(
  /** `useCharacterSelectionStore` 의 값. 아직 아무것도 안 골랐으면 `null`. */
  selectedOcid: string | null,
  /** 이 화면이 실제로 그릴 수 있는 캐릭터들. **화면 순서 그대로** 넘길 것(첫 번째가 폴백이다). */
  characters: readonly T[],
): T | null {
  return characters.find((character) => character.ocid === selectedOcid) ?? characters[0] ?? null
}
