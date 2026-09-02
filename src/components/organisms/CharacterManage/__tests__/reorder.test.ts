// `선택됨` 층의 순서 계산 — **제스처에서 떼어 낸 것이 곧 이 파일의 존재
// 이유다.** 끌기 자체는 jest 가 한 줄도 못 본다(제스처는 네이티브가 인식하고 jsdom 처럼 레이아웃도
// 계산되지 않는다). 그래서 **어디에 떨어지는가**·**얼마나 굴리는가**·**어떤 배열이 되는가** 를 전부
// 순수 함수로 내려 두고, 여기서 그 규칙을 직접 묻는다.
import {
  moveOcid,
  resolveAutoScrollStepPx,
  resolveDropIndex,
  resolveRowShiftSteps,
} from '../reorder'

const 목록 = ['a1', 'a2', 'a3', 'b1']

describe('moveOcid — 놓은 자리가 곧 배열 순서다', () => {
  it('아래로 옮기면 그 자리에 끼워지고 사이가 한 칸씩 당겨진다', () => {
    expect(moveOcid(목록, 0, 2)).toEqual(['a2', 'a3', 'a1', 'b1'])
  })

  it('위로 옮기면 그 자리에 끼워지고 사이가 한 칸씩 밀린다', () => {
    expect(moveOcid(목록, 3, 1)).toEqual(['a1', 'b1', 'a2', 'a3'])
  })

  it('한 칸 이동은 이웃과 자리를 바꾼 것과 같다', () => {
    expect(moveOcid(목록, 1, 2)).toEqual(['a1', 'a3', 'a2', 'b1'])
  })

  // 경계 — 첫 행을 더 위로, 끝 행을 더 아래로 보내면 갈 곳이 없다. 던지지 않고 **같은 내용**이다
  // (접근성 액션이 경계에서 그 액션을 아예 안 주는 것과 짝이다 — 그래도 값 규칙이 먼저 선다).
  it.each([
    ['첫 행을 위로', 0, -1],
    ['끝 행을 아래로', 3, 4],
    ['한참 위로', 2, -10],
    ['한참 아래로', 1, 99],
  ])('%s 보내면 목록 안으로 잘린다', (_label, from, to) => {
    const moved = moveOcid(목록, from, to)

    expect(moved).toHaveLength(목록.length)
    expect([...moved].sort()).toEqual([...목록].sort())
  })

  it('첫 행을 위로 보내면 순서가 그대로다', () => {
    expect(moveOcid(목록, 0, -1)).toEqual(목록)
  })

  it('같은 자리면 같은 배열 내용이다', () => {
    expect(moveOcid(목록, 2, 2)).toEqual(목록)
  })

  it('원본을 건드리지 않는다', () => {
    const before = [...목록]

    moveOcid(목록, 0, 3)

    expect(목록).toEqual(before)
  })

  it('빈 목록에서도 던지지 않는다', () => {
    expect(moveOcid([], 0, 1)).toEqual([])
  })
})

describe('resolveDropIndex — 끈 거리가 몇 칸인가', () => {
  const 칸 = 60

  it('안 움직였으면 제자리다', () => {
    expect(resolveDropIndex(1, 0, 칸, 4)).toBe(1)
  })

  it('한 칸만큼 내리면 한 칸 아래다', () => {
    expect(resolveDropIndex(1, 칸, 칸, 4)).toBe(2)
  })

  it('한 칸만큼 올리면 한 칸 위다', () => {
    expect(resolveDropIndex(1, -칸, 칸, 4)).toBe(0)
  })

  // 반 칸이 경계다 — 행 높이의 절반을 넘어야 자리를 내준다(반올림).
  it.each([
    ['반 칸 못 미치면 제자리', 칸 * 0.49, 1],
    ['반 칸 넘으면 다음 칸', 칸 * 0.51, 2],
  ])('%s', (_label, offsetPx, expected) => {
    expect(resolveDropIndex(1, offsetPx, 칸, 4)).toBe(expected)
  })

  it.each([
    ['위로 넘치면 첫 칸', -칸 * 10, 0],
    ['아래로 넘치면 끝 칸', 칸 * 10, 3],
  ])('%s', (_label, offsetPx, expected) => {
    expect(resolveDropIndex(1, offsetPx, 칸, 4)).toBe(expected)
  })

  // 아직 안 쟀을 때(첫 프레임) 0 으로 나누면 `Infinity` 가 되어 끝 칸으로 튄다.
  it('칸 높이를 아직 모르면 제자리다', () => {
    expect(resolveDropIndex(1, 200, 0, 4)).toBe(1)
  })
})

