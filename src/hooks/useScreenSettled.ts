import { useContext, useEffect, useState } from 'react'
import { NavigationContext } from '@react-navigation/native'

import { useScreenFocused } from './useScreenFocused'

/** 전환 이벤트를 내는 화면. 네이티브 스택은 자기 화면이 덮이거나 돌아올 때 `transitionStart` · `transitionEnd` 를 낸다. */
interface TransitionSource {
  addListener: (type: 'transitionStart' | 'transitionEnd', callback: () => void) => () => void
  getParent: () => TransitionSource | undefined
}

/**
 * 이 컴포넌트가 선 화면이 보이고 전환이 끝났는지 내는 훅.
 *
 * 초점은 내비게이션 상태가 바뀌는 순간 돌아온다. 그때부터 전환 애니메이션이 끝날 때까지 화면이 움직이므로, 그 위에서
 * 무거운 그림을 돌리면 전환이 끊긴다. 전환 이벤트는 자기 화면이 아니라 그 화면을 담은 스택 화면이 내므로 부모를
 * 거슬러 올라가며 듣는다.
 *
 * @returns 보이고 전환 중이 아니면 `true`. 내비게이터가 없으면 항상 `true`
 */
export function useScreenSettled(): boolean {
  const navigation = useContext(NavigationContext)
  const focused = useScreenFocused()
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    if (navigation === undefined) return

    const sources: TransitionSource[] = []
    for (let source = navigation as unknown as TransitionSource | undefined; source !== undefined; source = source.getParent()) {
      sources.push(source)
    }
    const unsubscribes = sources.flatMap((source) => [
      source.addListener('transitionStart', () => setTransitioning(true)),
      source.addListener('transitionEnd', () => setTransitioning(false)),
    ])

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [navigation])

  return focused && !transitioning
}
