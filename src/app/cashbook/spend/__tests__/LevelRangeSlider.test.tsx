// 심볼 강화의 레벨 칸 슬라이더. 칸 하나가 레벨 하나이고 손잡이 둘이 강화 전 · 강화 후다.
import { act, fireEvent } from '@testing-library/react-native'
import { State } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'

jest.mock('../../../../native/haptics', () => ({ selectionFeedback: jest.fn() }))
const { selectionFeedback } = jest.requireMock('../../../../native/haptics') as { selectionFeedback: jest.Mock }

import { renderAtom } from '../../../../components/__tests__/render-atom'
import { LevelRangeSlider } from '../LevelRangeSlider'
import { cellCenterPercent, dragRange, grabThumb, levelAt, tapRange, type LevelRange } from '../level-range'

beforeEach(() => {
  selectionFeedback.mockReset()
})

describe('levelAt: 가로 위치가 든 칸', () => {
  it('칸이 폭을 똑같이 나눈다. 폭 200 · 레벨 20 이면 한 칸이 10 이다', () => {
    expect(levelAt(0, 200, 20)).toBe(1)
    expect(levelAt(9, 200, 20)).toBe(1)
    expect(levelAt(10, 200, 20)).toBe(2)
    expect(levelAt(199, 200, 20)).toBe(20)
  })

  it('트랙 밖은 끝 칸이다', () => {
    expect(levelAt(-5, 200, 20)).toBe(1)
    expect(levelAt(260, 200, 20)).toBe(20)
  })

  it('칸 가운데에 손잡이가 선다', () => {
    expect(cellCenterPercent(1, 20)).toBe(2.5)
    expect(cellCenterPercent(20, 20)).toBe(97.5)
  })
})

describe('grabThumb: 어느 손잡이를 잡나', () => {
  it('떨어져 있으면 가까운 쪽이다', () => {
    expect(grabThumb({ from: 3, to: 7 }, 4, 1)).toBe('from')
    expect(grabThumb({ from: 3, to: 7 }, 6, -1)).toBe('to')
  })

  it('겹쳤거나 한가운데면 끄는 방향이 고른다. 오른쪽이면 강화 후, 왼쪽이면 강화 전', () => {
    expect(grabThumb({ from: 5, to: 5 }, 5, 8)).toBe('to')
    expect(grabThumb({ from: 5, to: 5 }, 5, -8)).toBe('from')
    expect(grabThumb({ from: 3, to: 7 }, 5, -8)).toBe('from')
  })
})

describe('dragRange · tapRange: 옮긴 범위', () => {
  it('끄는 손잡이는 다른 손잡이를 못 넘는다', () => {
    expect(dragRange({ from: 3, to: 7 }, 'from', 9)).toEqual({ from: 7, to: 7 })
    expect(dragRange({ from: 3, to: 7 }, 'to', 1)).toEqual({ from: 3, to: 3 })
  })

  it('칸을 누르면 가까운 손잡이가 온다. 바깥 칸이면 그쪽 손잡이다', () => {
    expect(tapRange({ from: 3, to: 7 }, 2)).toEqual({ from: 2, to: 7 })
    expect(tapRange({ from: 3, to: 7 }, 9)).toEqual({ from: 3, to: 9 })
    expect(tapRange({ from: 3, to: 7 }, 4)).toEqual({ from: 4, to: 7 })
    expect(tapRange({ from: 3, to: 7 }, 6)).toEqual({ from: 3, to: 6 })
    // 한가운데는 강화 후다.
    expect(tapRange({ from: 3, to: 7 }, 5)).toEqual({ from: 3, to: 5 })
  })
})

type Rendered = Awaited<ReturnType<typeof renderAtom>>

async function 그리기(range: LevelRange, options: { max?: number; disabled?: boolean } = {}) {
  const onChange = jest.fn()
  const view = await renderAtom(
    <LevelRangeSlider
      max={options.max ?? 20}
      from={range.from}
      to={range.to}
      disabled={options.disabled}
      onChange={onChange}
    />,
  )
  return { view, onChange }
}

