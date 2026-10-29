// 이 화면이 지키는 것을 적는다.
//
// 갈린 것 셋
// ① `getByRole('checkbox', { name })` → **`aria-label` 로 잡는다.** 그 프롭이 RN 에서
//    `accessibilityLabel` 이 되므로 `getByLabelText` 가 그대로 그 행을 준다.
//    글자에서 계산되던 것을 여기서는 컴포넌트가 명시로 준다(`CacheClearConfirm.tsx` ②).
// ② `toBeDisabled` → `accessibilityState.disabled`.
// ③ **누른 뒤 화면을 보려면 `act` 로 한 번 흘려보내야 한다**.
//    RNTL 14 에서 `fireEvent` 는 갱신을 **예약만** 하고, 그 프레임의 렌더는 그 뒤에 온다. 그래서
//    `fireEvent` 직후의 질의는 **누르기 전 화면**을 본다(단언이 옛 값을 보고도 초록이 될 수 있다).
//    `onPress` 가 밖으로 나가는 콜백을 부르는 경우(`SettingsRow`·`DisconnectConfirm`)에는 안 걸린다.
//    그 콜백은 렌더와 무관하게 즉시 불리기 때문이다. **다시 그려진 화면을 볼 때만** 이 헬퍼를 쓴다.
//
// **`role="checkbox"` 와 `aria-checked` 는 갈리지 않는다**. 진짜 다중 선택이라 RN 접근성에도
// 같은 역할·상태가 있다(선택 카드들이 `aria-selected` 로 갈아탄 것과 다른 자리다).
import { useState } from 'react'
import { act, fireEvent } from '@testing-library/react-native'
import { Text as RNText } from 'react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { CacheClearConfirm } from '../CacheClearConfirm'

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

const COUNTS = { manualCharacters: 10, bossClears: 1154, bossDrops: 87, cashbookEntries: 154, enhancementDays: 244 }
const NONE = { manual: false, boss: false, cashbook: false, enhancement: false }

/** 누르고 다시 그려질 때까지 기다리는 도우미. */
async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function buttonOf(view: Rendered, label: string): AtomElement {
  let node: AtomElement | null = view.getByText(label)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`버튼을 찾지 못했다: ${label}`)
  return node
}

function props(overrides: Partial<React.ComponentProps<typeof CacheClearConfirm>> = {}) {
  return {
    isOpen: true,
    isClearing: false,
    counts: COUNTS,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  }
}

const LABELS = ['수동 선택 항목', '보스 처치·드롭 아이템 기록', '가계부', '강화']

describe('CacheClearConfirm', () => {
  // 지우는 것이 되살릴 수 없거나 다시 받는 데 호출이 몰리는 기록이라, 열고 바로 누른 한 번에 무엇도 지워지면 안 된다.
  it('처음에는 모든 칸이 해제되어 있고 삭제를 누를 수 없다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props()} />)

    for (const label of LABELS) expect(view.getByLabelText(label).props.accessibilityState?.checked).toBe(false)
    expect(buttonOf(view, '삭제').props.accessibilityState?.disabled).toBe(true)
  })

  it('고른 그룹만 넘긴다', async () => {
    const onConfirm = jest.fn()
    const view = await renderOverlay(<CacheClearConfirm {...props({ onConfirm })} />)

    await press(view.getByLabelText('가계부'))
    await press(view.getByLabelText('강화'))
    await press(buttonOf(view, '삭제'))

    expect(onConfirm).toHaveBeenCalledWith({ ...NONE, cashbook: true, enhancement: true })
  })

  it('고른 칸을 다시 누르면 풀리고, 다 풀면 삭제가 다시 꺼진다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props()} />)

    await press(view.getByLabelText('가계부'))
    expect(buttonOf(view, '삭제').props.accessibilityState?.disabled).toBe(false)
    await press(view.getByLabelText('가계부'))

    expect(buttonOf(view, '삭제').props.accessibilityState?.disabled).toBe(true)
  })

  // 지난번 선택이 남으면 열고 바로 누른 한 번에 그 그룹이 지워진다.
  it('닫았다 다시 열면 모두 해제된 상태로 돌아온다', async () => {
    function Harness(): React.JSX.Element {
      const [isOpen, setIsOpen] = useState(true)
      return (
        <>
          <CacheClearConfirm {...props({ isOpen })} />
          <RNText onPress={() => setIsOpen((open) => !open)}>토글</RNText>
        </>
      )
    }
    const view = await renderOverlay(<Harness />)

    await press(view.getByLabelText('보스 처치·드롭 아이템 기록'))
    await press(view.getByText('토글'))
    await press(view.getByText('토글'))

    expect(view.getByLabelText('보스 처치·드롭 아이템 기록').props.accessibilityState?.checked).toBe(false)
  })

  // 보스 칸은 건수를 설명 줄에 쓰므로 오른쪽에 다시 적지 않는다.
  it('보스 칸은 처치 · 드롭 건수를 설명 줄에만 적는다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props()} />)

    expect(view.getByText('보스 처치 1,154건·드롭 아이템 87건 포함')).toBeTruthy()
    expect(view.queryByText('1,154건')).toBeNull()
  })

  it('지우는 동안 칸과 두 버튼이 모두 꺼진다', async () => {
    const view = await renderOverlay(<CacheClearConfirm {...props({ isClearing: true })} />)

    expect(buttonOf(view, '취소').props.accessibilityState?.disabled).toBe(true)
    expect(view.getByLabelText('가계부').props.accessibilityState?.disabled).toBe(true)
    expect(buttonOf(view, '삭제').props.accessibilityState).toMatchObject({ disabled: true, busy: true })
  })

  it('취소 버튼을 누르면 onCancel이 호출된다', async () => {
    const onCancel = jest.fn()
    const view = await renderOverlay(<CacheClearConfirm {...props({ onCancel })} />)

    await press(buttonOf(view, '취소'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
