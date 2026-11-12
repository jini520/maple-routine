/**
 * 조각 확인 창이 서는 자리. 앱 뿌리가 `BottomSheetModalProvider` 뒤 · `InputCardHost` 앞에 하나만 세운다.
 *
 * 프로바이더 뒤라 시트 위에 그려지고, `InputCardHost` 앞이라 가격 칸이 연 입력 카드가 이 창 위에 선다.
 */
import { useEffect } from 'react'
import { BackHandler } from 'react-native'

import { useFragmentCutsPrompt } from '../../features/cashbook/fragment-cuts'
import { FragmentCutsConfirm } from './FragmentCutsConfirm'

export function FragmentCutsHost(): React.JSX.Element | null {
  const prompt = useFragmentCutsPrompt((state) => state.prompt)

  // 안드로이드 뒤로가기는 `취소` 다. 여기서 끊지 않으면 창 아래의 시트까지 닫힌다.
  useEffect(() => {
    if (prompt === null) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      prompt.answer(null)
      return true
    })
    return () => subscription.remove()
  }, [prompt])

  // 계획이 달라져 창을 다시 띄우면 친 가격을 버린다. 다른 기록의 가격이 남으면 안 된다.
  return prompt === null ? null : <FragmentCutsConfirm key={prompt.preview.key} prompt={prompt} />
}
