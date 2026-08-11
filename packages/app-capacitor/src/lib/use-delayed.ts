import { useEffect, useState } from 'react'

// 마운트하고 `delayMs` 가 지나야 참이 된다. **짧은 대기를 아예 그리지 않기 위한 것**이다
// ([[ADR-120]] 결정 13).
//
// 하위 페이지 청크를 미리 받아두면 첫 진입의 서스펜드가 **한 프레임**으로 줄어든다(계측 2026-08-09,
// 프로덕션 빌드: +16ms 에 폴백, +32ms 에 화면). 그런데 그 한 프레임에 불투명 폴백을 칠하면 밀려
// 들어오는 전환 직전에 깜빡임만 남는다 — 로딩을 알리지도 못하면서 눈에만 띈다.
//
// **`React.lazy` 는 모듈이 이미 받아져 있어도 첫 렌더에 한 번은 서스펜드한다**(payload 초기화가 렌더
// 시점에 일어나고, 이미 이행된 프로미스여도 그 자리에서 throw 한다). 그래서 프리페치만으로는 이 한
// 프레임이 남고, 그리지 않는 쪽으로 닫는다.
//
// 진짜로 오래 걸리는 경우(느린 기기·큰 청크)에는 지연 뒤에 폴백이 그대로 뜬다 — 감추는 것이 아니라
// **볼 필요 없는 것만 안 그리는 것**이다.
export function useDelayed(delayMs: number): boolean {
  const [elapsed, setElapsed] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setElapsed(true)
    }, delayMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [delayMs])

  return elapsed
}
