/**
 * 고른 캐릭터. **앱 전체에 한 벌**.
 *
 * ## 무엇이 문제였나
 *
 * 저장 키는 처음부터 하나였다(`storage/character-selection` 의 `lastSelectedCharacter`). 갈리는
 * 자리는 **메모리**였다. 컨텐츠 스토어와 보스 스토어가 각자 `selectedOcid` 를 들었고, 저장소에서
 * 그 값을 읽는 것은 **하이드레이션 한 회차뿐**이었다(평생 한 번 이 아니라
 * 동시에 하나만 이고 끝나면 잊는다).
 *
 * 그래서 컨텐츠에서 캐릭터를 바꾸면 저장소는 갱신되는데, 이미 하이드레이션이 끝난 보스 스토어의
 * `selectedOcid` 는 **옛 값 그대로**였다. 보스 스케줄러 ↔ 보스 관리가 이미 공유돼 있던 것은
 *  둘이 같은 스토어를 쓰기 때문이지 규칙 덕이 아니다. 즉 공유 는 스토어를
 * 같이 쓰는 자리에서만 우연히 성립하고 있었다.
 *
 * ## 왜 진입할 때마다 저장소를 다시 읽기 가 아닌가
 *
 * 그 길도 값은 맞다. 다만 **두 벌 구조가 그대로 남고** 첫 프레임이 한 박자 늦는다. 이 저장소는 같은
 * 함정을 이미 문장으로 적어 뒀다. `navigation/bar-store.ts` 머리말: *"두 벌이 되면 탭은 가계부인데
 * 바는 스케줄 같은 프레임이 반드시 생긴다."* 그래서 값을 옮기는 대신 **소유자를 하나로** 만든다.
 *
 * ## 목록은 여기 없다
 *
 * 이 스토어가 갖는 것은 무엇을 골랐나 하나뿐이고, 고를 수 있는 것 은 화면마다 다르다(각 스토어의
 * 동기화 결과). 둘이 만나는 규칙은 `selected-character.ts` 가 갖는다.
 */

import { create } from 'zustand'

import { getLastSelectedCharacter, setLastSelectedCharacter } from '../../storage/character-selection'

export interface CharacterSelectionStore {
  /** 마지막으로 고른 캐릭터. 하이드레이션 전이거나 한 번도 고른 적이 없으면 `null`. */
  selectedOcid: string | null
  /**
   * 저장된 선택을 메모리로 올린다. 스케줄러 스토어들의 `loadTrackedOcids()` 가 부른다.
   *
   * **이미 고른 값이 있으면 저장소를 읽지 않는다.** 화면 넷이 각자 진입할 때마다 이 문을 지나는데,
   * 매번 읽어서 덮으면 늦게 도착한 하이드레이션이 방금 고른 값을 되돌린다. 없애려는 두 벌 이
   * 시간축에서 되살아나는 형태다.
   */
  hydrate(): Promise<void>
  /** 고른다. 메모리와 저장소가 함께 움직인다. */
  select(ocid: string): Promise<void>
}

export const useCharacterSelectionStore = create<CharacterSelectionStore>()((set, get) => ({
  selectedOcid: null,

  async hydrate() {
    if (get().selectedOcid !== null) return

    const stored = await getLastSelectedCharacter()
    // 기다리는 동안 사용자가 골랐을 수 있다. 그 값이 이긴다(저장소는 과거, 선택은 현재다).
    if (stored !== null && get().selectedOcid === null) set({ selectedOcid: stored })
  },

  async select(ocid) {
    set({ selectedOcid: ocid })
    await setLastSelectedCharacter(ocid)
  },
}))
