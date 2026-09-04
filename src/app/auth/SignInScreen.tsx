/**
 * 로그인 화면. API 키를 넣는 자리.
 *
 * 넥슨 프렌즈로 승급되면 이 화면의 폼이 OAuth2 로 갈린다. 화면의 자리는 그대로다.
 *
 * **실패해도 화면이 안 바뀐다.** 검증 실패는 스토어가 토스트로 알리고 폼은 그대로 서 있다.
 * 계정 목록이라는 것이 없으므로 그릴 수 있는 것이 폼 하나이고, 출구 없는 흰 화면을 만들지 않는다.
 * 그래서 상태에 실패 값이 따로 없고 원인만 `error` 로 남는다.
 *
 * 검증(캐릭터 목록 조회)은 보통 1초 미만이라 별도 로딩 문구를 안 띄우고, 입력 폼을 그대로 유지한
 * 채 제출 버튼만 로딩 스피너로 바꾼다.
 *
 * @see docs/features/auth.md 정책
 */
import { View } from 'react-native'

import { useAuthStore } from '../../features/auth/store'

import { EntryScroll } from '../../components/templates/EntryScroll/EntryScroll'
import { ApiKeyForm } from './ApiKeyForm'
import { DevelopmentStageKeyModal } from './DevelopmentStageKeyModal'

export function SignInScreen(): React.JSX.Element {
  const status = useAuthStore((state) => state.status)
  const signIn = useAuthStore((state) => state.signIn)

  // `testID` 는 내비게이션 계약이다. `RootNavigator` 의 분기 테스트가 이 이름으로 "지금 이 화면이
  // 떠 있는가"를 묻는다(`screen-<라우트 이름>` 규약).
  return (
    <View testID="screen-SignIn" className="flex-1">
      <EntryScroll>
        <ApiKeyForm isSubmitting={status === 'verifying'} onSubmit={signIn} />
      </EntryScroll>
      {/* 폼과 직교한다. 스스로 떠 있을 때만 그리므로 이 한 줄로 폼 위에 덮인다. */}
      <DevelopmentStageKeyModal />
    </View>
  )
}
