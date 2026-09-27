/**
 * 넥슨 로그아웃 확인.
 *
 * **주 버튼이 로그아웃이다.** 연결 해제 모달과 갈리는 지점이고 근거는 되돌릴 수 있는가 하나다.
 * 그쪽은 되돌릴 수 없어 안전한 기본값(`취소`)을 채운 알약으로 두지만, 로그아웃은 다시
 * 로그인하면 되므로 하려던 일이 주 버튼에 선다.
 *
 * 배치는 `organisms/NoticeModal` 이 갖는다. 이 파일이 정하는 것은 아이콘 · 문구 · 배선뿐이다.
 */
import { CircleUserRoundIcon } from '../../components/atoms'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'

export interface SignOutConfirmProps {
  isOpen: boolean
  isSigningOut: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function SignOutConfirm(props: SignOutConfirmProps): React.JSX.Element | null {
  if (!props.isOpen) return null

  return (
    <NoticeModal
      icon={CircleUserRoundIcon}
      tone="primary"
      title="로그아웃할까요?"
      // 무엇이 남는지 먼저 말한다. 연결 해제와 헷갈리는 자리라 지우는 범위를 분명히 한다.
      description="넥슨 계정 연결만 해제됩니다. 저장된 API 키와 보스 수익·드랍 기록은 그대로 남습니다."
      action={{ label: '로그아웃', onPress: props.onConfirm, busy: props.isSigningOut, disabled: props.isSigningOut }}
      secondaryAction={{ label: '취소', onPress: props.onCancel, disabled: props.isSigningOut }}
      onClose={props.onCancel}
      testId="sign-out-confirm-overlay"
    />
  )
}
