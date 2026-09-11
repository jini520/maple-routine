/**
 * 고른 캐릭터를 조회할 수 없을 때 **내용 자리**에 서는 안내.
 *
 * 토스트가 아닌 이유는 이 실패가 **사건이 아니라 상태**이기 때문이다. 그 캐릭터를 고르고 있는
 * 동안 계속 참이라, 토스트로 말하면 고를 때마다·돌아올 때마다 같은 문구가 다시 뜬다(실제 증상).
 * 그리고 토스트는 스스로 사라지는데 이 자리에 남는 것은 **빈 목록**이라, 사라진 뒤에는 화면이
 * 아무 이유도 말하지 않는다.
 *
 * 처방을 버튼으로 준다. 이 실패는 영구라 새로고침이 답이 아니고, 사용자가 할 수 있는 일은 캐릭터
 * 관리에서 추적을 풀거나 옮겨간 캐릭터로 바꾸는 것뿐이다.
 *
 * @example
 * <CharacterUnavailableNotice onOpenCharacterManage={() => openTab('Settings', { openPicker: true })} />
 */
import { AlertTriangleIcon } from '../../atoms'
import { EmptyState } from '../../molecules/EmptyState/EmptyState'

export interface CharacterUnavailableNoticeProps {
  /** 캐릭터 관리로 보낸다. 화면이 준다(이 부품은 네비게이션을 모른다). */
  onOpenCharacterManage: () => void
}

export function CharacterUnavailableNotice(
  props: CharacterUnavailableNoticeProps,
): React.JSX.Element {
  return (
    <EmptyState
      size="page"
      icon={AlertTriangleIcon}
      title="이 캐릭터는 조회할 수 없습니다"
      // 무엇이 일어났는지와 무엇을 할 수 있는지를 함께 말한다. 원인을 단정하지는 않는다 - 월드를
      // 옮겼는지 삭제됐는지 넥슨 응답만으로는 갈라낼 수 없다.
      description="넥슨 API가 이 캐릭터를 더 이상 조회하지 못합니다. 캐릭터 관리에서 추적을 해제하거나 다른 캐릭터로 바꿔주세요."
      action={{ label: '캐릭터 관리로 이동하기', onClick: props.onOpenCharacterManage }}
    />
  )
}