async function 누르기(view: Rendered, label: string) {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

async function 조절(view: Rendered, label: string, actionName: 'increment' | 'decrement') {
  await act(async () => {
    fireEvent(view.getByLabelText(label), 'accessibilityAction', { nativeEvent: { actionName } })
  })
}

describe('LevelRangeSlider: 그리기', () => {
  it('레벨마다 칸이 하나다. 어센틱은 열하나다', async () => {
    const 아케인 = await 그리기({ from: 7, to: 12 })
    expect(아케인.view.getAllByLabelText(/^Lv\.\d+$/)).toHaveLength(20)

    const 어센틱 = await 그리기({ from: 5, to: 8 }, { max: 11 })
    expect(어센틱.view.getAllByLabelText(/^Lv\.\d+$/)).toHaveLength(11)
  })

  it('손잡이 둘이 저마다 레벨을 적고 낭독기에 알린다', async () => {
    const { view } = await 그리기({ from: 7, to: 12 })

    expect(view.getByLabelText('강화 전 레벨')).toHaveTextContent('7')
    expect(view.getByLabelText('강화 전 레벨')).toHaveAccessibilityValue({ min: 1, max: 20, now: 7 })
    expect(view.getByLabelText('강화 후 레벨')).toHaveTextContent('12')
  })

  it('잠기면 손잡이가 없고 칸을 눌러도 안 옮긴다', async () => {
    const { view, onChange } = await 그리기({ from: 1, to: 1 }, { disabled: true })

    expect(view.queryByLabelText('강화 전 레벨')).toBeNull()
    await 누르기(view, 'Lv.5')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('LevelRangeSlider: 옮기기와 햅틱', () => {
  it('칸을 누르면 가까운 손잡이가 오고 햅틱이 한 번 난다', async () => {
    const { view, onChange } = await 그리기({ from: 7, to: 12 })

    await 누르기(view, 'Lv.14')

    expect(onChange).toHaveBeenLastCalledWith({ from: 7, to: 14 })
    expect(selectionFeedback).toHaveBeenCalledTimes(1)
  })

  it('안 바뀌는 누름에는 햅틱도 없다', async () => {
    const { view, onChange } = await 그리기({ from: 7, to: 12 })

    await 누르기(view, 'Lv.7')

    expect(onChange).not.toHaveBeenCalled()
    expect(selectionFeedback).not.toHaveBeenCalled()
  })

  it('낭독기로 한 레벨씩 옮긴다. 옮길 때마다 햅틱이다', async () => {
    const { view, onChange } = await 그리기({ from: 7, to: 12 })

    await 조절(view, '강화 후 레벨', 'increment')
    await 조절(view, '강화 전 레벨', 'decrement')

    expect(onChange.mock.calls).toEqual([[{ from: 7, to: 13 }], [{ from: 6, to: 12 }]])
    expect(selectionFeedback).toHaveBeenCalledTimes(2)
  })

  it('끝에서는 더 못 가고 햅틱도 없다', async () => {
    const { view, onChange } = await 그리기({ from: 1, to: 20 })

    await 조절(view, '강화 전 레벨', 'decrement')
    await 조절(view, '강화 후 레벨', 'increment')

    expect(onChange).not.toHaveBeenCalled()
    expect(selectionFeedback).not.toHaveBeenCalled()
  })

  it('강화 전 손잡이를 잡아 끌면 그 칸으로 온다', async () => {
    const { view, onChange } = await 그리기({ from: 7, to: 12 })
    await act(async () => {
      fireEvent(view.getByTestId('level-range-track'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 48 } },
      })
    })

    // 폭 200 · 레벨 20 이면 한 칸이 10 이다. 65 는 Lv.7, 25 는 Lv.3 이다.
    await act(async () => {
      fireGestureHandler(getByGestureTestId('level-range-pan'), [
        { state: State.BEGAN, x: 65, translationX: 0 },
        { state: State.ACTIVE, x: 25, translationX: -40 },
        { state: State.END, x: 25, translationX: -40 },
      ])
    })

    expect(onChange).toHaveBeenLastCalledWith({ from: 3, to: 12 })
    expect(selectionFeedback).toHaveBeenCalled()
  })
})
