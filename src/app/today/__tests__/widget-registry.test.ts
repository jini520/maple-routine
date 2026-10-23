// 레지스트리와 **손으로 적은 배치**의 대조.
//
// 좌표를 손으로 적기로 한 이상 그 실수는 반드시 나고, **그것을 잡는 것은 이 파일뿐이다**.
// `validateWidgetLayout` 이 있지만 **지금 쓰는 배치가 그 검증을 통과하는가** 는
// 아무도 안 묻고 있었다. 자동 패킹을 기각하며 산 값이 정확히 여기서 회수된다.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { validateWidgetLayout } from '../../../lib/today/widget-layout'
import { TILE_LAYOUT } from '../widgets/layout'
import { WIDGETS, WIDGET_WIDTH_BY_ID } from '../widgets/registry'

describe('기본 배치', () => {
  it('검증 넷을 전부 통과한다. 위반이 없다', () => {
    expect(validateWidgetLayout(TILE_LAYOUT, WIDGET_WIDTH_BY_ID)).toEqual([])
  })

  it('레지스트리의 위젯 열이 배치에 정확히 한 번씩 등장한다', () => {
    const placedIds = TILE_LAYOUT.map((placement) => placement.id)

    expect([...placedIds].sort()).toEqual(WIDGETS.map((widget) => widget.id).sort())
    expect(new Set(placedIds).size).toBe(placedIds.length)
  })

  // 공유 컨텐츠가 `남은 스케줄` **위**에 선다. 먼저 치우면
  // 아래 목록이 줄어드는 관계라서다. 순서가 뒤집히면 그 근거가 사라지므로 좌표로 못 박는다.
  it('공유 컨텐츠가 남은 스케줄 바로 위다', () => {
    const rowOf = (id: string): number =>
      TILE_LAYOUT.find((placement) => placement.id === id)?.row ?? -1

    expect(rowOf('shared-contents')).toBe(rowOf('remaining-schedule') - 1)
    expect(rowOf('shared-contents')).toBeGreaterThan(rowOf('crystal-limit'))
  })
})

// 맨 아래로 옮겨지는 타일은 가로 전체여야 한다. 옆 칸이 있으면 빠진 자리가 빈 칸으로 남는다.
describe('맨 아래로 옮겨지는 위젯', () => {
  it('placeLast 가 있는 위젯은 가로 전체로 놓인다', () => {
    for (const widget of WIDGETS.filter((one) => one.placeLast !== undefined)) {
      expect(TILE_LAYOUT.find((placement) => placement.id === widget.id)?.w).toBe(4)
    }
  })
})

// 위젯 카드 하나가 통째로 흐려지면 다른 카드와 따로 논다(사용자 지정). NativeWind 가 렌더 뒤 `className` 을
// 지워 렌더 결과로는 물을 수 없어서 소스로 묻는다.
describe('누르는 동안 흐려지지 않는다', () => {
  it('격자와 위젯 소스에 누름 흐려짐 클래스가 없다', () => {
    const widgetsDir = join(__dirname, '..', 'widgets')
    const files = [
      join(__dirname, '..', 'WidgetGrid.tsx'),
      ...readdirSync(widgetsDir)
        .filter((name) => name.endsWith('.tsx'))
        .map((name) => join(widgetsDir, name)),
    ]

    for (const file of files) {
      expect([file, readFileSync(file, 'utf8')]).not.toEqual([file, expect.stringContaining('active:opacity')])
    }
  })
})

// `flex-1` 은 기준 크기를 0 으로 잡는다. 같은 줄을 늘려 맞추며 카드 높이가 정해진 뒤 다시 배치되면 위젯 내용 높이가
// 0 으로 계산되어 줄이 접힌다(데이터가 들어오거나 세그먼트를 바꾼 순간 실기기에서 실제로 접혔다). 렌더 결과로는 Yoga
// 배치를 물을 수 없어 소스로 묻는다.
describe('위젯 바깥 상자', () => {
  it('`flex-1` 이 아니라 `grow` 로 카드를 채운다', () => {
    const widgetsDir = join(__dirname, '..', 'widgets')
    for (const name of readdirSync(widgetsDir).filter((one) => one.endsWith('Widget.tsx'))) {
      const source = readFileSync(join(widgetsDir, name), 'utf8')
      const roots = source.match(/testID="widget-[a-z-]+"[^>]*className="[^"]*"/g) ?? []
      for (const root of roots) expect([name, root]).not.toEqual([name, expect.stringMatching(/className="[^"]*\bflex-1\b/)])
    }
  })
})
