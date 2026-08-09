import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { addBackGestureListeners, setBackGestureEnabled } from '../native/back-gesture'
import { useScreenStackStore } from '../features/screen-stack/store'
import { resolveSettleMs, resolveTransitionMs } from './stack-transition'

// 안드로이드 시스템 뒤로가기를 화면 스택에 잇는다([[ADR-120]] 결정 17).
//
// **설계 원칙: 시스템에 최대한 넘기고, 그릴 때만 개입한다.** 사용자가 제스처 내비를 쓰든 3버튼을
// 쓰든 같은 결과로 수렴해야 하고, 그 경계에서 "이건 웹뷰 앱이구나"가 드러나면 안 된다.
//
//   하위 페이지 + 제스처 내비 → 시스템이 인식·진행률, 우리가 그린다
//   하위 페이지 + 3버튼       → 시스템 이벤트, 우리가 그린다(진행률이 없으므로 시간 기반)
//   탭 최상위                 → **가로채지 않는다** — 시스템이 홈으로 돌아가는 자기 애니메이션을 그린다
//
// 마지막 줄이 `@capacitor/app` 을 쓰지 않은 이유다(`native/back-gesture` 주석).
export function useSystemBack(pop: () => void): void {
  const isOpen = useScreenStackStore((state) => state.depth > 0)

  // 스택이 열려 있는 동안에만 가로챈다.
  useEffect(() => {
    void setBackGestureEnabled(isOpen)
    return () => {
      void setBackGestureEnabled(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return
    let dispose: (() => void) | undefined
    let cancelled = false

    void addBackGestureListeners({
      // 시스템이 제스처를 인식했다 — 손가락을 따라 그릴 준비를 한다. 전환을 끄는 것은 JS 제스처와
      // 같은 이유다([[ADR-073]] 결정 4): 손가락이 붙어 있는데 전환이 걸리면 늘 뒤처진 위치를 그린다.
      onStarted: () => {
        const store = useScreenStackStore.getState()
        store.setDragging(true)
        store.setProgress(0)
      },
      // **진행률을 우리가 재지 않는다** — 시스템이 계산한 값을 그대로 쓴다. 그래서 가장자리 띠를
      // 두고 시스템과 다툴 일이 없다.
      onProgress: (event) => {
        useScreenStackStore.getState().setProgress(event.progress)
      },
      // 3버튼 사용자는 이것만 온다(진행률 없음). 어느 쪽이든 여기서 pop 으로 수렴한다 —
      // 나가는 연출은 `useStackLocation` 이 한 곳에서 낸다([[ADR-120]] 결정 9-b).
      onInvoked: () => {
        useScreenStackStore.getState().setDragging(false)
        pop()
      },
      onCancelled: () => {
        const store = useScreenStackStore.getState()
        const progress = store.progress
        store.setDragging(false)
        store.setTransitionMs(resolveSettleMs(progress, false, resolveTransitionMs()))
        store.setProgress(0)
      },
    }).then((remove) => {
      if (cancelled) {
        remove()
        return
      }
      dispose = remove
    })

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [pop])
}
