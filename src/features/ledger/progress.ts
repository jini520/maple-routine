/**
 * 회차의 진행률. **모달만 구독한다.**
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

interface LedgerProgressState {
  /** 이 회차에 끝난 작업 수. 실패도 센다 */
  done: number
  /** 이 회차에 해야 할 작업 수. **0 이면 아직 안 정해졌다**(바를 안 그린다) */
  total: number
  /** 수집기 하나가 자기 몫을 등록한다. 돌려받은 칸 번호로 진행을 올린다 */
  start: (total: number) => number
  /** @param done 그 칸의 **누적** 끝난 수 */
  advance: (slot: number, done: number) => void
  /** 회차가 끝나면 비운다 */
  reset: () => void
}

export const useLedgerProgress = create<LedgerProgressState>()((set) => {
  const slots: Slot[] = []

  const publish = (): void => {
    set({
      done: slots.reduce((sum, slot) => sum + slot.done, 0),
      total: slots.reduce((sum, slot) => sum + slot.total, 0),
    })
  }

  return {
    done: 0,
    total: 0,
    start(total) {
      slots.push({ total, done: 0 })
      publish()
      return slots.length - 1
    },
    advance(slot, done) {
      const entry = slots[slot]
      if (entry === undefined) return
      entry.done = done
      publish()
    },
    reset() {
      slots.length = 0
      set({ done: 0, total: 0 })
    },
  }
})
