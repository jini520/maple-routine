// 동기화 실패 표식과 그 설명.
//
// 웹은 카드 헤더가 `<button>` 이라 배지를 `<span>` 으로 두고 `stopPropagation` 했지만, RN 은 터치를
// **가장 깊은 곳이 가져가므로**(responder) 중첩 `Pressable` 이 정상이다 — 아래 케이스가 그 사실을
// 계약으로 박는다(부모가 함께 열리면 아코디언이 토글돼 카드가 접힌다).
import { act, fireEvent } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'

import { renderAtom } from '../../../components/__tests__/render-atom'
import {
  CHARACTER_ISSUE_EXPLANATION,
  CHARACTER_ISSUE_LABEL,
  CharacterIssueBadge,
  CharacterIssuePopover,
  ISSUE_POPOVER_EDGE_GAP,
  ISSUE_POPOVER_WIDTH,
  resolveIssueAnchor,
} from '../CharacterIssue'

describe('CharacterIssueBadge', () => {
  it.each(['unavailable', 'failed'] as const)('%s 는 라벨만 갖고 글자는 두지 않는다', async (issue) => {
    const { getByLabelText } = await renderAtom(<CharacterIssueBadge issue={issue} onToggle={jest.fn()} />)

    const badge = getByLabelText(CHARACTER_ISSUE_LABEL[issue])
    expect(badge).toBeTruthy()
    // 라벨 배지는 6자 이름부터 캐릭터명을 잘라먹었다 — 아이콘만 남는다.
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

describe('CharacterIssuePopover', () => {
  it.each(['unavailable', 'failed'] as const)('%s 의 원인과 처방을 말한다', async (issue) => {
    const { getByText } = await renderAtom(
      <CharacterIssuePopover
        issue={issue}
        geometry={{ left: 20, caretLeft: 30 }}
        onClose={jest.fn()}
      />,
    )

    expect(getByText(CHARACTER_ISSUE_EXPLANATION[issue].title)).toBeTruthy()
    expect(getByText(CHARACTER_ISSUE_EXPLANATION[issue].body)).toBeTruthy()
  })

  it('닫기를 누르면 onClose 를 부른다', async () => {
    const onClose = jest.fn()
    const { getByText } = await renderAtom(
      <CharacterIssuePopover issue="failed" geometry={{ left: 20, caretLeft: 30 }} onClose={onClose} />,
    )

    await act(async () => {
      fireEvent.press(getByText('닫기'))
    })

    expect(onClose).toHaveBeenCalled()
  })
})

// 재는 일은 호출부가 하고(RN 의 측정은 비동기다) 이 함수는 **좌표계를 옮기기만** 한다.
describe('resolveIssueAnchor', () => {
  it('둘 중 하나라도 모르면 왼쪽 가장자리로 물러난다', () => {
    expect(resolveIssueAnchor(null, { left: 0, top: 0, width: 10, height: 10 })).toEqual({
      left: ISSUE_POPOVER_EDGE_GAP,
      caretLeft: ISSUE_POPOVER_WIDTH / 2,
    })
    expect(resolveIssueAnchor({ left: 0, top: 0, width: 300, height: 60 }, null)).toEqual({
      left: ISSUE_POPOVER_EDGE_GAP,
      caretLeft: ISSUE_POPOVER_WIDTH / 2,
    })
  })

  it('두 상자를 같은 기준에서 빼 카드 안 좌표로 옮긴다', () => {
    // 카드가 화면 x=16 에서 시작하고 금액이 x=100 에서 시작한다 → 카드 기준 84.
    const card = { left: 16, top: 100, width: 358, height: 66 }
    const money = { left: 100, top: 110, width: 120, height: 20 }

    // 배지 중심 = 84 - 4(밀어 둔 값) + 7(반지름) = 87. 상자는 그보다 24 왼쪽에 선다.
    expect(resolveIssueAnchor(card, money).left).toBe(87 - 24)
  })

  it('트리거가 오른쪽 끝이면 상자를 안으로 당기고 꼬리만 트리거를 가리킨다', () => {
    const card = { left: 0, top: 0, width: 300, height: 66 }
    const money = { left: 280, top: 0, width: 20, height: 20 }
    const geometry = resolveIssueAnchor(card, money)

    // 상자는 여백 안쪽으로 clamp 되고 꼬리는 그만큼 오른쪽으로 간다.
    expect(geometry.left).toBe(300 - ISSUE_POPOVER_WIDTH - ISSUE_POPOVER_EDGE_GAP)
    expect(geometry.caretLeft).toBeGreaterThan(ISSUE_POPOVER_WIDTH / 2)
  })
})
