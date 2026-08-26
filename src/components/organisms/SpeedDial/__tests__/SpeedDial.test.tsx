// 펼침판 — ＋ 하나가 갈래 둘을 편다([[ADR-170]] 결정 5·6·7).
//
// **움직임은 여기서 안 본다** — 값은 `speed-dial-motion.ts` 가 들고 그쪽 테스트가 붙든다. 여기서
// 보는 것은 «무엇이 눌리고 무엇이 안 눌리는가» 다.
import { act, fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderOverlay } from '../../../__tests__/render-atom'
import { SpeedDial } from '../SpeedDial'
import {
  FAB_CONTENT_GAP_PX,
  FAB_DIAMETER_PX,
  FAB_LIFT_PX,
  SPEED_DIAL_SPACE_PX,
} from '../speed-dial-metrics'

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

// 치수는 **두 곳이 나눠 쓴다**(`speed-dial-metrics.ts`) — 다이얼이 자기 높이를 정하고, 화면이
// 그만큼을 콘텐츠 끝에 갚는다. 갈리면 화면에서는 «조금 가린다» 로만 보여서 알아채기 어렵다.
describe('치수 ([[ADR-170]] 결정 5 의 딸려 오는 결함)', () => {
  it('FAB 의 실제 높이가 화면이 갚는 값과 같은 상수에서 나온다', async () => {
    const view = await 그리기()

    const fab = flattenStyle(view.getByLabelText('기록 추가').props.style)

    expect(fab.height).toBe(FAB_DIAMETER_PX)
    expect(fab.width).toBe(FAB_DIAMETER_PX)
  })

  it('콘텐츠가 갚을 몫은 뜨는 높이 + 지름 + 숨돌림이다', () => {
    expect(SPEED_DIAL_SPACE_PX).toBe(FAB_LIFT_PX + FAB_DIAMETER_PX + FAB_CONTENT_GAP_PX)
    // 판별력: 셋 중 하나가 0 이면 «가린다» 가 그만큼 되살아난다.
    expect(FAB_LIFT_PX).toBeGreaterThan(0)
    expect(FAB_CONTENT_GAP_PX).toBeGreaterThan(0)
  })
})

/**
 * **접힌 다이얼은 뒤를 안 막는다**(사용자 보고 2026-08-27).
 *
 * 줄 둘은 접혀 있어도 **마운트된 채** `opacity: 0` 일 뿐이라, RN 에서는 그 자리가 그대로 터치를
 * 먹는다 — `disabled` 도 `onPress` 만 막고 히트테스트는 안 막는다. 그래서 떠 있는 ＋ 위쪽
 * 130px 남짓이 통째로 «눌리지 않는 구역» 이 됐다(그 뒤의 목록 줄이 안 눌렸다).
 *
 * 스크림은 이미 같은 처방을 쓰고 있었다(`pointerEvents={isOpen ? 'auto' : 'none'}`) — 줄에만
 * 빠져 있었다.
 */
describe('접혀 있을 때 뒤를 안 막는다', () => {
  it('줄 둘이 터치를 안 받는다', async () => {
    const view = await 그리기()

    for (const row of view.getAllByTestId(/^speed-dial-row-/)) {
      expect(row.props.pointerEvents).toBe('none')
    }
  })

  it('펼치면 다시 받는다', async () => {
    const view = await 그리기()
    await 누르기(view, '기록 추가')

    for (const row of view.getAllByTestId(/^speed-dial-row-/)) {
      expect(row.props.pointerEvents).toBe('auto')
    }
  })

  // 줄 사이의 빈 자리와 오른쪽 여백도 상자다 — 상자가 터치를 먹으면 같은 결함이 남는다.
  it('줄을 담은 상자는 자기 자리를 안 먹는다 — box-none', async () => {
    const view = await 그리기()

    expect(view.getByTestId('speed-dial-actions').props.pointerEvents).toBe('box-none')
  })
})
