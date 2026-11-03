// 화면 초점과 전환을 테스트에서 손으로 보내는 가짜 내비게이션. `NavigationContext.Provider` 의 값으로 넣는다.
//
// 테스트 파일이 아니라 보조 파일이다(`jest.config.js` 의 `testMatch` 가 이름으로 거른다).
import { act } from '@testing-library/react-native'

interface 가짜내비 {
  isFocused: () => boolean
  addListener: (type: string, callback: () => void) => () => void
  getParent: () => 가짜내비 | undefined
}

type 가짜이벤트 = 'focus' | 'blur' | 'transitionStart' | 'transitionEnd'

/**
 * 초점 · 전환 이벤트를 손으로 보내는 가짜 내비게이션.
 *
 * @param 초기값 처음 렌더할 때의 초점
 * @param 부모 이 화면을 담은 스택 화면의 가짜. 전환 이벤트는 부모가 낸다
 * @example
 * const 가짜 = 초점가짜(true)
 * render(<NavigationContext.Provider value={가짜.navigation as never}>…</NavigationContext.Provider>)
 * await 가짜.보내기('blur')
 */
export function 초점가짜(
  초기값: boolean,
  부모?: { navigation: 가짜내비 },
): {
  navigation: 가짜내비
  보내기: (type: 가짜이벤트) => Promise<void>
} {
  let focused = 초기값
  const listeners = new Map<string, Set<() => void>>()

  return {
    navigation: {
      isFocused: () => focused,
      addListener: (type, callback) => {
        const bucket = listeners.get(type) ?? new Set()
        bucket.add(callback)
        listeners.set(type, bucket)
        return () => bucket.delete(callback)
      },
      getParent: () => 부모?.navigation,
    },
    보내기: async (type) => {
      if (type === 'focus' || type === 'blur') focused = type === 'focus'
      await act(async () => {
        listeners.get(type)?.forEach((callback) => callback())
      })
    },
  }
}
