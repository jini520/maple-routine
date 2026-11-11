// 넓힌 결정석 위젯의 칸. 메이플 ID 마다 칸 하나이고, 월드 수가 칸의 모양과 폭을 정한다.
import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../../../lib/boss/bosses'
import type { CrystalMapleIdView } from '../../view-model'
import { crystalCellRows } from '../crystal-cells'

function group(name: string, worldCount: number): CrystalMapleIdView {
  return {
    accountId: name,
    name,
    worlds: Array.from({ length: worldCount }, (_, i) => ({
      worldKey: `world-${i}`,
      world: `월드${i}`,
      cleared: 0,
      limit: WEEKLY_CRYSTAL_SALE_LIMIT,
    })),
  }
}

/** 줄마다 칸의 이름과 모양. */
function shape(groups: CrystalMapleIdView[]): string[][] {
  return crystalCellRows(groups).map((row) => row.cells.map((cell) => `${cell.group.name}:${cell.kind}`))
}

describe('crystalCellRows', () => {
  // 월드 1 은 링 칸, 2 는 막대 칸이고 둘 다 반 폭이다. 한 줄에 둘씩 서고, 짝이 없으면 반 폭 그대로 혼자 선다.
  it('월드가 3개 이상인 메이플 ID 가 없으면 기본 차례대로 반 폭 칸을 둘씩 놓는다', () => {
    expect(shape([group('a', 1), group('b', 2), group('c', 1)])).toEqual([['a:ring', 'b:bars'], ['c:ring']])
  })

  // 넓은 칸이 앞으로 모여서, 그 앞뒤로 반 폭 칸이 갈려 혼자 서지 않는다(사용자 지정).
  it('월드가 3개 이상인 메이플 ID 가 있으면 월드가 많은 차례로 놓고, 3개 이상은 한 줄을 다 쓴다', () => {
    expect(shape([group('a', 2), group('b', 4), group('c', 1)])).toEqual([['b:wide'], ['a:bars', 'c:ring']])
    expect(shape([group('a', 1), group('b', 5)])).toEqual([['b:wide'], ['a:ring']])
    expect(shape([group('a', 3), group('b', 4)])).toEqual([['b:wide'], ['a:wide']])
  })

  it('월드 수가 같으면 기본 차례를 지킨다', () => {
    expect(shape([group('a', 3), group('b', 1), group('c', 3)])).toEqual([['a:wide'], ['c:wide'], ['b:ring']])
  })
})
