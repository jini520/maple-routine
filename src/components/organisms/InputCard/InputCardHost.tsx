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
    <InputCardLayer
      {...card}
      onConfirm={(next) => {
        onConfirm(next)
        close()
      }}
      onCancel={close}
    />
  )
}
