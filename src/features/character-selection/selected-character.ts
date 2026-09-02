/**
 * 지금 보여 줄 캐릭터를 고르는 **한 가지 규칙**.
 *
 * ## 왜 화면이 아니라 여기인가
 *
 * 선택은 스토어 하나가 갖지만(`store.ts`), **고를 수 있는 목록은 화면마다 다르다**. 각 스케줄러
 * 스토어의 `characters` 는 자기 동기화 결과라, 공유된 선택이 그 목록에 아직(또는 이미) 없는 순간이
 * 실재한다. 그 순간에 무엇을 보여 줄지가 이 함수다.
 *
 * 규칙을 화면에 두면 공유했는데 화면마다 다른 캐릭터 가 된다. 선택을 합치는 일이 폴백을 합치는
 * 일과 짝이어야 하는 이유이고, 실제로 정정 전에는 이 네 줄이 화면 넷에 한 벌씩 복제돼 있었다.
 *
 * ## 왜 `ocid` 가 아니라 캐릭터를 돌려주나
 *
 * 호출부 넷이 전부 고른 ocid 를 구해 곧바로 그 캐릭터를 찾았다(`characters.find(…) ?? null`).
 * 중간값이 쓰이는 자리가 하나도 없어서, 두 단계를 한 번에 돌려준다.
 */
export function resolveSelectedCharacter<T extends { readonly ocid: string }>(
  /** `useCharacterSelectionStore` 의 값. 아직 아무것도 안 골랐으면 `null`. */
  selectedOcid: string | null,
  /** 이 화면이 실제로 그릴 수 있는 캐릭터들. **화면 순서 그대로** 넘길 것(첫 번째가 폴백이다). */
  characters: readonly T[],
): T | null {
  return characters.find((character) => character.ocid === selectedOcid) ?? characters[0] ?? null
}
