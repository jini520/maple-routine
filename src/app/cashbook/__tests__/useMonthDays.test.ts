// 가계부가 그리는 것을 달 단위로 들고 있는 상태. 여기서는 **어느 달을 다시 읽나**를 잰다.
import { nextStaleMonth } from '../useMonthDays'

describe('nextStaleMonth: 다시 읽을 달 하나', () => {
  const 창 = ['2026-08', '2026-07', '2026-06']
  const 표 = (entries: Array<[string, string]>) =>
    new Map(entries.map(([month, stamp]) => [month, { byDate: {}, stamp }]))

  it('빈 표에서는 창의 첫 달이다', () => {
    expect(nextStaleMonth(창, 표([]), '1|1')).toBe('2026-08')
  })

  it('창 순서대로 하나씩 준다', () => {
    expect(nextStaleMonth(창, 표([['2026-08', '1|1']]), '1|1')).toBe('2026-07')
  })

  it('다 채웠으면 `null` 이다', () => {
    const 다참 = 표([
      ['2026-08', '1|1'],
      ['2026-07', '1|1'],
      ['2026-06', '1|1'],
    ])
    expect(nextStaleMonth(창, 다참, '1|1')).toBeNull()
  })

  /**
   * **옛 판에서 읽은 달은 다시 읽는다.** 기록이 바뀌거나 층이 회차를 끝내면 판이 달라진다.
   * 표에서 지우지는 않는다. 지우면 새 값이 올 때까지 격자가 하얘진다.
   */
  it('판이 다른 달은 다시 읽을 대상이다', () => {
    expect(nextStaleMonth(창, 표([['2026-08', '1|1']]), '1|2')).toBe('2026-08')
  })
})
