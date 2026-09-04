/**
 * 연결 해제 확인. 되돌릴 수 없는 동작이라 확인을 한 번 받는다.
 *
 * **주 버튼이 취소다.** 안전한 기본값은 무르는 쪽이고 채운 알약이 그것을 가리켜야 한다. 해제는
 * 아래 `danger` 버튼으로 내려 위험한 것으로 보이게 한다.
 *
 * 배치는 `organisms/NoticeModal` 이 갖는다. 이 파일이 정하는 것은 아이콘 · 문구 · 배선뿐이다.
 */
import { AlertTriangleIcon } from '../../components/atoms'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'

export interface DisconnectConfirmProps {
  isOpen: boolean
  isDisconnecting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DisconnectConfirm(props: DisconnectConfirmProps): React.JSX.Element | null {
  if (!props.isOpen) return null

  return (
    <NoticeModal
      icon={AlertTriangleIcon}
      tone="error"
      title="연결을 해제할까요?"
      description="API 키와 계정 연결이 해제되고 온보딩 화면으로 돌아갑니다. 보스 수익·드랍 기록은 삭제되지 않습니다."
      action={{ label: '취소', onPress: props.onCancel, disabled: props.isDisconnecting }}
      secondaryAction={{
        label: '연결 해제',
        onPress: props.onConfirm,
        danger: true,
        busy: props.isDisconnecting,
        disabled: props.isDisconnecting,
      }}
      onClose={props.onCancel}
      testId="disconnect-confirm-overlay"
    />
  )
}
