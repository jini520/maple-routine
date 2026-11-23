/**
 * 앞서 쓰던 계정의 올리지 못한 기록을 버리고 로그인할지 묻는 모달. 문구는 사용자가 골랐다. 로그인 화면 · 키 입력 시트 · 계정 관리 위에
 * 뜨도록 셸이 내비게이터 밖에 그린다.
 *
 * **주 버튼이 `그만두기` 다.** 버리면 되살릴 수 없어 안전한 쪽을 크게 둔다. `버리고 로그인` 은 그 아래 위험 색 글자 버튼이다.
 */
import { AlertTriangleIcon } from '../../components/atoms'
import { InsetNote } from '../../components/molecules/InsetRow/InsetRow'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import { useUnsyncedPromptStore } from '../../features/auth/unsynced-prompt'

export function UnsyncedRecordsModal(): React.JSX.Element | null {
  const count = useUnsyncedPromptStore((state) => state.count)
  const answer = useUnsyncedPromptStore((state) => state.answer)
  if (count === null) return null

  return (
    <NoticeModal
      icon={AlertTriangleIcon}
      tone="error"
      title="동기화하지 못한 기록이 있습니다"
      content={
        <InsetNote>{`앞서 쓰던 계정의 기록 ${count}건을 아직 서버에 올리지 못했습니다. 버리고 로그인하면 이 기기에서 지워지고 되살릴 수 없습니다.`}</InsetNote>
      }
      action={{ label: '그만두기', onPress: () => answer(false) }}
      secondaryAction={{ label: '버리고 로그인', onPress: () => answer(true), danger: true }}
      onClose={() => answer(false)}
      testId="unsynced-records-overlay"
    />
  )
}
