/**
 * 월드 이전으로 보이는 캐릭터 하나를 물어보기까지 들고 있는 자리.
 *
 * 판정은 동기화와 로스터 조회 중에 나고 모달은 `AppNavigation` 이 그린다. 둘이 서로를 모르므로
 * 그 사이에 값이 설 자리가 필요하다.
 *
 * **한 번에 하나만 든다.** 한 계정이 통째로 이전하면 후보가 여럿일 수 있지만, 모달을 쌓으면
 * 사용자가 같은 질문에 연달아 답하게 된다. 먼저 온 것을 지키고 나머지는 다음 회차에 다시
 * 판정된다(추적 목록에 남아 있으므로 조건이 그대로다).
 *
 * **거절한 것은 이 실행 동안 다시 안 묻는다.** 화면을 오갈 때마다 로스터가 다시 돌아 같은
 * 캐릭터를 또 짚는다. 영속화하지 않는 것은 사용자가 이 문제를 **반드시 해결해야 하기**
 * 때문이다(사용자 지시). 챌린저스의 조회 불가는 리프뿐이라 틀린 질문일 수가 없고, 틀릴 수 없는
 * 질문이면 매 실행 반복해도 사용자를 속이지 않는다. 그만두는 조건은 하나, 그 캐릭터를 추적
 * 목록에서 빼는 것이다(그러면 판정이 후보로도 안 든다).
 */
import { create } from 'zustand'

import { removeTrackedCharacter, replaceTrackedCharacter } from '../../storage/character-selection'
import type { WorldLeapNotice } from './world-leap'

interface WorldLeapStore {
  /** 물어볼 것. 없으면 `null` 이고 모달이 안 선다. */
  notice: WorldLeapNotice | null
  /** 이 실행 동안 사용자가 답한 옛 ocid. `나중에` 와 `캐릭터 관리로 이동` 이 함께 넣는다. */
  dismissedOcids: Set<string>
  /**
   * 방금 정리한 자리. `to` 가 ocid 면 갈아끼웠고 `null` 이면 목록에서 뺐다.
   *
   * **초안(`useSelectionDraft`)이 이것을 구독한다.** 모달이 화면 밖에 살아 초안에 손이 닿지
   * 않는다. 안 이어받으면 캐릭터 관리를 편집하던 중에 눌렀을 때 초안이 죽은 ocid 를 든 채 남아
   * 저장 한 번에 되살아난다.
   *
   * 해제를 위한 칸을 따로 두지 않는다. 구독이 둘이 되면 다음 갈래가 생길 때 하나를 안 본다.
   *
   * 안 비운다. 초안이 뒤늦게 마운트돼 이 값을 다시 읽어도 그 자리에 옛 ocid 가 없어 무동작이다.
   */
  resolved: { from: string; to: string | null } | null
  /** 판정이 짚은 것을 들인다. 이미 들고 있거나 거절당한 것이면 아무 일도 안 한다. */
  noticeWorldLeap: (notice: WorldLeapNotice) => void
  /** `나중에` · `캐릭터 관리로 이동`. 표식은 그대로 남는다. */
  dismiss: () => void
  /**
   * 주 버튼. **바뀐 목록을 돌려준다**. 기록은 어느 쪽으로도 안 옮긴다.
   *
   * 하는 일이 알림에 따라 갈린다. `confirmed` 는 추적 목록의 ocid 를 갈아끼우고,
   * `alreadyTracked` 는 옛 ocid 를 뺀다(옮겨간 캐릭터가 이미 목록에 있어 더할 것이 없다).
   *
   * 목적지를 모르는 알림(`unknown`)에는 할 일이 없어 `null` 이다. 그 모달의 주 버튼은 캐릭터
   * 관리로 이동이라 여기 오지 않는다.
   *
   * 앱 상태 전파는 호출부의 일이다. 여기서 컨텐츠 스케줄러 스토어를 부르면 모듈 순환이 된다
   * (그 스토어 → `schedule-sync` → `character-roster` → 이 파일). 모달이 그 값을 받아
   * `saveTrackedOcids` 로 흘린다.
   */
  confirm: () => Promise<string[] | null>
}

export const useWorldLeapStore = create<WorldLeapStore>((set, get) => ({
  notice: null,
  dismissedOcids: new Set(),
  resolved: null,

  noticeWorldLeap: (notice) => {
    const { notice: standing, dismissedOcids } = get()
    if (standing !== null || dismissedOcids.has(notice.from.ocid)) {
      return
    }
    set({ notice })
  },

  dismiss: () => {
    const { notice, dismissedOcids } = get()
    if (notice === null) {
      return
    }
    set({ notice: null, dismissedOcids: new Set(dismissedOcids).add(notice.from.ocid) })
  },

  confirm: async () => {
    const { notice } = get()
    if (notice === null || notice.kind === 'unknown') {
      return null
    }
    // 옮겨간 캐릭터를 이미 관리 중이면 갈아끼울 것이 없다. 남은 일은 옛 것을 빼는 하나다.
    const to = notice.kind === 'confirmed' ? notice.to.ocid : null
    // 모달을 먼저 닫지 않는다. 저장이 실패하면 목록이 안 바뀐 채 질문만 사라진다.
    const saved =
      to === null
        ? await removeTrackedCharacter(notice.from.ocid)
        : await replaceTrackedCharacter(notice.from.ocid, to)
    // 거절 목록에도 넣는다. 정리한 뒤에는 옛 ocid 가 추적 목록에 없어 판정이 다시 서지 않지만,
    // 같은 회차에 이미 흐르고 있던 판정이 뒤늦게 도착할 수 있다.
    set((state) => ({
      notice: null,
      dismissedOcids: new Set(state.dismissedOcids).add(notice.from.ocid),
      resolved: { from: notice.from.ocid, to },
    }))
    return saved
  },
}))

/** 테스트가 실행 간 상태를 흘리지 않게 되돌린다. */
export function resetWorldLeapStoreForTests(): void {
  useWorldLeapStore.setState({ notice: null, dismissedOcids: new Set(), resolved: null })
}
