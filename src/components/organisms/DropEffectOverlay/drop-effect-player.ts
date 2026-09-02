// 드랍 연출 재생 상태 기계. 웹 `DropEffectOverlay` 의 `tick()` 을 **순수 함수로** 옮긴 것이다.
//
// ## 왜 컴포넌트에서 떼어냈나
//
// 웹판은 이 로직이 `useEffect` 안의 클로저 + DOM 변이(`el.src`·`el.style`)와 한 덩어리라 **단위로
// 검사할 방법이 없었다.** 여기서 지켜야 할 것들. 8프레임 시점에 아이템이 뜬다 ·
// pre 가 끝나면 loop 로 넘어가 무한 반복한다 · 닫기는 end 를 한 번 재생하고 끝난다. 은 전부
// **눈에 안 보이는 순서**라, 화면 없이 검사할 수 있는 형태가 아니면 회귀를 못 잡는다.
//
// 그래서 상태 전이만 여기 두고, 프레임을 실제로 그리는 일(`<Image source>`)과 시간을 흘려보내는 일
// (`requestAnimationFrame`)은 컴포넌트가 한다.
//
// ## `requestAnimationFrame` 은 step 7 이 금지한 것이 아니다
//
// 3단계 step 7 이 금지한 것은 *"`setInterval` 로 상태를 갱신해 **애니메이션**을 만드는 것"* 이고,
// 이유는 그런 모션이 UI 스레드에서 도는 Reanimated 로 표현 가능하기 때문이다. **스프라이트 재생은
// 그 부류가 아니다**. 매 프레임 `<Image>` 의 소스를 갈아끼우는 일이라 JS 스레드에서 결정할 수밖에
// 없고(워크릿은 React 트리를 못 바꾼다), 웹판도 같은 이유로 `requestAnimationFrame` 이었다.
// 이 파일이 만드는 것은 좌표가 아니라 **몇 번째 그림인가**다.

/** 단계별 고정 fps. 방식, 값은 이 1.5배로 상향한 것. */
export const DROP_EFFECT_FPS = { screen: 22.5, pre: 21, loop: 17.25, end: 18 } as const

/**
 * 아이템 등장 트리거. **시간이 아니라 ScreenEff 프레임 인덱스**다.
 * 버스트가 최대로 벌어지는 그림에 묶여 있어 fps 배율이 바뀌어도 이 값은 그대로다.
 */
export const DROP_START_FRAME = 8

/** 한 tick 이 삼킬 수 있는 최대 시간. 백그라운드에서 돌아왔을 때 폭주 방지(웹과 같은 값). */
export const MAX_TICK_MS = 100

type DropPillarPhase = 'pre' | 'loop' | 'end'

export interface DropEffectFrameCounts {
  screen: number
  pre: number
  loop: number
  end: number
}

interface DropEffectState {
  /** ScreenEff 진행. `done` 이면 더 그리지 않는다. */
  screenIndex: number
  screenDone: boolean
  screenAcc: number
  /** DropEff 기둥. 시작 전에는 `null`(그릴 것이 없다). */
  pillarPhase: DropPillarPhase | null
  pillarIndex: number
  pillarAcc: number
  /** 아이템은 기둥과 같은 순간에 뜬다(웹 `startDrop`). */
  itemVisible: boolean
  /** 닫는 중. end 를 재생하고 있다. */
  closing: boolean
  /** 재생이 끝나 부모가 언마운트해야 하는 상태. */
  finished: boolean
}

export function createDropEffectState(): DropEffectState {
  return {
    screenIndex: 0,
    screenDone: false,
    screenAcc: 0,
    pillarPhase: null,
    pillarIndex: 0,
    pillarAcc: 0,
    itemVisible: false,
    closing: false,
    finished: false,
  }
}

/**
 * `dt` 밀리초만큼 흘려보낸 다음 상태를 돌려준다. **입력을 바꾸지 않는다.**
 *
 * 프레임이 하나도 없는 단계는 건너뛴다. 에셋이 빠져도 재생이 멈추지 않고 닫기까지 간다(웹과 같은
 * 방어: `frames.loop.length === 0` 이면 연출 없이 닫기만).
 */
