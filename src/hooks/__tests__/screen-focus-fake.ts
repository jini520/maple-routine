// 화면 초점을 테스트에서 켜고 끄는 가짜 내비게이션. `NavigationContext.Provider` 의 값으로 넣는다.
//
// 테스트 파일이 아니라 보조 파일이다(`jest.config.js` 의 `testMatch` 가 이름으로 거른다).
import { act } from '@testing-library/react-native'

interface 가짜내비 {
  isFocused: () => boolean
  addListener: (type: string, callback: () => void) => () => void
}

/**
 * 초점 이벤트를 손으로 보내는 가짜 내비게이션.
 *
 * @param 초기값 처음 렌더할 때의 초점
 * @example
 * const 가짜 = 초점가짜(true)
 * render(<NavigationContext.Provider value={가짜.navigation as never}>…</NavigationContext.Provider>)
 * await 가짜.보내기('blur')
 */
export function 초점가짜(초기값: boolean): {
  navigation: 가짜내비
  보내기: (type: 'focus' | 'blur') => Promise<void>
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
    },
    보내기: async (type) => {
      focused = type === 'focus'
      await act(async () => {
        listeners.get(type)?.forEach((callback) => callback())
      })
    },
  }
}
