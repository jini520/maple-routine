/** 레벨 칸 슬라이더(`LevelRangeSlider`)의 계산. 가로 위치를 칸으로 옮기고 잡을 손잡이를 고른다. */

export interface LevelRange {
  from: number
  to: number
}

export type Thumb = 'from' | 'to'

/** 가로 위치가 든 칸의 레벨. 칸이 폭을 똑같이 나눈다. 트랙 밖은 끝 칸이다. */
export function levelAt(x: number, width: number, max: number): number {
  if (width <= 0) return 1
  return Math.min(Math.max(Math.floor((x / width) * max) + 1, 1), max)
}

/** 칸 가운데의 가로 자리(%). 손잡이가 이 자리에 선다. */
export function cellCenterPercent(level: number, max: number): number {
  return ((level - 0.5) / max) * 100
}

/**
 * 끌기를 시작한 자리에서 잡을 손잡이. 가까운 쪽이고, 같으면(겹쳤거나 한가운데) 끄는 방향이
 * 고른다. 겹친 채 왼쪽 손잡이를 오른쪽으로 끌면 둘이 못 벌어지기 때문이다.
 */
export function grabThumb(range: LevelRange, level: number, dx: number): Thumb {
  const toFrom = Math.abs(level - range.from)
  const toTo = Math.abs(level - range.to)
  if (toFrom !== toTo) return toFrom < toTo ? 'from' : 'to'
  return dx >= 0 ? 'to' : 'from'
}

/** 잡은 손잡이를 옮긴 범위. 다른 손잡이를 넘으면 그 자리에서 멈춘다. */
export function dragRange(range: LevelRange, thumb: Thumb, level: number): LevelRange {
  return thumb === 'from'
    ? { from: Math.min(level, range.to), to: range.to }
    : { from: range.from, to: Math.max(level, range.from) }
}

/** 칸을 눌렀을 때의 범위. 가까운 손잡이가 그 칸으로 온다. 한가운데면 강화 후다. */
export function tapRange(range: LevelRange, level: number): LevelRange {
  if (level <= range.from) return { from: level, to: range.to }
  if (level >= range.to) return { from: range.from, to: level }
  return level - range.from < range.to - level ? { from: level, to: range.to } : { from: range.from, to: level }
}
