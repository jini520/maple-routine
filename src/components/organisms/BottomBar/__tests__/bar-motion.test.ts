// 누르기 · 끌기 · 놓기의 판정. 제스처는 jest 에서 실제 손가락으로 움직일 수 없어서, 제스처 워크릿이 부르는 순수 함수를
// 손가락 경로대로 차례로 불러 본다.
import {
  DRAG_THRESHOLD,
  beginPress,
  deferNavigation,
  endPress,
  movePress,
  slotCenter,
  type PressState,
  type Slots,
} from '../bar-motion'

/** 그룹 행 다섯 칸. 둘째(스케줄러) · 셋째(수입·지출)가 하위 행을 연다. */
const 그룹행: Slots = { first: 35, spacing: 69, count: 5 }
const 하위를여는칸 = [0, 1, 1, 0, 0]
const 지금칸 = 0

/** 손가락 경로를 따라 함수를 부르고, 마지막 알약 자리와 놓은 결과를 낸다. */
function 따라가기(start: number, path: number[]) {
  const begin = beginPress(start, 그룹행, 하위를여는칸, 지금칸)
  let press: PressState = begin.press
  let pill = begin.pillTarget ?? slotCenter(지금칸, 그룹행)
  const pills: (number | null)[] = []
  for (const pos of path) {
    const move = movePress(press, pos, pos - start, pill, 그룹행)
    press = move.press
    if (move.pillPos !== null) pill = move.pillPos
    pills.push(move.pillPos)
  }
  return { begin, press, pill, pills, end: endPress(press, pill, 그룹행) }
}

describe('누르는 순간 알약이 누른 칸으로 바로 간다', () => {
  // 시스템 탭 바는 손을 떼기 전에 알약이 출발한다. 떼기를 기다리면 누름이 굼떠 보인다.
  it('같은 행 안의 다른 칸을 누르면 그 칸으로 출발하고, 놓으면 그 칸으로 이동한다', () => {
    const { begin, end } = 따라가기(slotCenter(3, 그룹행), [])

    expect(begin.pillTarget).toBe(slotCenter(3, 그룹행))
    expect(begin.travel).toBe(true)
    expect(end).toEqual({ commitIndex: 3, pillTarget: slotCenter(3, 그룹행) })
  })

  // 하위가 있는 그룹 칸은 곧 사라질 칸이다. 알약이 그리로 갔다가 행이 바뀌면 불필요한 움직임이 보인다.
  it('하위가 있는 그룹을 누르면 알약이 움직이지 않고 렌즈도 띄우지 않으며, 놓을 때 그 칸을 고른다', () => {
    const { begin, end } = 따라가기(slotCenter(1, 그룹행), [])

    expect(begin.pillTarget).toBeNull()
    expect(begin.lens).toBe(false)
    expect(end).toEqual({ commitIndex: 1, pillTarget: null })
  })
})

describe('3 을 넘게 움직여야 끌기다', () => {
  it(`${DRAG_THRESHOLD} 이하로 떨리면 누름이라 알약 자리를 건드리지 않고 누른 칸을 고른다`, () => {
    const start = slotCenter(3, 그룹행) + 30
    const { pills, end, press } = 따라가기(start, [start + 2, start - 3, start + 3])

    expect(press.dragging).toBe(false)
    expect(pills).toEqual([null, null, null])
    expect(end.commitIndex).toBe(3)
  })

  // 끌기는 처음 잡은 자리 기준이다. 손가락 자리로 알약 가운데를 옮기면 끌기를 시작하는 순간 알약이 튄다.
  it('끌기가 시작되면 알약은 손가락이 움직인 만큼만 따라간다', () => {
    const start = slotCenter(0, 그룹행) + 20
    const { pills } = 따라가기(start, [start + 4, start + 50])

    // 끌기가 시작되는 순간 알약은 제자리이고, 그 뒤 손가락이 간 46 만큼 간다. 손가락과의 거리를 지킨다.
    expect(pills[0]).toBe(slotCenter(0, 그룹행))
    expect(pills[1]).toBe(slotCenter(0, 그룹행) + 46)
  })

  it('끌어도 알약은 첫 칸과 끝 칸 가운데 밖으로 나가지 않는다', () => {
    const start = slotCenter(4, 그룹행)
    const { pill } = 따라가기(start, [start + 10, start + 200])

    expect(pill).toBe(slotCenter(4, 그룹행))
  })

  it('놓으면 알약이 있는 자리에서 가장 가까운 칸으로 간다', () => {
    const start = slotCenter(0, 그룹행)
    const { end } = 따라가기(start, [start + 10, slotCenter(3, 그룹행) + 30])

    expect(end).toEqual({ commitIndex: 3, pillTarget: slotCenter(3, 그룹행) })
  })
})

describe('하위가 있는 그룹에서 시작한 끌기', () => {
  it('끌기가 시작되면 알약을 들어 렌즈를 띄운다', () => {
    const start = slotCenter(1, 그룹행)
    const move = movePress(beginPress(start, 그룹행, 하위를여는칸, 지금칸).press, start + 5, 5, slotCenter(0, 그룹행), 그룹행)

    expect(move.startedDrag).toBe(true)
    expect(move.startedLens).toBe(true)
    expect(move.press.quiet).toBe(false)
  })

  // 놓은 칸이 다른 칸이면 그 칸으로 가는 이동이다. 그 그룹으로 돌아와 놓았을 때만 행이 바뀐다.
  it('다른 칸에 놓으면 그 칸을 고른다', () => {
    const start = slotCenter(1, 그룹행)
    // 알약은 지금 칸(0)에서 출발해 끌기를 시작한 자리부터 손가락이 움직인 만큼 간다.
    const { end } = 따라가기(start, [start + 10, start + 10 + 69 * 4])

    expect(end.commitIndex).toBe(4)
  })

  it('그 그룹 칸에 다시 놓으면 그 그룹을 고른다', () => {
    const start = slotCenter(1, 그룹행)
    const { end } = 따라가기(start, [start + 10, start + 10 + 69])

    expect(end.commitIndex).toBe(1)
  })
})

describe('화면 이동은 행이 바뀐 다음 프레임에 간다', () => {
  // 같은 프레임에 새 화면을 마운트하면 행 전환의 첫 프레임이 화면 그리기를 기다린다.
  it('부른 자리에서는 이동하지 않고 다음 프레임에 한다', () => {
    jest.useFakeTimers()
    const navigate = jest.fn()

    deferNavigation(navigate)
    expect(navigate).not.toHaveBeenCalled()

    jest.advanceTimersByTime(16)
    expect(navigate).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })
})
