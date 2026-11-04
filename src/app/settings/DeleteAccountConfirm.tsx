/**
 * 계정 삭제 확인. 되돌릴 수 없는 동작이라 확인을 한 번 받는다.
 *
 * **주 버튼이 취소다.** 안전한 기본값은 무르는 쪽이고 채운 알약이 그것을 가리켜야 한다. 삭제는
 * 아래 `danger` 버튼으로 내려 위험한 것으로 보이게 한다.
 *
 * 배치는 `organisms/NoticeModal` 이 갖는다. 이 파일이 정하는 것은 아이콘 · 문구 · 배선뿐이다.
 */
import { AlertTriangleIcon } from '../../components/atoms'
import { InsetNote } from '../../components/molecules/InsetRow/InsetRow'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'

export interface DeleteAccountConfirmProps {
  isOpen: boolean
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteAccountConfirm(props: DeleteAccountConfirmProps): React.JSX.Element | null {
  if (!props.isOpen) return null

  return (
    <NoticeModal
      icon={AlertTriangleIcon}
      tone="error"
      title="계정을 삭제할까요?"
      content={
        <InsetNote>
          30일 뒤 서버의 계정이 지워져요. 그 전에 다시 로그인하면 취소할 수 있어요. 삭제 후 사용 기록은 익명 기록으로
          변경되고, 이 기기의 기록은 삭제되지 않고 보관됩니다.
        </InsetNote>
      }
      action={{ label: '취소', onPress: props.onCancel, disabled: props.isDeleting }}
      secondaryAction={{
        label: '계정 삭제',
        onPress: props.onConfirm,
        danger: true,
        busy: props.isDeleting,
        disabled: props.isDeleting,
      }}
      onClose={props.onCancel}
      testId="delete-account-confirm-overlay"
    />
  )
}
