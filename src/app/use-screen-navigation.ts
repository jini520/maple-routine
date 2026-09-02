// 화면은 루트 스택을 여기로만 다룬다. **웹의 `useNavigate` + `useStackBack` 자리**다.
//
// ══ 웹의 두 조각이 여기서 하나가 된다 ═══════════════════════════════════════════════
//
// 웹은 이동에 `useNavigate()`(경로 문자열), 뒤로가기에 `useStackBack(parentPath)` 를 썼다. 후자가
// **별도 훅이어야 했던 이유는 하나**다. `navigate(-1)` 은 히스토리에 앞 항목이 있을 때만 pop 이고,
// 딥링크로 곧장 들어온 경우에는 갈 곳이 없어 부모 경로로 `replace` 해야 했다.
//
// RN 에는 그 갈래가 **존재하지 않는다.** 딥링크를 두지 않았으므로(`navigation/routes.ts` 파일 머리)
// 스택은 언제나 우리가 push 한 만큼만 깊고, 하위 페이지가 떠 있다는 것이 곧 그것을 민 화면이 아래에
// 있다는 뜻이다. 그래서 `goBack()` 하나로 족하고, **부모 경로 상수(`PARENT_PATH`)도 함께 사라진다** —
// 웹 화면 일곱이 저마다 들고 있던 그 값은 "돌아갈 곳"을 우리가 계산해야 했던 흔적이었다.
//
// ── 훅 하나로 두는 이유 ─────────────────────────────────────────────────────────────
//
// `useNavigation()` 은 제네릭 인자를 주지 않으면 라우트 이름이 `never` 로 좁혀져 `navigate` 가 아무
// 이름도 받지 못한다. 화면마다 그 인자를 적으면 같은 타입 표현이 아홉 벌이 되고, 하나만 다른 목록을
// 적어도 컴파일은 통과한다(각자 자기 목록 안에서는 맞다). 한 자리로 좁혀 두면 라우트 표
// (`navigation/routes.ts`)와 화면 사이에 통로가 하나만 남는다.
//
// **step 3 은 이것을 `settings/use-settings-navigation.ts` 라는 이름으로 만들었다.** 설정 밖에서
// 두 번째 호출부(컨텐츠 스케줄러)가 생기며 이름이 사실과 어긋나 여기로 올렸고, 옛 자리는 별칭만
// 남는다. 그 화면들과 그 테스트가 부르는 이름을 바꾸지 않기 위해서다.
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import type { RootStackParamList } from '../navigation/routes'

export type ScreenNavigation = NativeStackNavigationProp<RootStackParamList>

export function useScreenNavigation(): ScreenNavigation {
  return useNavigation<ScreenNavigation>()
}
