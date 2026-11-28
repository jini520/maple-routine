// 렌즈 그림을 언제 쓰고 언제 다시 뜨는지. 셰이더 출력은 jest 로 볼 수 없어서 기기로 확인하고, 여기서는 그림을 고르는 판정을 본다.
import { beginPress, lensStrength, movePress, slotCenter, type Slots } from '../bar-motion'
import { ROW_RETRY_LIMIT, ROW_RETRY_MS, canCapturePage, hasInk, rowRetryDelay, usableSnapshot } from '../lens-snapshot'

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

describe('뒤 화면은 보이는 동안에만 뜬다', () => {
  // 위 화면(설정 등)에 가려진 뷰를 뜨면 앱이 죽는다(2026-11-28 실기기).
  it('위 화면에 가려졌으면 뜨지 않는다', () => {
    expect(canCapturePage({ covered: true, busy: false })).toBe(false)
  })

  it('뜨는 중이면 겹쳐 뜨지 않는다', () => {
    expect(canCapturePage({ covered: false, busy: true })).toBe(false)
    expect(canCapturePage({ covered: false, busy: false })).toBe(true)
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
