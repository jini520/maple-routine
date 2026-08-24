// 펼침판 — ＋ 하나가 갈래 둘을 편다([[ADR-170]] 결정 5·6·7).
//
// **움직임은 여기서 안 본다** — 값은 `speed-dial-motion.ts` 가 들고 그쪽 테스트가 붙든다. 여기서
// 보는 것은 «무엇이 눌리고 무엇이 안 눌리는가» 다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../__tests__/render-atom'
import { SpeedDial } from '../SpeedDial'

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function 그리기(overrides: Partial<React.ComponentProps<typeof SpeedDial>> = {}) {
  return renderOverlay(
    <SpeedDial onSelectIncome={jest.fn()} onSelectExpense={jest.fn()} {...overrides} />,
  )
}

async function 누르기(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

describe('접혀 있을 때', () => {
  it('＋ 하나만 누를 수 있다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('기록 추가').props.accessibilityState?.disabled).toBeFalsy()
  })

  // 갈래 둘은 **마운트된 채로** 남는다 — 접히는 움직임을 보여주려면 사라지면 안 된다. 대신
  // 못 누르게 막는다(`aria-hidden` 은 안 쓴다: RNTL 이 노드를 숨김으로 보고 쿼리에서 걷어낸다).
  it('갈래 둘은 서 있지만 눌리지 않는다', async () => {
    const view = await 그리기()

    expect(view.getByLabelText('수입 추가').props.accessibilityState?.disabled).toBe(true)
    expect(view.getByLabelText('지출 추가').props.accessibilityState?.disabled).toBe(true)
  })

  it('닫힌 갈래를 눌러도 아무 일이 없다', async () => {
    const onSelectExpense = jest.fn()
    const view = await 그리기({ onSelectExpense })

    await 누르기(view, '지출 추가')

    expect(onSelectExpense).not.toHaveBeenCalled()
  })

  it('스크림이 터치를 안 먹는다 — 뒤의 캘린더를 그대로 쓸 수 있다', async () => {
    const view = await 그리기()

    expect(view.getByTestId('speed-dial-scrim').props.pointerEvents).toBe('none')
  })
})

describe('펼친 뒤', () => {
  async function 펼치기(overrides: Partial<React.ComponentProps<typeof SpeedDial>> = {}) {
    const view = await 그리기(overrides)
    await 누르기(view, '기록 추가')
    return view
  }

  it('갈래 둘이 눌린다', async () => {
    const view = await 펼치기()

    expect(view.getByLabelText('수입 추가').props.accessibilityState?.disabled).toBe(false)
    expect(view.getByLabelText('지출 추가').props.accessibilityState?.disabled).toBe(false)
  })

  // 이름이 상태를 든다 — 그림은 하나이고 **각도만** 다르므로 스크린리더에는 회전이 안 들린다.
  // 배경은 접근성 트리에 없어서(`accessible={false}`) 「닫기」가 **하나뿐**이다.
  it('＋ 가 닫기가 된다 — 그림은 그대로다', async () => {
    const view = await 펼치기()

    expect(view.getByLabelText('닫기')).toBeTruthy()
    expect(view.queryByLabelText('기록 추가')).toBeNull()
  })

  it('스크림이 터치를 받는다', async () => {
    const view = await 펼치기()

    expect(view.getByTestId('speed-dial-scrim').props.pointerEvents).toBe('auto')
  })

  it('갈래를 고르면 알리고 접는다', async () => {
    const onSelectIncome = jest.fn()
    const view = await 펼치기({ onSelectIncome })

    await 누르기(view, '수입 추가')

    expect(onSelectIncome).toHaveBeenCalledTimes(1)
    // 고른 뒤에는 판이 남아 있을 이유가 없다 — 시트가 그 자리를 받는다.
    expect(view.getByLabelText('기록 추가')).toBeTruthy()
  })

  it('지출도 같다', async () => {
    const onSelectExpense = jest.fn()
    const view = await 펼치기({ onSelectExpense })

    await 누르기(view, '지출 추가')

    expect(onSelectExpense).toHaveBeenCalledTimes(1)
  })

  it('스크림을 누르면 접힌다 — 아무것도 안 고른다', async () => {
    const onSelectIncome = jest.fn()
    const onSelectExpense = jest.fn()
    const view = await 펼치기({ onSelectIncome, onSelectExpense })

    await act(async () => {
      fireEvent.press(view.getByTestId('speed-dial-scrim-button'))
    })

    expect(view.getByLabelText('기록 추가')).toBeTruthy()
    expect(onSelectIncome).not.toHaveBeenCalled()
    expect(onSelectExpense).not.toHaveBeenCalled()
  })

  it('닫기를 누르면 접힌다', async () => {
    const view = await 펼치기()

    await 누르기(view, '닫기')

    expect(view.getByLabelText('기록 추가')).toBeTruthy()
  })
})

// 수입이 위 · 지출이 아래다([[ADR-170]] 결정 7) — 칸의 두 줄과 같은 순서이고, 덕분에 **잦은
// 지출이 FAB 에 더 가깝다**(엄지가 올라오며 먼저 닿는다).
describe('차례', () => {
  it('수입이 지출보다 먼저 그려진다 — 위에 선다', async () => {
    const view = await 그리기()

    const 줄 = view.getAllByTestId(/^speed-dial-row-/).map((node) => node.props.testID)

    expect(줄).toEqual(['speed-dial-row-income', 'speed-dial-row-expense'])
  })
})
