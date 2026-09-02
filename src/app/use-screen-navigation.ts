/**
 * 화면이 루트 스택을 다루는 통로. 이동과 뒤로가기를 한 훅으로 낸다.
 *
 * 뒤로가기가 `goBack()` 하나로 족한 것은 **딥링크를 두지 않았기 때문**이다. 스택은 언제나 우리가
 * push 한 만큼만 깊고, 하위 페이지가 떠 있다는 것이 곧 그것을 민 화면이 아래에 있다는 뜻이다.
 * 그래서 화면마다 부모 경로 상수를 들 필요가 없다.
 *
 * @see src/navigation/routes.ts 딥링크를 안 두는 이유
 */
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import type { RootStackParamList } from '../navigation/routes'

export type ScreenNavigation = NativeStackNavigationProp<RootStackParamList>

export function useScreenNavigation(): ScreenNavigation {
  return useNavigation<ScreenNavigation>()
}
