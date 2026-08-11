import { useCallback, useLayoutEffect, useState } from 'react'

/**
 * 요소의 border-box 높이를 **페인트 전에** 실측해 돌려준다 ([[ADR-112]] 결정 2).
 *
 * `fixed` 페이지 헤더가 흐름에서 빠진 자리를 채우는 spacer 높이 전용이다([[ADR-085]] 결정 1 ·
 * [[ADR-098]] 결정 2). 호출부는 공용 셸 `components/templates/PageHeader` 와
 * `app/boss-profit/BossProfitScreen` 둘이고, 그 값은 [[ADR-047]] 중첩 sticky 오프셋으로 다시 쓰인다.
 *
 * **effect 가 둘이고 담당이 갈린다 — 어느 쪽도 상대를 대신하지 못한다.**
 * - 측정 effect(deps 없음): 렌더로 높이가 바뀌는 경우. 헤더 DOM 을 바꾼 **그 커밋에서** spacer 도
 *   함께 갱신되므로 어긋난 프레임이 그려질 자리가 없다.
 * - 관찰 effect(`ResizeObserver`): 커밋 없이 높이가 바뀌는 경우(웹폰트 로드·기기 회전·안전영역).
 */
export function useMeasuredHeight<T extends HTMLElement>(): {
  ref: (node: T | null) => void
  height: number
} {
  // 요소를 `useRef` 가 아니라 **state** 로 잡는다 — `ref.current` 는 반응형이 아니라 관찰 effect 가
  // 요소의 등장·소멸을 따라 재부착되지 못한다. 그래서 조건부로 헤더를 렌더하는 화면(보스 수익의
  // 빈 상태)이 자기 상태를 deps 로 훅에 알려줘야 했다(`[isEmpty]`). 콜백 ref 면 그 deps 가
  // **구조적으로 필요 없어진다**([[ADR-112]] 결정 3).
  const [element, setElement] = useState<T | null>(null)
  const [height, setHeight] = useState(0)

  // 렌더마다 새 함수가 되면 React 가 커밋마다 `ref(null)` → `ref(node)` 로 떼었다 붙여 요소 state 가
  // 흔들리고 관찰 effect 가 매번 재부착된다.
  const ref = useCallback((node: T | null) => {
    setElement(node)
  }, [])

  // 두 effect 가 함께 쓰는 유일한 측정 지점.
  //
  // **`entry.contentRect` 가 아니라 `getBoundingClientRect()` 다** — `ResizeObserver` 의 기본 관찰
  // 박스는 content-box 라 **테두리 변화를 놓친다.** 캐릭터 카드 헤더는 접힘 66px / 펼침 64px 로
  // 테두리 2px 만 다른 실측을 계약으로 갖고 있고, 그 값이 중첩 sticky 오프셋으로 쓰인다([[ADR-047]]).
  const measure = useCallback((node: T) => {
    setHeight(node.getBoundingClientRect().height)
  }, [])

  // 측정 effect — **deps 를 붙이지 않는 것이 이 훅의 요점이다.** 헤더 높이를 바꾸는 상태 전환이
  // 무엇이든(탭 줄·로딩 카드·경고 줄이 붙었다 떨어지는 것) 같은 커밋에 따라온다. deps 를 명시하면
  // 헤더에 조건부 블록이 늘 때마다 같이 고쳐야 하고 빠뜨리면 한 프레임 어긋남이 **조용히**
  // 되살아난다([[ADR-112]], 보스 수익에서 약 90px). 공용 `PageHeader` 는 `children` 이 임의라
  // 그 방식이 원리적으로 불가능하기도 하다.
  //
  // `useLayoutEffect` 안의 `setState` 는 같은 커밋에서 페인트 전에 동기 반영된다 — `useEffect` 로
  // 재면 첫 프레임에 spacer 가 0이라 목록이 위로 튄다([[ADR-085]] 결정 1이 금지한 것).
  // 같은 높이면 `setState` 가 리렌더를 만들지 않으므로(React 의 bailout) 이 effect 가 스스로를
  // 다시 부르지 않는다.
  useLayoutEffect(() => {
    // 요소가 사라져도 마지막 실측값을 남긴다 — 이 훅이 정하는 것은 **측정 시점**이지 값의 수명이
    // 아니다(두 호출부의 기존 동작이 그렇다).
    if (element === null) return
    // `set-state-in-effect` 를 여기서만 끈다 — 이 훅의 존재 이유가 그 "동기 반영"이다. 레이아웃
    // 실측은 외부 시스템(DOM) 읽기라 렌더 중에는 할 수 없고, 페인트 전에 state 로 들어가야 spacer 가
    // 헤더와 같은 프레임에 맞는다([[ADR-112]] 결정 1). 같은 높이면 React 가 bailout 하므로 규칙이
    // 경고하는 연쇄 렌더도 생기지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure(element)
  })

  // 관찰 effect — 렌더 밖 변화 담당. 측정 effect 가 생겼다고 지우면 커밋이 없는 경로를 통째로 놓친다.
  useLayoutEffect(() => {
    if (element === null) return

    const observer = new ResizeObserver(() => {
      measure(element)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [element, measure])

  return { ref, height }
}
