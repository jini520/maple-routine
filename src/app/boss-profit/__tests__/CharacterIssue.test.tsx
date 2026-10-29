// 동기화 실패 표식과 그 설명.
//
// 카드 헤더 안의 배지도 터치를
// **가장 깊은 곳이 가져가므로**(responder) 중첩 `Pressable` 이 정상이다. 아래 케이스가 그 사실을
// 계약으로 박는다(부모가 함께 열리면 아코디언이 토글돼 카드가 접힌다).
import { act, fireEvent } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'

import { renderAtom, renderOverlay } from '../../../components/__tests__/render-atom'
import { CHARACTER_ISSUE_LABEL, CharacterIssueBadge, CharacterIssuePopover } from '../CharacterIssue'

describe('CharacterIssueBadge', () => {
  it.each(['unavailable', 'failed'] as const)('%s 는 라벨만 갖고 글자는 두지 않는다', async (issue) => {
    const { getByLabelText } = await renderAtom(<CharacterIssueBadge issue={issue} onToggle={jest.fn()} />)

    const badge = getByLabelText(CHARACTER_ISSUE_LABEL[issue])
    expect(badge).toBeTruthy()
    // 라벨 배지는 6자 이름부터 캐릭터명을 잘라먹었다. 아이콘만 남는다.
    expect(badge.props.children).not.toContain(CHARACTER_ISSUE_LABEL[issue])
  })

  it('탭하면 토글만 부르고 부모 아코디언은 열지 않는다', async () => {
    const onToggle = jest.fn()
    const onCardPress = jest.fn()
    const { getByLabelText } = await renderAtom(
      <Pressable role="button" aria-label="카드 헤더" onPress={onCardPress}>
        <Text>지내우시</Text>
        <CharacterIssueBadge issue="failed" onToggle={onToggle} />
      </Pressable>,
    )

    await act(async () => {
      fireEvent.press(getByLabelText(CHARACTER_ISSUE_LABEL.failed))
    })

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onCardPress).not.toHaveBeenCalled()
  })
})

// 재는 일은 호출부가 하고(RN 의 측정은 비동기다) 이 함수는 **좌표계를 옮기기만** 한다.
// 조회 불가의 처방은 캐릭터 관리에서 해제하거나 바꾸는 것이다. 팝오버가 그 말을 하면서
// 갈 길을 안 주면 사용자가 설정을 직접 찾아 들어가야 한다.
describe('CharacterIssuePopover 의 캐릭터 관리로 이동', () => {
  const anchor = { left: 100, top: 100, width: 60, height: 20 }

  it('조회 불가면 버튼이 서고 누르면 이동을 부른다', async () => {
    const onOpenCharacterManage = jest.fn()
    const { getByRole } = await renderOverlay(
      <CharacterIssuePopover
        issue="unavailable"
        anchor={anchor}
        onClose={jest.fn()}
        onOpenCharacterManage={onOpenCharacterManage}
      />,
    )

    await act(async () => {
      fireEvent.press(getByRole('button', { name: '캐릭터 관리로 이동' }))
    })

    expect(onOpenCharacterManage).toHaveBeenCalled()
  })

  // 네트워크 실패의 처방은 새로고침이지 캐릭터 관리가 아니다. 갈 이유가 없는 길을 주지 않는다.
  it('failed 면 버튼이 안 선다', async () => {
    const { queryByRole } = await renderOverlay(
      <CharacterIssuePopover issue="failed" anchor={anchor} onClose={jest.fn()} onOpenCharacterManage={jest.fn()} />,
    )

    expect(queryByRole('button', { name: '캐릭터 관리로 이동' })).toBeNull()
  })

  // 팝오버는 바깥을 눌러 닫는다. 닫기 버튼을 두지 않는다.
  it('닫기 버튼이 없고 바깥을 누르면 닫힌다', async () => {
    const onClose = jest.fn()
    const { queryByText, getByLabelText } = await renderOverlay(
      <CharacterIssuePopover issue="unavailable" anchor={anchor} onClose={onClose} onOpenCharacterManage={jest.fn()} />,
    )

    expect(queryByText('닫기')).toBeNull()
    await act(async () => {
      fireEvent.press(getByLabelText('설명 닫기'))
    })
    expect(onClose).toHaveBeenCalled()
  })
})