describe('resolveAutoScrollStepPx — 화면 가장자리에서 굴린다', () => {
  const 기본 = { topPx: 60, bottomPx: 800, zonePx: 100, maxStepPx: 12 }

  it('가운데서는 굴리지 않는다', () => {
    expect(resolveAutoScrollStepPx({ ...기본, pointerYPx: 400 })).toBe(0)
  })

  it('위 가장자리에서는 음수 — 목록을 되감는다', () => {
    expect(resolveAutoScrollStepPx({ ...기본, pointerYPx: 100 })).toBeLessThan(0)
  })

  it('아래 가장자리에서는 양수 — 목록을 내려간다', () => {
    expect(resolveAutoScrollStepPx({ ...기본, pointerYPx: 760 })).toBeGreaterThan(0)
  })

  // 깊이에 비례한다 — 경계에 걸치면 0, 끝까지 가면 최대. 안 그러면 살짝 스치기만 해도 최대
  // 속도로 튄다.
  it.each([
    ['위 구간 경계', 160, -0],
    ['위 끝', 60, -12],
    ['위 구간 한가운데', 110, -6],
    ['아래 구간 경계', 700, 0],
    ['아래 끝', 800, 12],
    ['아래 구간 한가운데', 750, 6],
  ])('%s 에서는 깊이에 비례한다', (_label, pointerYPx, expected) => {
    expect(resolveAutoScrollStepPx({ ...기본, pointerYPx })).toBeCloseTo(expected, 5)
  })

  it('가장자리 밖(화면을 벗어난 손가락)에서도 최대를 넘지 않는다', () => {
    expect(resolveAutoScrollStepPx({ ...기본, pointerYPx: -500 })).toBe(-12)
    expect(resolveAutoScrollStepPx({ ...기본, pointerYPx: 5000 })).toBe(12)
  })

  it('구간이 0이면 굴리지 않는다', () => {
    expect(resolveAutoScrollStepPx({ ...기본, zonePx: 0, pointerYPx: 60 })).toBe(0)
  })
})

describe('resolveRowShiftSteps — 끌려 나간 자리를 나머지가 메운다', () => {
  it('끌고 있는 행 자신은 안 밀린다 (그 행은 손가락을 따라간다)', () => {
    expect(resolveRowShiftSteps(1, 1, 3)).toBe(0)
  })

  it('아래로 끌면 지나온 행들이 한 칸씩 올라간다', () => {
    expect(resolveRowShiftSteps(2, 1, 3)).toBe(-1)
    expect(resolveRowShiftSteps(3, 1, 3)).toBe(-1)
  })

  it('위로 끌면 지나온 행들이 한 칸씩 내려간다', () => {
    expect(resolveRowShiftSteps(1, 3, 1)).toBe(1)
    expect(resolveRowShiftSteps(2, 3, 1)).toBe(1)
  })

  it('지나오지 않은 행은 그대로다', () => {
    expect(resolveRowShiftSteps(0, 1, 3)).toBe(0)
    expect(resolveRowShiftSteps(3, 3, 1)).toBe(0)
  })

  it('끌지 않는 동안에는 아무도 안 밀린다', () => {
    expect(resolveRowShiftSteps(2, -1, -1)).toBe(0)
  })
})
