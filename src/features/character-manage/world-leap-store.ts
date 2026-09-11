/**
 * 월드 이전으로 보이는 캐릭터 하나를 물어보기까지 들고 있는 자리.
 *
 * 판정은 로스터 조회 중에 나고 모달은 `AppShell` 이 그린다. 둘이 서로를 모르므로 그 사이에
 * 값이 설 자리가 필요하다.
 *
 * **한 번에 하나만 든다.** 한 계정이 통째로 이전하면 후보가 여럿일 수 있지만, 모달을 쌓으면
 * 사용자가 같은 질문에 연달아 답하게 된다. 먼저 온 것을 지키고 나머지는 다음 회차에 다시
 * 판정된다(추적 목록에 남아 있으므로 조건이 그대로다).
 *
 * **거절한 것은 이 실행 동안 다시 안 묻는다.** 화면을 오갈 때마다 로스터가 다시 돌아 같은
 * 캐릭터를 또 짚는다. 영속화하지 않는 것은 그 거절이 영영 가 아니라 지금은 아니다 라서다 -
 * 앱을 다시 켜면 다시 묻는다.
 */
import { create } from 'zustand'

import { replaceTrackedCharacter } from '../../storage/character-selection'
import type { WorldLeapCandidate } from './world-leap'

interface WorldLeapStore {
  /** 물어볼 것. 없으면 `null` 이고 모달이 안 선다. */
  candidate: WorldLeapCandidate | null
  /** 이 실행 동안 사용자가 `나중에` 를 누른 옛 ocid. */
  dismissedOcids: Set<string>
  /** 판정이 짚은 것을 들인다. 이미 들고 있거나 거절당한 것이면 아무 일도 안 한다. */
  noticeWorldLeap: (candidate: WorldLeapCandidate) => void
  /** `나중에`. 표식은 그대로 남는다. */
  dismiss: () => void
  /**
   * `변경`. 추적 목록의 ocid 를 갈아끼우고 **바뀐 목록을 돌려준다**. 기록은 안 옮긴다.
   *
   * 앱 상태 전파는 호출부의 일이다. 여기서 컨텐츠 스케줄러 스토어를 부르면 모듈 순환이 된다
   * (그 스토어 → `schedule-sync` → `character-roster` → 이 파일). 모달이 그 값을 받아
   * `saveTrackedOcids` 로 흘린다.
   */
  confirm: () => Promise<string[] | null>
}

export const useWorldLeapStore = create<WorldLeapStore>((set, get) => ({
  candidate: null,
  dismissedOcids: new Set(),

  noticeWorldLeap: (candidate) => {
    const { candidate: standing, dismissedOcids } = get()
    if (standing !== null || dismissedOcids.has(candidate.from.ocid)) {
      return
    }
    set({ candidate })
  },

  dismiss: () => {
    const { candidate, dismissedOcids } = get()
    if (candidate === null) {
      return
    }
    set({ candidate: null, dismissedOcids: new Set(dismissedOcids).add(candidate.from.ocid) })
  },

  confirm: async () => {
    const { candidate } = get()
    if (candidate === null) {
      return null
    }
    // 모달을 먼저 닫지 않는다. 저장이 실패하면 목록이 안 바뀐 채 질문만 사라진다.
    const replaced = await replaceTrackedCharacter(candidate.from.ocid, candidate.to.ocid)
    // 거절 목록에도 넣는다. 바꾼 뒤에는 옛 ocid 가 추적 목록에 없어 판정이 다시 서지 않지만,
    // 같은 회차에 이미 흐르고 있던 판정이 뒤늦게 도착할 수 있다.
    set((state) => ({
      candidate: null,
      dismissedOcids: new Set(state.dismissedOcids).add(candidate.from.ocid),
    }))
    return replaced
  },
}))

/** 테스트가 실행 간 상태를 흘리지 않게 되돌린다. */
export function resetWorldLeapStoreForTests(): void {
  useWorldLeapStore.setState({ candidate: null, dismissedOcids: new Set() })
}
