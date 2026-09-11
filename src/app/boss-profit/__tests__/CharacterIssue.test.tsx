// 동기화 실패 표식과 그 설명.
//
// 카드 헤더 안의 배지도 터치를
// **가장 깊은 곳이 가져가므로**(responder) 중첩 `Pressable` 이 정상이다. 아래 케이스가 그 사실을
// 계약으로 박는다(부모가 함께 열리면 아코디언이 토글돼 카드가 접힌다).
import { act, fireEvent } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'

import { flattenStyle, renderAtom } from '../../../components/__tests__/render-atom'
import {
  CHARACTER_ISSUE_EXPLANATION,
  CHARACTER_ISSUE_LABEL,
  CharacterIssueBadge,
  CharacterIssuePopover,
  ISSUE_POPOVER_EDGE_GAP,
  ISSUE_POPOVER_GAP,
  ISSUE_POPOVER_TOP,
  ISSUE_POPOVER_WIDTH,
  resolveIssueAnchor,
} from '../CharacterIssue'

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

describe('CharacterIssuePopover', () => {
  it.each(['unavailable', 'failed'] as const)('%s 의 원인과 처방을 말한다', async (issue) => {
    const { getByText } = await renderAtom(
      <CharacterIssuePopover
        issue={issue}
        geometry={{ left: 20, caretLeft: 30, top: 40 }}
        onClose={jest.fn()}
        onOpenCharacterManage={jest.fn()}
      />,
    )

    expect(getByText(CHARACTER_ISSUE_EXPLANATION[issue].title)).toBeTruthy()
    expect(getByText(CHARACTER_ISSUE_EXPLANATION[issue].body)).toBeTruthy()
  })

  it('닫기를 누르면 onClose 를 부른다', async () => {
    const onClose = jest.fn()
    const { getByText } = await renderAtom(
      <CharacterIssuePopover
        issue="failed"
        geometry={{ left: 20, caretLeft: 30, top: 40 }}
        onClose={onClose}
        onOpenCharacterManage={jest.fn()}
      />,
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
      top: ISSUE_POPOVER_TOP,
    })
    expect(resolveIssueAnchor({ left: 0, top: 0, width: 300, height: 60 }, null)).toEqual({
      left: ISSUE_POPOVER_EDGE_GAP,
      caretLeft: ISSUE_POPOVER_WIDTH / 2,
      top: ISSUE_POPOVER_TOP,
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

// 배지가 두 모양이 됐다. 원형은 금액 왼쪽 위에 떠 있고 알약은 금액 칸을 통째로 차지하므로,
// 꼬리가 가리킬 x 가 서로 다르다. 한 값으로 두면 한쪽에서 꼬리가 트리거를 안 가리킨다.
describe('resolveIssueAnchor 의 두 트리거 모양', () => {
  const card = { left: 16, top: 100, width: 358, height: 66 }
  const money = { left: 100, top: 110, width: 120, height: 20 }

  it('알약이면 금액 칸의 가운데를 가리킨다', () => {
    // 카드 기준 금액 왼쪽 84, 폭 120 → 중심 144. 상자는 그보다 24 왼쪽.
    expect(resolveIssueAnchor(card, money, 'amount').left).toBe(144 - 24)
  })

  it('원형이면 지금처럼 금액 왼쪽 위를 가리킨다', () => {
    expect(resolveIssueAnchor(card, money, 'dot').left).toBe(87 - 24)
  })

  it('모양을 안 적으면 원형이다', () => {
    expect(resolveIssueAnchor(card, money).left).toBe(resolveIssueAnchor(card, money, 'dot').left)
  })
})

// 세로 자리를 상수로 두면 트리거 모양이 바뀔 때마다 어긋난다. 잰 상자 아래에 붙인다.
describe('resolveIssueAnchor 의 세로 자리', () => {
  it('금액 칸 바로 아래에 선다', () => {
    const card = { left: 0, top: 100, width: 300, height: 66 }
    const money = { left: 100, top: 118, width: 80, height: 20 }

    // 카드 기준 금액 위 18 + 높이 20 = 38. 거기서 간격만큼 더 내려간다.
    expect(resolveIssueAnchor(card, money, 'amount').top).toBe(38 + ISSUE_POPOVER_GAP)
  })

  it('모르면 기본 자리로 물러난다', () => {
    expect(resolveIssueAnchor(null, null).top).toBe(ISSUE_POPOVER_TOP)
  })
})

// 조회 불가의 처방은 캐릭터 관리에서 해제하거나 바꾸는 것이다. 팝오버가 그 말을 하면서
// 갈 길을 안 주면 사용자가 설정을 직접 찾아 들어가야 한다.
describe('CharacterIssuePopover 의 캐릭터 관리로 이동하기', () => {
  const geometry = { left: 20, caretLeft: 30, top: 40 }

  it('조회 불가면 버튼이 서고 누르면 이동을 부른다', async () => {
    const onOpenCharacterManage = jest.fn()
    const { getByText } = await renderAtom(
      <CharacterIssuePopover
        issue="unavailable"
        geometry={geometry}
        onClose={jest.fn()}
        onOpenCharacterManage={onOpenCharacterManage}
      />,
    )

    await act(async () => {
      fireEvent.press(getByText('캐릭터 관리로 이동하기'))
    })

    expect(onOpenCharacterManage).toHaveBeenCalled()
  })

  // 네트워크 실패의 처방은 새로고침이지 캐릭터 관리가 아니다. 갈 이유가 없는 길을 주지 않는다.
  it('failed 면 버튼이 안 선다', async () => {
    const { queryByText } = await renderAtom(
      <CharacterIssuePopover
        issue="failed"
        geometry={geometry}
        onClose={jest.fn()}
        onOpenCharacterManage={jest.fn()}
      />,
    )

    expect(queryByText('캐릭터 관리로 이동하기')).toBeNull()
  })

  // 강조는 사용자가 다음에 할 일에 준다. 닫기는 물러나는 쪽이라 가져가지 않는다.
  it('닫기는 강조하지 않고 이동하기가 강조를 갖는다', async () => {
    const { getByText } = await renderAtom(
      <CharacterIssuePopover
        issue="unavailable"
        geometry={geometry}
        onClose={jest.fn()}
        onOpenCharacterManage={jest.fn()}
      />,
    )

    // `className` 은 NativeWind 가 컴파일해 없앤다. 그려진 색을 잰다.
    const 닫기색 = flattenStyle(getByText('닫기').props.style).color
    const 이동색 = flattenStyle(getByText('캐릭터 관리로 이동하기').props.style).color

    expect(닫기색).not.toBe(이동색)
    expect(flattenStyle(getByText('캐릭터 관리로 이동하기').props.style).fontWeight).toBe('600')
  })
})
