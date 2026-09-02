// 레지스트리와 **손으로 적은 배치**의 대조.
//
// 좌표를 손으로 적기로 한 이상 그 실수는 반드시 나고, **그것을 잡는 것은 이 파일뿐이다**.
// `validateWidgetLayout` 이 있지만 **지금 쓰는 배치가 그 검증을 통과하는가** 는
// 아무도 안 묻고 있었다. 자동 패킹을 기각하며 산 값이 정확히 여기서 회수된다.

import { validateWidgetLayout } from '../../../lib/today/widget-layout'
import { TILE_LAYOUT } from '../widgets/layout'
import { WIDGETS, WIDGET_SIZES_BY_ID } from '../widgets/registry'

describe('기본 배치', () => {
  it('검증 다섯을 전부 통과한다. 위반이 없다', () => {
    expect(validateWidgetLayout(TILE_LAYOUT, WIDGET_SIZES_BY_ID)).toEqual([])
  })

  it('레지스트리의 위젯 아홉이 배치에 정확히 한 번씩 등장한다', () => {
    const placedIds = TILE_LAYOUT.map((placement) => placement.id)

    expect(WIDGETS).toHaveLength(9)
    expect([...placedIds].sort()).toEqual(WIDGETS.map((widget) => widget.id).sort())
    expect(new Set(placedIds).size).toBe(placedIds.length)
  })

  // 배치가 코드 상수인 v1 에서는 **선언만 남고 아무도 안 쓰는 크기**가 생긴다(정정 13. 남기기로
  // 한 값이다). 그러니 **선언된 크기 = 쓰이는 크기** 로 적으면 안 되고, 반대 방향만 참이다.
  it('배치가 쓰는 크기는 전부 그 위젯이 선언한 것이다. 반대는 아니다', () => {
    for (const placement of TILE_LAYOUT) {
      expect(WIDGET_SIZES_BY_ID[placement.id]).toContainEqual({ w: placement.w, h: placement.h })
    }

    const declaredCount = WIDGETS.reduce((sum, widget) => sum + widget.sizes.length, 0)
    expect(declaredCount).toBeGreaterThan(TILE_LAYOUT.length)
  })

  // 공유 컨텐츠가 `남은 스케줄` **위**에 선다(사용자 지정). 먼저 치우면
  // 아래 목록이 줄어드는 관계라서다. 순서가 뒤집히면 그 근거가 사라지므로 좌표로 못 박는다.
  it('공유 컨텐츠가 남은 스케줄 바로 위다', () => {
    const rowOf = (id: string): number =>
      TILE_LAYOUT.find((placement) => placement.id === id)?.row ?? -1

    expect(rowOf('shared-contents')).toBe(rowOf('remaining-schedule') - 1)
    expect(rowOf('shared-contents')).toBeGreaterThan(rowOf('crystal-limit'))
  })

  it('`h: auto` 를 선언한 위젯은 가로 4칸짜리 크기만 갖는다', () => {
    for (const widget of WIDGETS) {
      for (const size of widget.sizes) {
        if (size.h === 'auto') expect(size.w).toBe(4)
      }
    }
  })
})
