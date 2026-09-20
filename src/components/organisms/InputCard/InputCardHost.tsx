/**
 * 입력 카드가 서는 자리. 앱 셸이 `BottomSheetModalProvider` **뒤에** 하나만 세운다.
 *
 * 뒤에 세우는 것이 핵심이다. 시트는 그 프로바이더가 자기 자식들 뒤에 그리므로, 시트 안에서 그린
 * 것은 무엇으로 감싸도 시트 위로 못 올라간다. 여기는 프로바이더의 형제라 그 전부를 덮는다.
 *
 * 카드는 칸 하나를 받고 닫히므로 이 자리에 사는 것도 하나다.
 */
import { useEffect } from 'react'
import { BackHandler } from 'react-native'

import { useInputCardStore } from '../../../features/input-card/store'
import { InputCardLayer } from './InputCardLayer'

export function InputCardHost(): React.JSX.Element | null {
  const request = useInputCardStore((state) => state.request)
  const seq = useInputCardStore((state) => state.seq)
  const close = useInputCardStore((state) => state.close)

  /**
   * 안드로이드 뒤로가기. 닫기 버튼 · 스크림 탭과 같은 뜻이라 친 값을 버린다.
   *
   * `true` 를 돌려 뒤로가기를 여기서 끊는다. 안 끊으면 카드와 시트가 함께 닫힌다.
   */
  useEffect(() => {
    if (request === null) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close()
      return true
    })
    return () => subscription.remove()
  }, [request, close])

  if (request === null) return null

  const { onConfirm, ...card } = request
  return (
    /*
      `key` 가 부탁마다 카드를 다시 세운다. 카드는 친 값과 스테퍼 수를 자기가 드는데, 그것을
      씨앗에서 심는 일은 처음 설 때만 일어난다. 잇따라 열면 앞 아이템의 값이 그대로 남는다.

      **닫기를 확인보다 먼저** 부른다. 확인 안에서 다음 카드를 여는 흐름(드롭 판매가)이 있어,
      뒤에 닫으면 방금 연 카드를 곧바로 닫는다.
    */
    <InputCardLayer
      key={seq}
      {...card}
      onConfirm={(...given) => {
        // 받은 그대로 넘긴다. 스테퍼를 안 넘긴 카드는 인자 하나로 부르는데, 여기서 둘로 펴면
        // 그 카드의 받는 쪽이 없는 수를 보게 된다.
        close()
        onConfirm(...given)
      }}
      onCancel={close}
    />
  )
}
