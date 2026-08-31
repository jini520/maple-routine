import { useEffect, useRef, useState } from 'react'

/** 한 번 굴러가는 시간. */
export const COUNT_UP_DURATION_MS = 350

/** 시간 진행률을 거리 진행률로 바꾼다. 앞 10% 시간에 절반을 가고 나머지를 천천히 좁힌다. */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - 2 ** (-10 * t)
}

/** 키별 마지막 표시값. 모듈 수준이라 언마운트해도 남는다 ([[ADR-087]] 결정 8). */
const lastDisplayedByIdentity = new Map<string, number>()

/** 테스트 전용. 위 기억을 비운다. */
export function clearCountUpMemory(): void {
  lastDisplayedByIdentity.clear()
}

/**
 * 금액이 바뀌면 목표까지 굴려서 낸다 ([[ADR-087]] 결정 6·7·8).
 *
 * 굴러가는 중에 목표가 또 바뀌면 지금 값에서 목표만 갈아 끼운다. 목표가 내려가면 숫자도 내려간다.
 *
 * @param identity 숫자를 구분하는 키. 같으면 이어서 굴리고, 바뀌면 그 키로 마지막에 그렸던 값에서
 *   다시 굴린다.
 * @param target 목표 금액.
 * @returns 지금 그릴 값.
 */
export function useCountUp(identity: string, target: number): number {
  // 기억이 있으면 거기서, 없으면 목표에서 출발한다. 없을 때는 첫 렌더가 굴러가지 않는다.
  const [display, setDisplay] = useState(() => lastDisplayedByIdentity.get(identity) ?? target)
  // 지금 그려진 값을 들고 있다. 렌더 중에는 건드리지 않고 effect 와 rAF 콜백만 읽고 쓴다.
  const displayRef = useRef(display)
  const frameRef = useRef<number | null>(null)

  // 키가 바뀌면 재마운트처럼 다룬다([[ADR-087]] 정정 1). 마운트 때만 기억을 읽으면 총 수익
  // 헤드라인처럼 키만 갈리는 자리가 옛 값에서 굴러 나온다.
  //
  // effect 로 미루면 옛 값이 한 프레임 보이므로 렌더 중에 맞춘다. 렌더 중 setState 는 React 가
  // 허용하는 패턴이고, 키와 기억만 보고 정하니 StrictMode 가 두 번 불러도 같은 값이 나온다.
  const [renderedIdentity, setRenderedIdentity] = useState(identity)
  if (renderedIdentity !== identity) {
    setRenderedIdentity(identity)
    setDisplay(lastDisplayedByIdentity.get(identity) ?? target)
  }

  // 위 분기는 렌더 중이라 `displayRef` 를 못 건드린다. 아래 effect 가 이 ref 로 알아채고 맞춘다.
  const settledIdentityRef = useRef(identity)

  useEffect(() => {
    if (settledIdentityRef.current !== identity) {
      settledIdentityRef.current = identity
      displayRef.current = lastDisplayedByIdentity.get(identity) ?? target
    }
    const from = displayRef.current
    if (from === target) {
      lastDisplayedByIdentity.set(identity, target)
      return
    }
    const startedAt = performance.now()

    const step = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / COUNT_UP_DURATION_MS)
      // 마지막 프레임은 계산값 대신 목표를 그대로 쓴다. 반올림이 1 을 남길 수 있다.
      const value = progress === 1 ? target : Math.round(from + (target - from) * easeOutExpo(progress))
      displayRef.current = value
      // 굴러가는 중에 화면을 떠도 이어붙일 수 있게 매 프레임 기억한다.
      lastDisplayedByIdentity.set(identity, value)
      setDisplay(value)
      if (progress < 1) frameRef.current = requestAnimationFrame(step)
    }

    frameRef.current = requestAnimationFrame(step)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
    // `from` 은 의존성에서 뺀다. 다시 조준할 출발점은 렌더 시점의 state 가 아니라 지금 그려진 값이다.
    // 넣으면 매 프레임 effect 가 다시 돌며 스스로를 재시작한다.
  }, [identity, target])

  return display
}
