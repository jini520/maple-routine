import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { addBackGestureListeners, setBackGestureEnabled } from '../native/back-gesture'
import { useScreenStackStore } from '../features/screen-stack/store'
import { resolveSettleMs, resolveTransitionMs } from './stack-transition'

// 안드로이드 시스템 뒤로가기(제스처 내비 스와이프 / 3버튼 Back)를 앱에 잇는다([[ADR-120]] 결정 17·18).
//
// **설계 원칙: 제스처를 쓰든 3버튼을 쓰든 같은 결과로 수렴해야 하고, 그 경계에서 "이건 웹뷰 앱이구나"
// 가 드러나면 안 된다**(사용자 지정).
//
//   하위 페이지 + 제스처 내비 → 시스템이 인식·진행률, 우리가 그린다
//   하위 페이지 + 3버튼       → 시스템 이벤트, 우리가 그린다(진행률이 없어 시간 기반)
//   탭 최상위                 → 종료 확인 모달 (결정 18, 사용자 지정)
//
// **호출자는 `AppShell` 하나다.** 최상위 화면에서도 받아야 하므로 `StackScreen` 이 소유할 수 없다
// (그 컴포넌트는 하위 페이지가 열려 있을 때만 존재한다).
export interface SystemBackHandlers {
  /** 하위 페이지가 열려 있을 때 — 한 단계 pop. */
  onPop: () => void
  /** 탭 최상위에서 뒤로가기가 왔을 때 — 종료 확인. */
  onRoot: () => void
}

export function useSystemBack({ onPop, onRoot }: SystemBackHandlers): void {
  // **항상 가로챈다**(결정 18). 결정 17 은 최상위를 시스템에 맡겼지만, 종료 확인 모달을 두기로 하면서
  // 그 자리도 우리가 받아야 한다 — 대가는 시스템이 그리던 홈 복귀 애니메이션이다.
  useEffect(() => {
    void setBackGestureEnabled(true)
    return () => {
      void setBackGestureEnabled(false)
    }
  }, [])

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return
    let dispose: (() => void) | undefined
    let cancelled = false

    // 진행률은 **하위 페이지가 열려 있을 때만** 화면에 반영한다 — 최상위에서 온 제스처까지 스택
    // 진행률로 쓰면 밀려날 것이 없는데 탭 화면이 움직인다.
    const isOpen = (): boolean => useScreenStackStore.getState().depth > 0

    void addBackGestureListeners({
      onStarted: () => {
        if (!isOpen()) return
        const store = useScreenStackStore.getState()
        // 손가락이 붙어 있는 동안 전환을 끄는 것은 JS 제스처와 같은 이유다([[ADR-073]] 결정 4).
        store.setDragging(true)
        store.setProgress(0)
      },
      // **진행률을 우리가 재지 않는다** — 시스템이 계산한 값을 그대로 쓴다. 그래서 가장자리 띠를
      // 두고 시스템과 다툴 일이 없다.
      onProgress: (event) => {
        if (!isOpen()) return
        useScreenStackStore.getState().setProgress(event.progress)
      },
      // 3버튼 사용자는 이것만 온다(진행률 없음). 어느 쪽이든 여기서 수렴한다.
      onInvoked: () => {
        if (!isOpen()) {
          onRoot()
          return
        }
        useScreenStackStore.getState().setDragging(false)
        onPop()
      },
      onCancelled: () => {
        if (!isOpen()) return
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
  }, [onPop, onRoot])
}
