import { useState } from 'react'

import { mesoTextOf } from '../../lib/meso-input/meso-pad'

/**
 * 기본값 1 로 서는 수를 드는 훅. 수량 다섯과 사냥 계산기의 `소재` 가 쓴다.
 *
 * 글자와 함께 **사용자가 손댔는가**를 든다. 안 건드린 1 은 앱이 넣은 값이라 입력 카드가 빈 칸으로
 * 열려야 한다. 카드가 그 1 을 들고 열리면 고치려는 사람이 매번 지우고 다시 쳤다.
 *
 * @param stored 수정으로 열 때 저장돼 있던 값. 있으면 사용자가 적은 값이라 처음부터 안 비운다
 * @example
 * const { text, pristine, set, reset } = useCountField(props.editing?.quantity)
 */
export function useCountField(stored: number | null | undefined): {
  text: string
  pristine: boolean
  set: (next: string) => void
  /** 앱이 1 로 되돌리는 자리(종류 · 항목을 바꿀 때). 다시 안 건드린 기본값이 된다 */
  reset: () => void
} {
  const [text, setText] = useState(mesoTextOf(stored ?? 1))
  const [pristine, setPristine] = useState(stored === null || stored === undefined)
  return {
    text,
    pristine,
    set: (next) => {
      setPristine(false)
      setText(next)
    },
    reset: () => {
      setPristine(true)
      setText(mesoTextOf(1))
    },
  }
}
