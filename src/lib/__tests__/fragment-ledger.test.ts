// 솔 에르다 조각 장부. 쓸 수 있는 개수 · 모자란 날 · 줄일 기록을 날짜와 개수 변화의 목록만으로 센다.
import fc from 'fast-check'

import {
  availableFragmentsOn,
  fragmentShortfall,
  planFragmentCuts,
  type FragmentMove,
  type FragmentTaker,
} from '../cashbook/fragment-ledger'

/** 날짜 `9월 N일`. 무작위 장부가 같은 날을 자주 고르도록 한 달 안에서만 고른다. */
function day(n: number): string {
  return `2026-09-${String(n).padStart(2, '0')}`
}

/** 장부와 줄인 개수를 합친 장부. 줄인 기록은 그만큼 덜 나간다. */
function withCuts(moves: readonly (FragmentMove & { id?: string })[], cuts: readonly { id: string; fragments: number }[]): FragmentMove[] {
  return moves.map((move) => {
    const cut = cuts.find((each) => each.id === move.id)
    return cut === undefined ? move : { ...move, delta: move.delta + cut.fragments }
  })
}

describe('availableFragmentsOn: 날짜 D 에 쓸 수 있는 조각', () => {
  // 이슈 #989 의 예. 11월 12일에 판 조각을 11월 8일에서 다시 쓸 수 있으면 11월 12일 장부가 0 아래로 내려간다.
  it('D 와 그 뒤 모든 날의 남은 개수 가운데 가장 작은 값이다', () => {
    const moves = [
      { date: '2026-11-01', delta: 100 },
      { date: '2026-11-10', delta: 50 },
      { date: '2026-11-12', delta: -120 },
    ]
    expect(availableFragmentsOn(moves, '2026-11-08')).toBe(30)
  })

  it('나중에 모은 조각은 앞 날짜에서 쓸 수 없다', () => {
    expect(availableFragmentsOn([{ date: '2026-11-10', delta: 50 }], '2026-11-08')).toBe(0)
  })

  it('같은 날 들어오고 나간 차례는 따지지 않는다', () => {
    const moves = [
      { date: '2026-11-01', delta: -30 },
      { date: '2026-11-01', delta: 30 },
    ]
    expect(availableFragmentsOn(moves, '2026-11-01')).toBe(0)
  })
})

describe('fragmentShortfall: 이 저장으로 모자라게 된 날', () => {
  it('줄어든 날이 0 아래로 내려가면 모자란 개수와 함께 낸다', () => {
    const before = [
      { date: day(17), delta: 100 },
      { date: day(20), delta: -100 },
    ]
    const after = [{ date: day(20), delta: -100 }]
    expect(fragmentShortfall(before, after)).toEqual([{ date: day(20), missing: 100 }])
  })

  // 이 결정 전에 적힌 기록으로 이미 0 아래인 날은 그대로 둔다. 그 날 때문에 모든 저장을 막으면 기록을 하나도 적을 수 없다.
  it('이미 0 아래인 날은 더 깎은 만큼만 모자란 것으로 보고, 그대로이거나 늘어난 날은 보지 않는다', () => {
    const before = [
      { date: day(1), delta: -10 },
      { date: day(5), delta: 20 },
    ]
    expect(fragmentShortfall(before, [...before, { date: day(9), delta: 5 }])).toEqual([])
    expect(fragmentShortfall(before, [...before, { date: day(3), delta: -4 }])).toEqual([{ date: day(3), missing: 4 }])
    expect(fragmentShortfall(before, [{ date: day(1), delta: -12 }, { date: day(5), delta: 20 }])).toEqual([
      { date: day(1), missing: 2 },
    ])
  })
})

