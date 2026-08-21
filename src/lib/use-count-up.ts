import { useEffect, useRef, useState } from 'react'

/**
 * 금액이 바뀔 때 목표까지 굴러가는 카운트업 ([[ADR-087]] 결정 6·7·8).
 *
 * 네 가지가 이 훅의 요구다.
 * 1. **곡선은 `easeOutExpo`, 길이는 350ms** — 빠르게 출발해 끝에서 오래 끈다.
 * 2. **연타는 재시작이 아니라 재조준**(결정 7) — 파티원 스테퍼는 이전 tween 이 끝나기 전에 목표를
 *    또 바꾼다. 0이나 이전 목표에서 다시 출발하면 숫자가 뒤로 튄다.
 * 3. **마운트도 값 변경과 같이 다룬다**(결정 8) — 그러려면 직전에 그린 값을 컴포넌트 **바깥**에
 *    기억해야 한다(언마운트 뒤에도 알아야 하므로 state 로는 불가능하다).
 * 4. **identity 교체는 재마운트와 같이 다룬다**(정정 1) — 언마운트 없이 정체만 바뀌는 자리가 있고,
 *    거기서 옛 정체의 값에서 굴러가면 안 된다.
 */

export const COUNT_UP_DURATION_MS = 350

/** 전체 거리의 절반을 10% 지점에서 지난다 — 감속이 실제로 읽히려면 이 정도는 되어야 한다. */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - 2 ** (-10 * t)
}

/**
 * 마지막으로 화면에 그린 값. 모듈 수준이라 언마운트를 건너 살아남는다(세션 한정 — 앱을 껐다 켜면
 * 비어 있다, [[ADR-087]] 결정 8).
 *
 * **키가 곧 "이 숫자의 정체"다.** 키가 바뀌면 같은 값이 변한 것이 아니라 **다른 값을 보게 된 것**
 * 이므로 굴리지 않고 그 정체의 기억(없으면 목표)으로 리셋한다. 무엇을 키에 넣을지가 곧 "무엇을
 * 굴릴지"의 정책이다 — 총 수익 헤드라인만 키에서 기간을 빼 기간 이동에도 굴러간다
 * ([[ADR-087]] 정정 1, 호출부 `BossProfitScreen` 참고).
 */
const lastDisplayedByIdentity = new Map<string, number>()

/** 테스트 전용 — 모듈 수준 기억이 케이스 사이로 새지 않게 한다. */
export function clearCountUpMemory(): void {
  lastDisplayedByIdentity.clear()
}

export function useCountUp(identity: string, target: number): number {
  // 마운트 시 출발점을 기억에서 꺼낸다. 기억이 없으면 출발점이 곧 목표라 **저절로** 굴러가지
  // 않는다 — "첫 렌더에는 굴리지 않는다"는 특례 분기가 이 한 줄로 사라진다.
  const [display, setDisplay] = useState(() => lastDisplayedByIdentity.get(identity) ?? target)
  // 화면에 그려진 값. **rAF 콜백과 effect 안에서만** 쓴다(렌더 중 ref 접근 금지).
  const displayRef = useRef(display)
  const frameRef = useRef<number | null>(null)

  // **identity 가 바뀌면 재마운트와 똑같이 다룬다**([[ADR-087]] 정정 1). 총 수익 헤드라인처럼
  // 언마운트 없이 identity 만 바뀌는 자리가 있고(기간 이동), 마운트 때만 기억을 읽으면 그 자리는
  // 옛 정체의 값에서 굴러간다 — 정체가 달라진 것은 값이 변한 것이 아니므로 굴릴 일이 아니다.
  //
  // 렌더 중에 갱신하는 이유는 한 프레임도 옛 정체의 값을 그리지 않기 위해서다(React 의 "prop 이
  // 바뀔 때 state 조정" 패턴 — 같은 컴포넌트에 한해 허용되고, 커밋 없이 곧바로 다시 렌더한다).
  // 복원값이 identity 와 기억만으로 정해지므로 StrictMode 의 이중 호출에도 결과가 같다.
  const [renderedIdentity, setRenderedIdentity] = useState(identity)
  if (renderedIdentity !== identity) {
    setRenderedIdentity(identity)
    setDisplay(lastDisplayedByIdentity.get(identity) ?? target)
  }

  // 위 분기가 건드리지 못한 `displayRef` 를 여기서 맞춘다 — 렌더 중에는 ref 를 만질 수 없고,
  // 그 사이 이 값을 읽는 것은 이 effect 와 rAF 콜백뿐이라 시점이 어긋나지 않는다.
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
      // 마지막 프레임은 보간값이 아니라 목표를 그대로 쓴다 — 반올림 오차로 1메소가 남지 않게.
      const value = progress === 1 ? target : Math.round(from + (target - from) * easeOutExpo(progress))
      displayRef.current = value
      // 굴러가는 도중에 화면을 떠도 그 자리에서 이어붙일 수 있게 매 프레임 기억한다.
      lastDisplayedByIdentity.set(identity, value)
      setDisplay(value)
      if (progress < 1) frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
    // `from` 을 의존성에 넣지 않는다 — 재조준의 출발점은 "지금 그려진 값"이지 렌더 시점의 상태가
    // 아니고, 넣으면 매 프레임 effect 가 다시 돌아 tween 이 스스로를 재시작한다.
  }, [identity, target])

  return display
}
