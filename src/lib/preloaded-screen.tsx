import { useEffect, useState } from 'react'

// 하위 페이지를 **서스펜드 없이** 그리기 위한 최소 로더([[ADR-120]] 결정 15).
//
// `React.lazy` 는 모듈이 이미 메모리에 있어도 **첫 렌더에 반드시 한 번 서스펜드한다**(payload 초기화가
// 렌더 시점에 일어나고, 이미 이행된 프로미스여도 그 자리에서 throw 한다). 그리고 React 는 fallback 을
// 커밋하고 나면 실제 콘텐츠 공개를 **약 300ms 미룬다** — fallback 이 번쩍이지 않게 하려는 내장
// 스로틀이고, `fallback={null}` 이어도 적용된다.
//
// 계측(프로덕션 빌드 2026-08-09): 클릭 → 오버레이 마운트가 **콜드 305ms · 웜 5ms**. 그 305ms 동안
// 네트워크 요청도 롱태스크도 없었다 — 아무 일도 안 하고 기다린다. 화면 셋이 크기와 무관하게 똑같이
// ~305ms 였다는 것이 "코드가 무거워서"가 아니라 고정 지연이라는 증거였다. 청크를 부모 탭에 합쳐도
// (결정 14) 서스펜드 자체는 남으므로 이 지연은 사라지지 않았다.
//
// **`startTransition` 으로는 못 피한다** — `<BrowserRouter>` 의 라우팅 상태 갱신은 외부 스토어 구독을
// 통해 오므로 transition 으로 표시되지 않는다(실측으로 확인, 여전히 ~310ms).
//
// 그래서 `lazy` 를 쓰지 않는다. 모듈을 미리 받아 **컴포넌트를 캐시에 담아 두고 첫 렌더에 동기로
// 돌려준다.** 서스펜드가 없으니 fallback 도 스로틀도 없다. 아직 안 받았으면 `null` 을 그리다가
// 도착하면 바꾼다 — 그때도 부모 화면이 그대로 보이므로 빈 화면이 되지 않는다(결정 13).
//
// 탭 화면은 그대로 `lazy` 다 — 그쪽은 진짜로 받을 것이 있고, 받는 동안 알려야 한다.

export type ScreenLoader = () => Promise<React.ComponentType>

const cache = new Map<ScreenLoader, React.ComponentType>()
const inflight = new Map<ScreenLoader, Promise<void>>()

/** 미리 받아 캐시에 담는다. 같은 로더를 여러 번 불러도 요청은 한 번이다. */
export function preloadScreen(load: ScreenLoader): Promise<void> {
  if (cache.has(load)) return Promise.resolve()
  const existing = inflight.get(load)
  if (existing !== undefined) return existing

  const promise = load()
    .then((component) => {
      cache.set(load, component)
    })
    .catch(() => {
      // 못 받아도 던지지 않는다 — 그 화면에 들어갈 때 다시 시도한다.
    })
    .finally(() => {
      inflight.delete(load)
    })
  inflight.set(load, promise)
  return promise
}

/** 캐시에 있으면 **첫 렌더에 동기로** 돌려준다. 없으면 받아오는 동안 `null`. */
export function usePreloadedScreen(load: ScreenLoader): React.ComponentType | null {
  const [screen, setScreen] = useState<React.ComponentType | null>(() => cache.get(load) ?? null)

  useEffect(() => {
    if (screen !== null) return
    let cancelled = false
    void preloadScreen(load).then(() => {
      const loaded = cache.get(load)
      // setState 의 함수 인자는 updater 로 해석되므로 컴포넌트를 한 겹 더 감싼다.
      if (!cancelled && loaded !== undefined) setScreen(() => loaded)
    })
    return () => {
      cancelled = true
    }
  }, [load, screen])

  return screen
}