export function advanceDropEffect(
  state: DropEffectState,
  dtMs: number,
  counts: DropEffectFrameCounts,
): DropEffectState {
  const dt = Math.min(Math.max(dtMs, 0), MAX_TICK_MS)
  const next = { ...state }

  if (next.finished) return next

  if (next.closing) {
    // 닫기: end 를 한 번 재생하고 끝낸다.
    if (counts.end === 0) {
      next.finished = true
      return next
    }
    next.pillarAcc += dt
    const dur = 1000 / DROP_EFFECT_FPS.end
    while (next.pillarAcc >= dur) {
      next.pillarAcc -= dur
      next.pillarIndex += 1
      if (next.pillarIndex >= counts.end) {
        next.finished = true
        return next
      }
    }
    return next
  }

  // ── ScreenEff: 1회 재생. 8프레임 시점에 기둥·아이템을 켠다.
  if (!next.screenDone && counts.screen > 0) {
    next.screenAcc += dt
    const dur = 1000 / DROP_EFFECT_FPS.screen
    while (next.screenAcc >= dur) {
      next.screenAcc -= dur
      next.screenIndex += 1
      if (next.pillarPhase === null && next.screenIndex >= DROP_START_FRAME) {
        next.pillarPhase = 'pre'
        next.pillarIndex = 0
        next.pillarAcc = 0
        next.itemVisible = true
      }
      if (next.screenIndex >= counts.screen) {
        next.screenDone = true
        next.screenIndex = counts.screen - 1
        break
      }
    }
  } else if (!next.screenDone) {
    // ScreenEff 프레임이 없으면 트리거가 영영 안 온다. 기둥을 곧바로 켠다.
    next.screenDone = true
    next.pillarPhase = 'pre'
    next.itemVisible = true
  }

  // ── DropEff: pre 1회 → loop 무한.
  if (next.pillarPhase === 'pre' || next.pillarPhase === 'loop') {
    next.pillarAcc += dt
    for (;;) {
      const dur = 1000 / (next.pillarPhase === 'pre' ? DROP_EFFECT_FPS.pre : DROP_EFFECT_FPS.loop)
      if (next.pillarAcc < dur) break
      next.pillarAcc -= dur
      next.pillarIndex += 1

      if (next.pillarPhase === 'pre') {
        if (next.pillarIndex >= counts.pre) {
          next.pillarPhase = 'loop'
          next.pillarIndex = 0
        }
      } else if (next.pillarIndex >= counts.loop) {
        next.pillarIndex = 0
      }

      // 두 단계 모두 프레임이 없으면 무한 루프가 된다. 그리지 않는 상태로 빠져나온다.
      if (counts.pre === 0 && counts.loop === 0) {
        next.pillarPhase = null
        break
      }
    }
  }

  return next
}

/**
 * 닫기 요청. end 재생으로 넘어간다. **이미 닫는 중이면 즉시 끝낸다**(웹과 같은 두 번 탭하면 건너뛴다).
 */
export function requestDropEffectClose(
  state: DropEffectState,
  counts: DropEffectFrameCounts,
): DropEffectState {
  if (state.finished) return state
  if (state.closing || counts.end === 0) return { ...state, closing: true, finished: true }

  return {
    ...state,
    closing: true,
    screenDone: true,
    pillarPhase: 'end',
    pillarIndex: 0,
    pillarAcc: 0,
    itemVisible: true,
  }
}

/**
 * **그려지는 것이 달라지는가.** 재생 상태는 매 tick 바뀌지만(누적 시간 `*Acc`) 화면에 나오는 것은
 * 단계별 fps 로만 바뀐다. screen 22.5 · loop 17.25. 그 차이를 안 걸러내면 120Hz 기기에서 초당
 * 120번 트리를 다시 그리면서 정작 그림은 22번만 바뀐다.
 *
 * 2026-08-26 갤럭시 Z Flip3 실측. 그 낭비가 **재생 첫머리의 불균등**으로 나왔다. 상태는 제때
 * 진행하는데 렌더가 밀려, frame 0 이 82ms 서 있고 frame 2 가 25ms 만에 지나갔다(기대는 둘 다 44ms).
 * 누적 시간은 여기서 일부러 뺀다. 그것 때문에 매번 달라졌다 가 되면 거르는 의미가 없다.
 */
export function rendersDifferently(a: DropEffectState, b: DropEffectState): boolean {
  return (
    a.screenIndex !== b.screenIndex ||
    a.screenDone !== b.screenDone ||
    a.pillarPhase !== b.pillarPhase ||
    a.pillarIndex !== b.pillarIndex ||
    a.itemVisible !== b.itemVisible ||
    a.finished !== b.finished
  )
}
