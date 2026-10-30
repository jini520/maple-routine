// 강화 전 · 강화 후 레벨 격자. 탭이 고르는 쪽을 정하고 칸이 그 값을 바꾼다.
import { fireEvent } from '@testing-library/react-native'

jest.mock('../../../../native/haptics', () => ({ selectionFeedback: jest.fn() }))

import { renderAtom } from '../../../../components/__tests__/render-atom'
import { LevelRangeGrid } from '../LevelRangeGrid'
import { canPick, gridColumns, pickLevel } from '../level-range'

describe('pickLevel: 칸을 누른 뒤', () => {
  it('강화 전을 고르면 탭이 강화 후로 넘어간다', () => {
    expect(pickLevel({ from: 10, to: 15 }, 'from', 12)).toEqual({ range: { from: 12, to: 15 }, editing: 'to' })
  })

  // 거꾸로 된 범위는 저장할 수 없다. 강화 전을 강화 후 위로 올리면 강화 후를 한 칸 위로 민다.
  it('강화 전이 강화 후 이상이 되면 강화 후를 그 한 칸 위로 민다', () => {
    expect(pickLevel({ from: 10, to: 15 }, 'from', 20)).toEqual({ range: { from: 20, to: 21 }, editing: 'to' })
  })

  it('강화 후를 고르면 강화 후만 바뀌고 탭은 그대로다', () => {
    expect(pickLevel({ from: 10, to: 15 }, 'to', 28)).toEqual({ range: { from: 10, to: 28 }, editing: 'to' })
  })

})

describe('canPick: 지금 고를 수 있는 칸', () => {
  // 강화 후를 고르는 중에 시작이 바뀌면 어느 쪽이 바뀌는지 헷갈린다(사용자 지정 2026-10-30).
  it('강화 전은 만렙을 못 고르고, 강화 후는 강화 전보다 높아야 한다', () => {
    expect(canPick({ from: 10, to: 15 }, 'from', 30, 30)).toBe(false)
    expect(canPick({ from: 10, to: 15 }, 'from', 0, 30)).toBe(true)
    expect(canPick({ from: 10, to: 15 }, 'to', 10, 30)).toBe(false)
    expect(canPick({ from: 10, to: 15 }, 'to', 11, 30)).toBe(true)
    expect(canPick({ from: 10, to: 15 }, 'to', 5, 30)).toBe(false)
  })
})

it('칸이 스물을 넘는 헥사는 한 줄 여덟, 심볼은 열이다', () => {
  expect(gridColumns(0, 30)).toBe(8)
  expect(gridColumns(1, 20)).toBe(10)
})

it('탭을 누르면 고르는 쪽이 바뀌고, 막힌 칸은 눌러도 안 바뀐다', async () => {
  const onChange = jest.fn()
  const view = await renderAtom(
    <LevelRangeGrid min={0} max={30} range={{ from: 25, to: 28 }} editing="to" onChange={onChange} testID="grid" />,
  )

  fireEvent.press(view.getByTestId('grid-tab-from'))
  expect(onChange).toHaveBeenLastCalledWith({ range: { from: 25, to: 28 }, editing: 'from' })

  onChange.mockClear()
  fireEvent.press(view.getByTestId('grid-level-20'))
  expect(onChange).not.toHaveBeenCalled()

  fireEvent.press(view.getByTestId('grid-level-29'))
  expect(onChange).toHaveBeenLastCalledWith({ range: { from: 25, to: 29 }, editing: 'to' })
})
