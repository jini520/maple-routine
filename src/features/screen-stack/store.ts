import { create } from 'zustand'

// 화면 스택의 전역 상태([[ADR-120]]). **오버레이와 그 아래 화면이 서로 다른 DOM 가지에 살기 때문에**
// 필요하다 — 오버레이는 포털로 탭 레이어 밖에 그려지므로(결정 3) 프롭으로 값을 내려줄 길이 없다.
//
// 읽는 쪽이 셋이다:
//   · `TabLayer`        — 아래 화면을 얼마나 밀지, 스크림을 얼마나 덮을지
//   · `StackScreen`     — 자기 층의 `transform` 과 드래그 여부(전환을 걸지 말지)
//   · 탭 화면 3개의 PTR — 오버레이가 열려 있으면 당겨서 새로고침을 끈다(결정 10)
//
// **`progress` 가 하나뿐인 이유**: 스택은 2단 이상이 될 수 있지만(`/settings/about/privacy`)
// **움직이는 것은 언제나 최상단 하나**다. 나머지 층은 자기 자리에 서 있으므로 각자의 값이 필요
// 없고, `depth` 와 자기 `index` 만 알면 어디에 서 있어야 하는지가 정해진다
// (`resolveLayerTransform`). 층마다 값을 들고 있는 배열은 그 관계를 두 벌로 만들 뿐이다.

export interface ScreenStackStore {
  /**
   * 열려 있는 오버레이의 수. 나가는 연출이 도는 동안에도 아직 세어진다(화면에 있다).
   * `0` 이면 탭 화면만 있는 상태이고, 그때 탭 레이어에는 `transform` 이 없다(결정 7).
   */
  depth: number
  /**
   * **최상단** 오버레이의 진행률. `0` = 다 들어와 화면을 덮음, `1` = 화면 밖 오른쪽.
   * 들어오는 연출은 1→0, 나가는 연출은 0→1, 스와이프는 손가락 위치가 그대로 이 값이다.
   */
  progress: number
  /**
   * 손가락이 붙어 있는가. 참이면 전환(`transition`)을 걸지 않는다 — 손가락이 붙어 있는데 전환이
   * 걸리면 화면이 전환 시간만큼 늘 뒤처진 위치를 그려 "끌린다"는 감각이 죽는다
   * ([[ADR-073]] 결정 4 가 당겨서 새로고침에서 세운 것과 같은 이유).
   */
  isDragging: boolean
  /**
   * 지금 걸 전환 시간(ms). **한 값이 아니라 국면마다 다르다** — 들어올 때는 전체 시간이고,
   * 끌다 놓았을 때는 남은 거리에 비례해 줄어든다(`resolveSettleMs`). 배치만 하고 움직이지 않을
   * 때는 0이다(오버레이를 화면 밖에 세워 두는 첫 프레임).
   */
  transitionMs: number

  /** 오버레이 마운트 — 전환 없이 화면 밖(1)에 세운다. */
  open(): void
  /**
   * 오버레이 언마운트. 남은 최상단은 **이미 다 들어와 있으므로** 진행률이 0이고, 마지막 하나가
   * 닫히면 1로 돌아간다 — 그 순간이 탭 레이어의 `transform` 이 사라지는 지점이다(결정 7).
   */
  close(): void
  setProgress(progress: number): void
  setDragging(isDragging: boolean): void
  setTransitionMs(transitionMs: number): void
}

export const useScreenStackStore = create<ScreenStackStore>()((set) => ({
  depth: 0,
  progress: 1,
  isDragging: false,
  transitionMs: 0,

  open() {
    set((state) => ({
      depth: state.depth + 1,
      progress: 1,
      isDragging: false,
      transitionMs: 0,
    }))
  },

  close() {
    set((state) => {
      const depth = Math.max(0, state.depth - 1)
      return { depth, progress: depth === 0 ? 1 : 0, isDragging: false, transitionMs: 0 }
    })
  },

  setProgress(progress: number) {
    set({ progress: Math.min(Math.max(progress, 0), 1) })
  },

  setDragging(isDragging: boolean) {
    set({ isDragging })
  },

  setTransitionMs(transitionMs: number) {
    set({ transitionMs })
  },
}))
