import { useCallback, useContext } from 'react'
import { NavigationContext } from '@react-navigation/native'

/** 전환 이벤트를 내는 화면. 네이티브 스택은 자기 화면이 덮이거나 돌아올 때 `transitionEnd` 를 낸다. */
export interface TransitionSource {
  addListener: (type: 'transitionEnd', callback: () => void) => () => void
  getParent: () => TransitionSource | undefined
}

/**
 * 화면과 그 화면을 담은 스택들의 다음 `transitionEnd` 에 일을 한 번 부르는 함수. 이벤트가 오지 않으면 `fallbackMs` 뒤에
 * 부른다. 화면이 없으면(내비게이터 밖) 바로 부른다.
 */
export function runAfterTransitionEnd(source: TransitionSource | undefined, task: () => void, fallbackMs: number): void {
  if (source === undefined) {
    task()
    return
  }
  let done = false
  const unsubscribes: Array<() => void> = []
  const finish = (): void => {
    if (done) return
    done = true
    clearTimeout(timer)
    unsubscribes.forEach((unsubscribe) => unsubscribe())
    task()
  }
  const timer = setTimeout(finish, fallbackMs)
  for (let each: TransitionSource | undefined = source; each !== undefined; each = each.getParent()) {
    unsubscribes.push(each.addListener('transitionEnd', finish))
  }
}

/**
 * 이 화면을 담은 스택들의 다음 전환이 끝난 뒤 일을 한 번 부르는 함수를 내는 훅. 전환 중에 무거운 일을 시작하면 전환과
 * 그 위에 뜨는 시트가 끊기기 때문이다. 이벤트는 자기 화면이 아니라 담은 스택 화면이 내므로 부모를 거슬러 올라가며 듣는다.
 *
 * 부르는 순간에는 전환이 시작했는지 아직 모르므로 `useScreenSettled` 의 값으로 기다릴 수 없다. 대신 다음 `transitionEnd`
 * 를 기다리고, 전환이 없는 이동에 대비해 시간 제한을 둔다.
 *
 * @example
 * const runAfterTransition = useRunAfterTransition()
 * runAfterTransition(() => selectDate(dateKey), 600)
 */
export function useRunAfterTransition(): (task: () => void, fallbackMs: number) => void {
  const navigation = useContext(NavigationContext)
  return useCallback(
    (task: () => void, fallbackMs: number) =>
      runAfterTransitionEnd(navigation as unknown as TransitionSource | undefined, task, fallbackMs),
    [navigation],
  )
}
