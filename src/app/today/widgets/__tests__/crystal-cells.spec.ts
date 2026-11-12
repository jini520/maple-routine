// 넓힌 결정석 위젯의 칸. 메이플 ID 마다 칸 하나이고, 한도 줄 수가 칸의 폭을 정한다.
import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../../../lib/boss/bosses'
import type { CrystalMapleIdView } from '../../view-model'
import { crystalCellRows } from '../crystal-cells'

function group(name: string, lineCount: number): CrystalMapleIdView {
  return {
    accountId: name,
    name,
    lines: Array.from({ length: lineCount }, (_, i) => ({
      key: `line-${i}`,
      name: `줄${i}`,
      cleared: 0,
      limit: WEEKLY_CRYSTAL_SALE_LIMIT,
    })),
  }
}

/** 줄마다 칸의 이름과 폭. */
function shape(groups: CrystalMapleIdView[]): string[][] {
  return crystalCellRows(groups).map((row) => row.cells.map((cell) => `${cell.group.name}:${cell.kind}`))
}

describe('crystalCellRows', () => {
  // 한도 줄이 하나면 반 폭이다. 한 줄에 둘씩 서고, 짝이 없으면 반 폭 그대로 혼자 선다.
  it('한도 줄이 둘 이상인 메이플 ID 가 없으면 기본 차례대로 반 폭 칸을 둘씩 놓는다', () => {
    expect(shape([group('a', 1), group('b', 1), group('c', 1)])).toEqual([['a:half', 'b:half'], ['c:half']])
  })

  // 넓은 칸이 앞으로 모여서, 그 앞뒤로 반 폭 칸이 갈려 혼자 서지 않는다(사용자 지정).
  it('한도 줄이 둘 이상인 메이플 ID 는 한 줄을 다 쓰고 앞으로 모인다', () => {
    expect(shape([group('a', 1), group('b', 2), group('c', 1)])).toEqual([['b:wide'], ['a:half', 'c:half']])
    expect(shape([group('a', 1), group('b', 2)])).toEqual([['b:wide'], ['a:half']])
  })

  it('같은 폭끼리는 기본 차례를 지킨다', () => {
    expect(shape([group('a', 2), group('b', 1), group('c', 2)])).toEqual([['a:wide'], ['c:wide'], ['b:half']])
  })
})