describe('planFragmentCuts: 모자란 장부를 되돌리려고 줄일 기록', () => {
  const takers: FragmentTaker[] = [
    { id: 'settle-18', date: day(18), fragments: 20 },
    { id: 'hexa-19', date: day(19), fragments: 20 },
    { id: 'hexa-20', date: day(20), fragments: 60 },
  ]
  const outflows = takers.map((each) => ({ id: each.id, date: each.date, delta: -each.fragments }))

  // 그 사냥의 조각은 바로 뒤의 기록이 가져갔다고 본다. 같은 개수를 줄여도 앞쪽을 줄여야 그 뒤 날의 남은 개수가 크다.
  it('고친 날짜에 가까운 기록부터 모자란 만큼만 줄인다', () => {
    const before = [{ date: day(1), delta: 30 }, { date: day(17), delta: 100 }, ...outflows]
    const after = [{ date: day(1), delta: 30 }, { date: day(17), delta: 50 }, ...outflows]
    expect(planFragmentCuts({ before, after, takers })).toEqual([{ id: 'settle-18', fragments: 20 }])
  })

  it('사냥을 지우면 그 조각을 가져간 기록을 차례로 다 줄인다', () => {
    const before = [{ date: day(17), delta: 100 }, ...outflows]
    expect(planFragmentCuts({ before, after: outflows, takers })).toEqual([
      { id: 'settle-18', fragments: 20 },
      { id: 'hexa-19', fragments: 20 },
      { id: 'hexa-20', fragments: 60 },
    ])
  })

  it('고친 날짜 앞의 기록은 건드리지 않는다', () => {
    const early = { id: 'settle-10', date: day(10), fragments: 10 }
    const before = [{ date: day(1), delta: 40 }, { date: day(10), delta: -10 }, { date: day(17), delta: 100 }, ...outflows]
    const after = [{ date: day(1), delta: 40 }, { date: day(10), delta: -10 }, { date: day(17), delta: 40 }, ...outflows]
    expect(planFragmentCuts({ before, after, takers: [early, ...takers] })).toEqual([
      { id: 'settle-18', fragments: 20 },
      { id: 'hexa-19', fragments: 10 },
    ])
  })

  // 이미 0 아래인 장부에서만 생긴다. 고친 날짜 뒤에 가져간 기록이 없으면 그 앞의 기록을 가까운 것부터 줄인다.
  it('뒤에 줄일 기록이 없으면 고친 날짜 앞의 기록을 가까운 것부터 줄인다', () => {
    const old: FragmentTaker[] = [
      { id: 'settle-01', date: day(1), fragments: 10 },
      { id: 'settle-03', date: day(3), fragments: 4 },
    ]
    const olds = old.map((each) => ({ date: each.date, delta: -each.fragments }))
    const before = [...olds, { date: day(5), delta: 20 }]
    const after = [...olds, { date: day(5), delta: 5 }]
    expect(planFragmentCuts({ before, after, takers: old })).toEqual([
      { id: 'settle-03', fragments: 4 },
      { id: 'settle-01', fragments: 5 },
    ])
  })
})

/** 날마다 0 이상인 무작위 장부. 나가는 줄은 그때 쓸 수 있는 개수까지만 넣는다. */
const ledgerArb = fc
  .array(
    fc.record({ day: fc.integer({ min: 1, max: 30 }), amount: fc.integer({ min: 1, max: 80 }), out: fc.boolean() }),
    { minLength: 1, maxLength: 25 },
  )
  .map((ops) => {
    const moves: (FragmentMove & { id: string })[] = []
    ops.forEach((op, index) => {
      const date = day(op.day)
      const delta = op.out ? -Math.min(op.amount, availableFragmentsOn(moves, date)) : op.amount
      if (delta !== 0) moves.push({ id: `m${index}`, date, delta })
    })
    return moves
  })

describe('무작위 장부(fast-check)', () => {
  // 폼은 쓸 수 있는 개수까지만 받고 저장은 모자란지 본다. 둘이 다르면 폼이 받은 저장이 실패한다.
  it('쓸 수 있는 개수만큼 가져가면 모자라지 않고, 하나 더 가져가면 모자란다', () => {
    fc.assert(
      fc.property(ledgerArb, fc.integer({ min: 1, max: 30 }), (moves, n) => {
        const date = day(n)
        const available = availableFragmentsOn(moves, date)
        expect(available).toBeGreaterThanOrEqual(0)
        expect(fragmentShortfall(moves, [...moves, { date, delta: -available }])).toEqual([])
        expect(fragmentShortfall(moves, [...moves, { date, delta: -(available + 1) }])).not.toEqual([])
      }),
    )
  })

  it('들어온 줄을 줄이거나 지운 장부를 줄이면 날마다 다시 0 이상이고, 모자란 만큼보다 더 줄이지 않는다', () => {
    fc.assert(
      fc.property(ledgerArb, fc.nat(), fc.nat(), (moves, pick, keep) => {
        const inflows = moves.filter((move) => move.delta > 0)
        fc.pre(inflows.length > 0)
        const edited = inflows[pick % inflows.length]!
        const nextDelta = keep % (edited.delta + 1)
        const after = moves.map((move) => (move === edited ? { ...move, delta: nextDelta } : move))
        const takers = after
          .filter((move) => move.delta < 0)
          .map((move) => ({ id: move.id, date: move.date, fragments: -move.delta }))

        const cuts = planFragmentCuts({ before: moves, after, takers })

        expect(fragmentShortfall(moves, withCuts(after, cuts))).toEqual([])
        const cutDates = cuts.map((cut) => takers.find((taker) => taker.id === cut.id)!.date)
        expect(cutDates.every((date) => date >= edited.date)).toBe(true)
        const worst = Math.max(0, ...fragmentShortfall(moves, after).map((each) => each.missing))
        expect(cuts.reduce((sum, cut) => sum + cut.fragments, 0)).toBe(worst)
      }),
    )
  })
})
