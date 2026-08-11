import { useEffect, useState } from 'react'
import { useLocation, type Location } from 'react-router-dom'
import { useScreenStackStore } from '../features/screen-stack/store'
import { resolveSettleMs, resolveStackDirection, resolveTransitionMs } from './stack-transition'

// 나가는 연출을 위해 **라우트를 한 박자 늦춘다**([[ADR-120]] 결정 9-b).
//
// 들어오는 연출은 쉽다 — 오버레이가 마운트되고 나서 스스로 밀려 들어오면 된다. 나가는 연출은
// 라우터가 경로를 바꾸는 순간 오버레이가 언마운트돼 **애니메이션을 걸 요소가 사라진다.**
//
// `←` 와 스와이프만이라면 "연출 먼저, navigate 나중"으로 통제할 수 있다. 그런데 **안드로이드
// 하드웨어 뒤로가기는 우리를 거치지 않는다** — Capacitor 브릿지가 `history.back()` 을 부르고 우리는
// 그 결과만 받는다. 세 경로에 서로 다른 처방을 두면 그중 하나는 반드시 어긋난다.
//
// 그래서 이 훅이 돌려주는 위치로 `<Routes location={...}>` 를 그린다. 경로가 pop 방향으로 바뀌면
// **옛 위치를 붙잡아 둔 채** 오버레이를 화면 밖으로 밀어내고, 끝나면 그때 따라간다. 세 경로가
// 전부 여기 한 곳으로 모인다 — `←` 도 스와이프도 그냥 `navigate(-1)` 을 부르면 된다.
export function useStackLocation(): Location {
  const location = useLocation()
  const [displayLocation, setDisplayLocation] = useState(location)
  /** 나가는 연출이 끝나면 따라갈 곳. `null` 이면 연출 중이 아니다. */
  const [exitingTo, setExitingTo] = useState<Location | null>(null)

  // **렌더 중 조정이다** — effect 안 setState 는 렌더를 한 번 더 유발하고, 그 한 프레임 동안
  // 옛 화면이 그려진다(`usePullToRefresh` 의 `wasRefreshing` 과 같은 리액트 권장 패턴).
  if (location.key !== displayLocation.key && location.key !== exitingTo?.key) {
    const direction = resolveStackDirection(displayLocation.pathname, location.pathname)
    // pop 이 아니거나(탭 이동·자식으로 push) 밀어낼 오버레이가 없으면 즉시 따라간다.
    // push 는 새로 마운트되는 오버레이가 스스로 들어오는 연출을 낸다.
    if (direction !== 'pop' || useScreenStackStore.getState().depth === 0) {
      setDisplayLocation(location)
      setExitingTo(null)
    } else {
      setExitingTo(location)
    }
  }

  useEffect(() => {
    if (exitingTo === null) return

    // 남은 거리에 비례한 시간으로 밀어낸다 — 스와이프로 이미 90% 끌어놓았으면 그만큼 짧다.
    const { progress, setProgress, setDragging, setTransitionMs } = useScreenStackStore.getState()
    const settleMs = resolveSettleMs(progress, true, resolveTransitionMs())
    setDragging(false)
    setTransitionMs(settleMs)
    setProgress(1)

    const timer = window.setTimeout(() => {
      setDisplayLocation(exitingTo)
      setExitingTo(null)
    }, settleMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [exitingTo])

  return displayLocation
}
