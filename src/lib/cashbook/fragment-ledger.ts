/**
 * 솔 에르다 조각 장부의 셈. 장부는 한 캐릭터의 날짜 · 개수 변화 목록이고, 어디서 들어오고 어디로 나갔는지는 모른다.
 * 그래서 들어오는 길(사냥 · 기타)과 나가는 길(정산 · 헥사 · 버리기)이 늘어도 이 셈은 그대로다.
 *
 * 같은 날 안에서 들어오고 나간 차례는 따지지 않는다. 기록이 날짜만 들고 있기 때문이다.
 */

/** 장부의 한 줄. 들어오면 양수, 나가면 음수. */
export interface FragmentMove {
  /** `'YYYY-MM-DD'` */
  date: string
  delta: number
}

/** 이 저장으로 모자라게 된 날과 그 날 모자란 개수. */
export interface FragmentShortDay {
  date: string
  missing: number
}

/** 다른 보관으로 옮길 수 있는 기록 하나. 나간 개수는 양수. */
export interface FragmentTaker {
  id: string
  date: string
  fragments: number
}

/** 기록 하나에서 다른 보관으로 옮긴 개수. */
export interface FragmentTransfer {
  id: string
  fragments: number
}

/** 두 장부에 나오는 날짜를 차례대로. */
function datesOf(...ledgers: readonly (readonly FragmentMove[])[]): string[] {
  return [...new Set(ledgers.flatMap((moves) => moves.map((move) => move.date)))].sort()
}

/** 그 날까지의 남은 개수. */
function balanceOn(moves: readonly FragmentMove[], date: string): number {
  return moves.reduce((sum, move) => (move.date <= date ? sum + move.delta : sum), 0)
}

/**
 * 날짜 D 에 쓸 수 있는 조각. D 와 그 뒤 모든 날의 남은 개수 가운데 가장 작은 값이다. D 에서 이보다 더 쓰면 그 뒤
 * 어느 날의 남은 개수가 0 아래로 내려간다.
 *
 * @example const stored = availableFragmentsOn(moves, dateKey)
 */
export function availableFragmentsOn(moves: readonly FragmentMove[], date: string): number {
  const later = datesOf(moves).filter((each) => each > date)
  return Math.min(balanceOn(moves, date), ...later.map((each) => balanceOn(moves, each)))
}

/**
 * 저장 앞뒤 장부를 견줘 이 저장으로 모자라게 된 날. 남은 개수가 줄어든 날 가운데 0 아래로 내려간 날이다.
 * 이미 0 아래였던 날은 더 깎은 만큼만 모자란 것으로 본다. 없으면 빈 배열이다.
 */
export function fragmentShortfall(before: readonly FragmentMove[], after: readonly FragmentMove[]): FragmentShortDay[] {
  return datesOf(before, after).flatMap((date) => {
    const was = balanceOn(before, date)
    const now = balanceOn(after, date)
    const missing = Math.min(was, 0) - now
    return now < was && missing > 0 ? [{ date, missing }] : []
  })
}

/**
 * 모자라게 된 장부를 되돌리려고 다른 보관으로 옮길 기록과 개수. 모자란 날을 앞에서부터 하나씩 채운다.
 *
 * 옮기는 차례는 이 저장으로 개수가 처음 줄어든 날에 가까운 기록부터다. 그 날부터 모자란 날까지의 기록을 날짜 차례로
 * 쓰고, 그래도 모자라면 그 날 앞의 기록을 가까운 것부터 쓴다. 같은 날의 기록은 `takers` 에 넘긴 차례다.
 *
 * @param input.after `takers` 의 나간 줄이 들어 있는 저장 뒤 장부
 * @param input.take 기록 하나에서 옮기려는 개수를 받아 실제로 옮긴 개수를 돌려준다. 옮길 곳이 모자라면 그보다 적다
 * @returns 옮긴 기록과 개수. 다 옮기고도 장부가 모자랄 수 있고, 그 저장을 막는 것은 부르는 쪽의 검사다
 */
export function planFragmentMoves(input: {
  before: readonly FragmentMove[]
  after: readonly FragmentMove[]
  takers: readonly FragmentTaker[]
  take: (taker: FragmentTaker, wanted: number) => number
}): FragmentTransfer[] {
  const short = fragmentShortfall(input.before, input.after)
  if (short.length === 0) return []
  const dates = datesOf(input.before, input.after)
  const firstLowered = dates.find((date) => balanceOn(input.after, date) < balanceOn(input.before, date))!
  const nearFirst = [
    ...input.takers.filter((taker) => taker.date >= firstLowered).sort((a, b) => a.date.localeCompare(b.date)),
    ...input.takers.filter((taker) => taker.date < firstLowered).sort((a, b) => b.date.localeCompare(a.date)),
  ]
  const moved = new Map<string, number>()
  const raisedOn = (date: string): number =>
    nearFirst.reduce((sum, taker) => (taker.date <= date ? sum + (moved.get(taker.id) ?? 0) : sum), 0)

  for (const { date } of short) {
    let missing = Math.min(balanceOn(input.before, date), 0) - balanceOn(input.after, date) - raisedOn(date)
    for (const taker of nearFirst) {
      if (missing <= 0) break
      if (taker.date > date) continue
      const wanted = Math.min(taker.fragments - (moved.get(taker.id) ?? 0), missing)
      if (wanted <= 0) continue
      const got = input.take(taker, wanted)
      if (got <= 0) continue
      moved.set(taker.id, (moved.get(taker.id) ?? 0) + got)
      missing -= got
    }
  }
  return [...moved].map(([id, fragments]) => ({ id, fragments }))
}
