// 키보드가 떠 있는지. 하단바가 이 값으로 자기를 숨기므로, 잘못 참이 되면 키보드가 없는데도 바가 사라진다.

import { act, renderHook } from '@testing-library/react-native'
import { Keyboard, type KeyboardEvent } from 'react-native'

import { useKeyboardShown } from '../useKeyboardShown'

function emit(name: 'keyboardWillShow' | 'keyboardWillHide', heightPx: number): void {
  const emitter = (Keyboard as unknown as { _emitter?: { emit?: unknown } })._emitter
  if (typeof emitter?.emit !== 'function') {
    throw new Error('Keyboard._emitter.emit 이 없습니다. RN 내부 구조가 바뀌었습니다.')
  }
  ;(emitter as { emit(n: string, e: KeyboardEvent): void }).emit(name, {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: { screenX: 0, screenY: 669 - heightPx, width: 951, height: heightPx },
  } as unknown as KeyboardEvent)
}

describe('useKeyboardShown', () => {
  it('높이가 있는 키보드가 뜨면 참, 내려가면 거짓이다', async () => {
    const { result } = await renderHook(() => useKeyboardShown())

    await act(async () => emit('keyboardWillShow', 300))
    expect(result.current).toBe(true)

    await act(async () => emit('keyboardWillHide', 0))
    expect(result.current).toBe(false)
  })

  // 화면을 돌리면 iOS 가 높이 0 인 키보드를 화면 아래 끝에 띄웠다는 show 를 보내고 hide 는 보내지 않는다(아이폰 듀오
  // 안쪽 화면, iOS 27.1 시뮬레이터 실측). 이것을 뜬 것으로 보면 하단바가 숨은 채로 남는다.
  it('높이 0 인 show 는 키보드가 뜬 것이 아니다', async () => {
    const { result } = await renderHook(() => useKeyboardShown())

    await act(async () => emit('keyboardWillShow', 0))
    expect(result.current).toBe(false)
  })
})
