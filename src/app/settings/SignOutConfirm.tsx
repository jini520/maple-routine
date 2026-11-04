/**
 * 로그아웃 확인.
 *
 * **주 버튼이 로그아웃이다.** 계정 삭제 모달과 갈리는 지점이고 근거는 되돌릴 수 있는가 하나다.
 * 그쪽은 되돌릴 수 없어 안전한 기본값(`취소`)을 채운 알약으로 두지만, 로그아웃은 다시
 * 로그인하면 되므로 하려던 일이 주 버튼에 선다.
 *
 * 배치는 `organisms/NoticeModal` 이 갖는다. 이 파일이 정하는 것은 아이콘 · 문구 · 배선뿐이다.
 */
import { CircleUserRoundIcon } from '../../components/atoms'
import { InsetNote } from '../../components/molecules/InsetRow/InsetRow'
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
      // 무엇이 남는지 먼저 말한다. 계정 삭제와 헷갈리는 자리라 지우는 범위를 분명히 한다.
      content={<InsetNote>로그인만 풀려요. 이 기기의 기록과 서버의 기록은 그대로 남아요.</InsetNote>}
      action={{ label: '로그아웃', onPress: props.onConfirm, busy: props.isSigningOut, disabled: props.isSigningOut }}
      secondaryAction={{ label: '취소', onPress: props.onCancel, disabled: props.isSigningOut }}
      onClose={props.onCancel}
      testId="sign-out-confirm-overlay"
    />
  )
}
