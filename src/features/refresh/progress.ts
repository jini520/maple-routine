/**
 * 새로고침 회차의 진행률. **모달만 구독한다.**
 *
 * 층 프로바이더의 state 에 두면 작업 하나가 끝날 때마다 탭 내비게이터가 통째로 다시 그려진다
 * (첫 진입이면 84번). 그래서 별도 스토어다.
 *
 * 세는 단위는 **호출이 아니라 작업**이다. 히스토리는 하루가 1000건을 넘으면 커서로 콜이 더
 * 나가는데, 콜을 세면 분모가 도는 중에 늘어난다. 작업 하나를 `(종류, 날짜)` 로 두면 그 안에서
 * 커서를 몇 번 돌든 밖에서는 1이라 분모가 안 흔들린다.
 */
import { create } from 'zustand'

interface Slot {
  total: number
  done: number
}

interface RefreshProgressState {
  /** 이 회차에 끝난 작업 수. 실패도 센다 */
  done: number
  /** 이 회차에 해야 할 작업 수. **0 이면 아직 안 정해졌다**(바를 안 그린다) */
  total: number
  /**
   * 회차를 연다. 돌려받은 함수로 닫는다.
   *
   * 회차가 필요한 것은 **한 회차 안의 단계가 순차**여서다(라이브 → 창·히스토리). 칸이 자기 몫만
   * 끝나고 사라지면 그 사이 분모가 0 이 돼 바가 꺼졌다 켜진다. 마지막 회차가 닫힐 때 한 번에
   * 걷는다.
   *
   * 참조를 세므로 회차가 겹쳐도 된다. 안쪽 회차(`syncSchedules`)가 닫혀도 바깥이 열려 있으면
   * 칸이 안 걷힌다. 돌려준 함수는 두 번 불러도 한 번만 센다.
   */
  beginRound: () => () => void
  /** 수집기 하나가 자기 몫을 등록한다. 돌려받은 칸 번호로 진행을 올린다 */
  start: (total: number) => number
  /**
   * @param done 그 칸의 **누적** 끝난 수
   * @param total 실제로 해 보니 달랐던 분모. **추정으로 연 칸만** 준다. 안 주면 그대로 둔다
   */
  advance: (slot: number, done: number, total?: number) => void
  /** 테스트 전용. `beforeEach` 에서 부른다. 프로덕션 코드에서 부르지 말 것 */
  resetForTests: () => void
}

export const useRefreshProgress = create<RefreshProgressState>()((set) => {
  // 칸은 지워지지 않고 번호가 곧 열쇠다. 배열 인덱스로 두면 걷을 때 남은 칸의 번호가 밀린다.
  const slots = new Map<number, Slot>()
  let nextSlot = 0
  let openRounds = 0

  const publish = (): void => {
    let done = 0
    let total = 0
    for (const slot of slots.values()) {
      done += slot.done
      total += slot.total
    }
    set({ done, total })
  }

  return {
    done: 0,
    total: 0,

    beginRound() {
      openRounds += 1
      let closed = false
      return () => {
        // 같은 함수를 두 번 불러도 한 번만 센다. 안 그러면 겹친 회차에서 남의 몫까지 닫는다.
        if (closed) return
        closed = true
        openRounds -= 1
        if (openRounds > 0) return
        slots.clear()
        set({ done: 0, total: 0 })
      }
    },

    start(total) {
      const slot = nextSlot++
      slots.set(slot, { total, done: 0 })
      publish()
      return slot
    },

    advance(slot, done, total) {
      const entry = slots.get(slot)
      // 회차가 걷힌 뒤 늦게 온 응답이 여기로 온다. 조용히 버린다.
      if (entry === undefined) return
      entry.done = done
      // 계획을 세울 때 못 세는 몫이 있다(추적 목록에는 있는데 계정 목록에 없는 캐릭터). 실제 수가
      // 오면 고친다. 안 고치면 바가 끝까지 안 찬다.
      if (total !== undefined) entry.total = total
      publish()
    },

    // 테스트 전용. 모듈 수준 상태라 테스트끼리 오염된다. **안 닫힌 회차가 그 통로다.** 끝나지
    // 않는 회차를 세워 두고 검사하는 테스트가 자기 칸을 다음 테스트에 남긴다.
    // 프로덕션 코드에서 부르지 말 것. 도는 회차의 칸을 걷어 바가 뒤로 간다.
    resetForTests() {
      slots.clear()
      nextSlot = 0
      openRounds = 0
      set({ done: 0, total: 0 })
    },
  }
})
