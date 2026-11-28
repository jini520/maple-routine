// 렌즈 그림을 언제 쓰고 언제 다시 뜨는지. 셰이더 출력은 jest 로 볼 수 없어서 기기로 확인하고, 여기서는 그림을 고르는 판정을 본다.
import { beginPress, lensStrength, movePress, slotCenter, type Slots } from '../bar-motion'
import { ROW_RETRY_LIMIT, ROW_RETRY_MS, backdropKey, hasInk, lensBackdropStrip, rowRetryDelay, usableSnapshot } from '../lens-snapshot'

describe('뜬 테마가 지금 테마와 다른 그림은 쓰지 않는다', () => {
  const 렌_다크 = { key: '렌|dark', value: '렌 그림' }

  it('같은 테마에서 뜬 그림은 쓴다', () => {
    expect(usableSnapshot(렌_다크, '렌|dark')).toBe('렌 그림')
  })

  // 테마를 바꾼 직후 새 그림을 뜨는 동안 옛 그림을 쓰면 렌즈 안에 옛 테마 색이 비친다.
  it('테마가 바뀌면 새로 뜰 때까지 그림이 없다', () => {
    expect(usableSnapshot(렌_다크, '레테|light')).toBeNull()
    expect(usableSnapshot(null, '렌|dark')).toBeNull()
  })
})

describe('빈 항목 줄 그림은 다시 뜬다', () => {
  it('픽셀이 모두 투명하면 빈 그림이다', () => {
    expect(hasInk([10, 20, 30, 0, 0, 0, 0, 0])).toBe(false)
    expect(hasInk([0, 0, 0, 0, 255, 255, 255, 12])).toBe(true)
  })

  it(`비었으면 ${ROW_RETRY_MS}ms 뒤에 다시 뜨고, ${ROW_RETRY_LIMIT} 번 다시 떠도 비면 그만둔다`, () => {
    const delays = Array.from({ length: ROW_RETRY_LIMIT + 2 }, (_, attempt) => rowRetryDelay(attempt, false))

    expect(delays).toEqual([500, 500, 500, 500, 500, null, null])
  })

  it('모두 찍혔으면 다시 뜨지 않는다', () => {
    expect(rowRetryDelay(0, true)).toBeNull()
  })
})

// 렌즈 뒤 그림은 화면을 뜨지 않고 테마로 그린다. 뜬 화면은 스크롤하면 낡아서 렌즈에 옛 화면이 비쳤다(#1290).
describe('렌즈 뒤 그림은 바 자리 띠다', () => {
  // 아이폰 17: 창 402 × 874, 바 위 끝 = 874 − 34 − 62, 렌즈 캔버스는 위아래 12 넓다.
  const 가로 = lensBackdropStrip({ vertical: false, windowWidthPx: 402, windowHeightPx: 874, crossStartPx: 874 - 34 - 62 - 12, crossLengthPx: 62 + 24 })

  // 바는 칸 수가 바뀔 때 자리와 폭이 움직이고 렌즈는 바 양 끝 밖으로 부푼다. 띠가 창 폭 전체여야 어디서 눌러도 그림이 있다.
  it('가로 바는 창 폭 전체이고, 세로는 렌즈 캔버스와 같은 줄이다', () => {
    expect(가로).toEqual({ x: 0, y: 874 - 34 - 62 - 12, width: 402, height: 86 })
  })

  it('세로 막대는 창 높이 전체이고, 가로는 렌즈 캔버스와 같은 줄이다', () => {
    const 세로 = lensBackdropStrip({ vertical: true, windowWidthPx: 466, windowHeightPx: 678, crossStartPx: 412 - 12, crossLengthPx: 64 + 24 })

    expect(세로).toEqual({ x: 400, y: 0, width: 88, height: 678 })
  })
})

describe('렌즈 뒤 그림은 테마 · 창 크기 · 바 자리가 바뀔 때만 다시 그린다', () => {
  const 띠 = { x: 0, y: 766, width: 402, height: 86 }
  const 기준 = backdropKey({ themeKey: '렌|dark', strip: 띠 })

  // 페이지가 바뀌거나 스크롤해도 같은 그림이다. 그것들은 열쇠에 들어가지 않는다.
  it('같은 테마 · 같은 띠면 같은 열쇠다', () => {
    expect(backdropKey({ themeKey: '렌|dark', strip: { ...띠 } })).toBe(기준)
  })

  it.each([
    ['테마', { themeKey: '레테|light', strip: 띠 }],
    ['창 폭(회전 · 접기)', { themeKey: '렌|dark', strip: { ...띠, width: 874 } }],
    ['바 자리(3버튼 내비게이션 바)', { themeKey: '렌|dark', strip: { ...띠, y: 745 } }],
  ])('%s 이 바뀌면 열쇠가 바뀐다', (_name, input) => {
    expect(backdropKey(input)).not.toBe(기준)
  })
})

describe('휨 세기는 누르는 동안 최대로 머문다', () => {
  const 행: Slots = { first: 35, spacing: 69, count: 5 }

  // 끈 거리나 속도로 세기를 정하면 끌다 멈출 때 번짐이 가라앉아 렌즈가 출렁여 보였다.
  it('제자리 누름 · 끌기 · 끌다 멈춤에서 모두 1 이다', () => {
    const start = slotCenter(0, 행)
    let press = beginPress(start, 행, [0, 0, 0, 0, 0], 0).press
    const strengths = [lensStrength(press)]
    let pill = start
    for (const pos of [start + 1, start + 20, start + 80, start + 80, start + 80]) {
      const move = movePress(press, pos, pos - start, pill, 행)
      press = move.press
      if (move.pillPos !== null) pill = move.pillPos
      strengths.push(lensStrength(press))
    }

    expect(strengths).toEqual([1, 1, 1, 1, 1, 1])
  })

  it('알약을 움직이지 않는 누름(하위가 있는 그룹)은 렌즈가 없다', () => {
    expect(lensStrength(beginPress(slotCenter(1, 행), 행, [0, 1, 0, 0, 0], 0).press)).toBe(0)
  })
})
