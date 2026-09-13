/**
 * 고른 캐릭터와 대표 표식을 앱 전체에 한 벌로 드는 스토어.
 *
 * 저장 키는 처음부터 하나였고 갈리는 자리는 **메모리**였다. 컨텐츠 스토어와 보스 스토어가 각자
 * `selectedOcid` 를 들었고 저장소를 읽는 것은 하이드레이션 한 회차뿐이라, 컨텐츠에서 바꾸면 이미
 * 하이드레이션이 끝난 보스 스토어는 옛 값 그대로였다. 대표 표식도 같은 모양으로 갈렸다. today 가
 * 화면 상태로 사본을 들어, 캐릭터 관리에서 대표를 바꿔도 당기기 전까지 옛 캐릭터를 그렸다.
 *
 * **진입할 때마다 저장소를 다시 읽는 길로 안 간다.** 값은 맞지만 두 벌 구조가 그대로 남고 첫
 * 프레임이 한 박자 늦는다. 값을 옮기는 대신 소유자를 하나로 만든다.
 *
 * 목록은 여기 없다. 이 스토어가 갖는 것은 무엇을 골랐나와 누가 대표인가 둘뿐이고, 고를 수 있는
 * 것은 화면마다 다르다.
 */

import { create } from 'zustand'

import {
  clearRepresentativeCharacter,
  getLastSelectedCharacter,
  getRepresentativeCharacter,
  setLastSelectedCharacter,
  setRepresentativeCharacter,
} from '../../storage/character-selection'

export interface CharacterSelectionStore {
  /** 마지막으로 고른 캐릭터. 하이드레이션 전이거나 한 번도 고른 적이 없으면 `null`. */
  selectedOcid: string | null
  /**
   * 저장된 대표 ocid. 미지정이면 `null` 이고, 목록의 첫 번째(임시 대표)는 여기 담지 않는다.
   *
   * `null` 만으로는 미지정과 아직 안 읽음이 안 갈린다. 그것은 `isRepresentativeHydrated` 가 가른다.
   */
  representativeOcid: string | null
  /** 대표 표식을 저장소에서 읽었거나 사용자가 썼는가. 참이면 `hydrate()` 가 대표를 다시 읽지 않는다. */
  isRepresentativeHydrated: boolean
  /**
   * 저장된 선택과 대표를 메모리로 올리는 적재. 스케줄러 스토어들의 `loadTrackedOcids()` 가 부른다.
   *
   * **이미 든 값이 있으면 저장소를 읽지 않는다.** 화면 넷이 각자 진입할 때마다 이 문을 지나는데,
   * 매번 읽어서 덮으면 늦게 도착한 하이드레이션이 방금 고른 값을 되돌린다. 없애려는 두 벌 이
   * 시간축에서 되살아나는 형태다.
   *
   * 대표 표식을 못 읽으면 삼키고 안 읽음으로 남긴다. `loadTrackedOcids()` 가 이것을 기다리므로
   * 던지면 추적 목록 적재까지 함께 실패한다.
   */
  hydrate(): Promise<void>
  /** 고르는 자리. 메모리와 저장소가 함께 움직인다. */
  select(ocid: string): Promise<void>
  /**
   * 대표를 쓰는 자리. 메모리를 먼저 바꾸고 저장소 쓰기를 기다린다. `null` 이면 저장된 대표를 지운다.
   *
   * 추적 목록 저장 **뒤에** 불러야 한다. 목록 저장이 새 목록에 없는 대표를 지운다.
   */
  setRepresentative(ocid: string | null): Promise<void>
  /**
   * 대표를 저장소에서 다시 읽어 메모리를 덮는 자리. 저장소 함수가 대표를 옮긴 뒤(월드 이전 확인)에
   * 부른다. 못 읽으면 든 값을 그대로 둔다.
   */
  reloadRepresentative(): Promise<void>
}

/** 못 읽으면 `undefined`. 미지정(`null`)과 가르기 위해서다. */
async function readRepresentative(): Promise<string | null | undefined> {
  try {
    return await getRepresentativeCharacter()
  } catch {
    return undefined
  }
}

export const useCharacterSelectionStore = create<CharacterSelectionStore>()((set, get) => ({
  selectedOcid: null,
  representativeOcid: null,
  isRepresentativeHydrated: false,

  async hydrate() {
    const needsSelected = get().selectedOcid === null
    const needsRepresentative = !get().isRepresentativeHydrated
    if (!needsSelected && !needsRepresentative) return

    const [stored, representative] = await Promise.all([
      needsSelected ? getLastSelectedCharacter() : null,
      needsRepresentative ? readRepresentative() : undefined,
    ])
    // 기다리는 동안 사용자가 골랐을 수 있다. 그 값이 이긴다(저장소는 과거, 선택은 현재다).
    if (stored !== null && get().selectedOcid === null) set({ selectedOcid: stored })
    if (representative !== undefined && !get().isRepresentativeHydrated) {
      set({ representativeOcid: representative, isRepresentativeHydrated: true })
    }
  },

  async select(ocid) {
    set({ selectedOcid: ocid })
    await setLastSelectedCharacter(ocid)
  },

  async setRepresentative(ocid) {
    set({ representativeOcid: ocid, isRepresentativeHydrated: true })
    await (ocid === null ? clearRepresentativeCharacter() : setRepresentativeCharacter(ocid))
  },

  async reloadRepresentative() {
    const representative = await readRepresentative()
    if (representative === undefined) return
    set({ representativeOcid: representative, isRepresentativeHydrated: true })
  },
}))
