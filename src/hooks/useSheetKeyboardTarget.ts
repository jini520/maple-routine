/**
 * 시트 안 입력 칸이 초점을 받을 때 시트에게 **누가 초점을 가졌는지** 알려 준다
 *
 *
 * `@gorhom/bottom-sheet` 는 키보드가 올라오면 시트를 그만큼 밀어올리는데, `animatedKeyboardState`
 * 의 `target` 이 비어 있으면 **키보드 이벤트를 받고도 무시한다**(라이브러리 소스에 그렇게 적혀
 * 있다). 그 값을 채우지 않으면 시트가 키보드에 가린 채로 남는다.
 *
 * 라이브러리의 `BottomSheetTextInput` 이 이 일을 하지만 **쓰면 안 된다.** 그것은 안쪽이
 * `react-native-gesture-handler` 의 입력이라 안드로이드에서 한글 조합이 자모로 흩어진다
 * (정정 10). 그래서 부품 대신 값만 채운다.
 */
import { useEffect, useRef } from 'react'
import type { TextInputProps } from 'react-native'

import { useBottomSheetInternal } from '@gorhom/bottom-sheet'

/**
 * 초점 이벤트의 형태는 RN 의 프롭에서 뽑아 쓴다. 그 타입의 이름과 자리가 RN 판마다 달라서
 * (`TextInputFocusEvent`·`FocusEvent`) 직접 가져오면 판을 올릴 때 조용히 어긋난다.
 *
 * **켤 때와 끌 때의 형이 서로 다르다**. `onBlur` 는 글자를 안 싣는다. 그래서 따로 뽑는다.
 */
type FocusEvent = Parameters<NonNullable<TextInputProps['onFocus']>>[0]
type BlurEvent = Parameters<NonNullable<TextInputProps['onBlur']>>[0]

export interface SheetKeyboardTarget {
  onFocus: (event: FocusEvent) => void
  onBlur: (event: BlurEvent) => void
}

/**
 * 이벤트에서 초점의 정체를 꺼낸다.
 *
 * @param event RN 이 준 이벤트. 테스트가 `fireEvent(칸, 'focus')` 처럼 **이벤트 없이** 부르는
 *   자리가 있어 `undefined` 를 받는다. 거기서 던지면 이 훅을 쓰는 화면 테스트가 통째로 죽는다
 * @returns 그 칸의 네이티브 노드 번호. 이벤트가 없으면 `undefined`
 */
function targetOf(event: FocusEvent | BlurEvent | undefined): number | undefined {
  return event?.nativeEvent?.target
}

/**
 * `TextInput` 에 그대로 펼쳐 넣을 `onFocus`·`onBlur` 한 쌍을 낸다.
 *
 * **새 프롭을 안 만든다.** 둘 다 RN 의 `TextInput` 이 원래 주는 프롭이라, 아톰은 자기가 시트 안에
 * 있는지 모른 채로 있으면 된다.
 *
 * @param onFocus 호출부가 따로 할 일. 시트에 알린 뒤에 부른다
 * @param onBlur 같음
 *
 * @example
 * const sheetKeyboard = useSheetKeyboardTarget(onFocus, onBlur)
 * <TextInput {...rest} {...sheetKeyboard} />
 */
export function useSheetKeyboardTarget(
  onFocus?: (event: FocusEvent) => void,
  onBlur?: (event: BlurEvent) => void,
): SheetKeyboardTarget {
  /** 시트 밖에서는 이 훅이 던지므로 `unsafe`(`true`)로 묻는다. */
  const keyboardState = useBottomSheetInternal(true)?.animatedKeyboardState ?? null
  /** 내가 켰던 초점. 언마운트할 때 남의 것을 끄지 않으려고 기억한다. */
  const myTarget = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (keyboardState === null) return
    return () => {
      if (myTarget.current !== undefined && keyboardState.get().target === myTarget.current) {
        keyboardState.set((state) => ({ ...state, target: undefined }))
      }
    }
  }, [keyboardState])

  return {
    onFocus(event) {
      const target = targetOf(event)
      if (target !== undefined) {
        myTarget.current = target
        keyboardState?.set((state) => ({ ...state, target }))
      }
      onFocus?.(event)
    },

    /**
     * 끄는 조건이 `켜져 있는 것이 나인가` 라, 시트 안 두 칸을 오갈 때 켬과 흐림이 어느 순서로 와도
     * 성립한다.
     */
    onBlur(event) {
      const target = targetOf(event)
      if (keyboardState !== null && target !== undefined && keyboardState.get().target === target) {
        keyboardState.set((state) => ({ ...state, target: undefined }))
      }
      onBlur?.(event)
    },
  }
}
