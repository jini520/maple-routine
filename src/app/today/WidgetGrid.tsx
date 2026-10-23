/**
 * 위젯 격자. 배치(`widgets/layout.ts`)와 표(`widgets/registry.ts`)를 잇는 껍데기.
 *
 * 지키는 것 셋.
 *
 * ① **폭은 재지 않고 계산한다.** 칸 폭은 창 폭 하나에서 나온다. 재면 첫 프레임이 0 이다.
 * ② **높이는 내용이 정하고, 같은 줄은 가장 높은 타일에 맞춘다.** 줄을 `flex-row` 로 두고 타일을
 *    `stretch` 로 늘리면, 높이를 재거나 계산하지 않아도 줄 높이가 가장 높은 타일이 된다. 카드가
 *    타일 높이를 채워야 나란히 놓인 카드의 아래 끝이 맞는다.
 * ③ **좌우 여백을 여기서 안 그린다.** 앱 공통 `px-4` 는 화면의 래퍼가 준다. 여기서 또 주면 두 겹이
 *    되는데 칸 폭 계산은 `창폭 − 32` 를 전제로 서 있다.
 */

import { Pressable, useWindowDimensions, View } from 'react-native'

import { Card } from '../../components/atoms'
import { resolveWidgetGridMetrics, tileWidthPx } from '../../lib/today/widget-grid-metrics'
import { groupWidgetRows, moveTilesToEnd } from '../../lib/today/widget-layout'
import { useOpenTab } from '../../hooks/useOpenTab'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import type { TodayViewModel } from './view-model'
import { TILE_LAYOUT } from './widgets/layout'
import { WIDGETS, WIDGET_BY_ID } from './widgets/registry'
import type { WidgetTarget } from './widgets/types'

export interface WidgetGridProps {
  data: TodayViewModel
}

export function WidgetGrid({ data }: WidgetGridProps): React.JSX.Element {
  const openTab = useOpenTab()
  const navigation = useScreenNavigation()
  const { width } = useWindowDimensions()
  const metrics = resolveWidgetGridMetrics(width)

  // 보여 줄 것이 없는 위젯은 맨 아래 줄로 내려 다른 모양으로 그린다.
  const lastIds = new Set(
    WIDGETS.filter((widget) => widget.placeLast !== undefined && widget.placeLast(data)).map((widget) => widget.id),
  )
  const rows = groupWidgetRows(moveTilesToEnd(TILE_LAYOUT, lastIds))

  // 타일 탭은 today(그룹 행)에서 하위 층으로 한 층 내려가는 이동이라, 층이 스택이 된 뒤로는
  // 그냥 그 층을 여는 것으로 끝난다. 바 기록을 손으로 맞출 일이 없다.
  function open(target: WidgetTarget): void {
    if (target === 'DropPrice') {
      navigation.navigate('DropPrice')
      return
    }
    openTab(target)
  }

  return (
    <View testID="widget-grid" style={{ gap: metrics.gapPx }}>
      {rows.map((row, rowIndex) => {
        let cursorPx = 0
        return (
          <View key={row[0].id} testID={`widget-row-${rowIndex}`} style={{ flexDirection: 'row', alignItems: 'stretch' }}>
            {row.map((placement) => {
              const { Component, target } = WIDGET_BY_ID[placement.id]
              const leftPx = placement.col * (metrics.colWidthPx + metrics.gapPx)
              const widthPx = tileWidthPx(placement.w, metrics)
              const marginLeft = leftPx - cursorPx
              cursorPx = leftPx + widthPx

              const card = (
                <Card testID={`widget-card-${placement.id}`} style={{ flexGrow: 1 }}>
                  <Component data={data} />
                </Card>
              )

              return (
                <View key={placement.id} testID={`widget-tile-${placement.id}`} style={{ width: widthPx, marginLeft }}>
                  {target === undefined ? (
                    card
                  ) : (
                    // 누르는 동안 흐리게 하지 않는다. 위젯 카드 하나가 통째로 흐려지면 다른 카드와 따로 논다.
                    <Pressable role="button" onPress={() => open(target)} style={{ flexGrow: 1 }}>
                      {card}
                    </Pressable>
                  )}
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}
