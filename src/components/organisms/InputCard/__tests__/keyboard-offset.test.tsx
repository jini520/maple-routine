/**
 * 카드가 읽는 키보드 높이의 부호.
 *
 * keyboard-controller 의 `height` 는 `translateY` 에 바로 꽂으라고 만든 음수다. 카드는 높이를 받아
 * 스스로 빼므로, 부호를 안 뒤집으면 카드가 키보드 반대쪽인 화면 밖 아래로 내려간다.
 */
import { renderHook } from '@testing-library/react-native'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'

import { useKeyboardHeight } from '../keyboard-offset'

describe('useKeyboardHeight', () => {
  it('라이브러리의 음수 높이를 양수로 돌려준다', async () => {
    jest.mocked(useReanimatedKeyboardAnimation).mockReturnValueOnce({
      height: { value: -291, get: () => -291 },
      progress: { value: 1, get: () => 1 },
    } as unknown as ReturnType<typeof useReanimatedKeyboardAnimation>)

    const { result } = await renderHook(() => useKeyboardHeight())

    expect(result.current.get()).toBe(291)
  })
})
