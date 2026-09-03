/**
 * 위젯 격자. 배치(`widgets/layout.ts`)와 표(`widgets/registry.ts`)를 잇는 껍데기.
 *
 * 지키는 것 셋.
 *
 * ① **재지 않고 계산한다.** 치수는 창 폭 하나에서 나오고 좌표는 순수 함수가 푼다. 재면 첫 프레임이
 *    0 이고 그 0 이 그대로 좌표가 된다.
 * ② **`onLayout` 이 붙는 것은 `h: 'auto'` 타일뿐이다.** 그 값만 계산으로 안 나온다(캐릭터 수 ×
 *    행 높이는 내용의 함수다). auto 가 `w === 4` 에서만 허용되므로 옆 칸이 없어 겹칠 자리가 없다.
 * ③ **좌우 여백을 여기서 안 그린다.** 앱 공통 `px-4` 는 화면의 래퍼가 준다. 여기서 또 주면 두 겹이
 *    되는데 열 폭 계산은 `창폭 − 32` 를 전제로 서 있다.
 */

import { useState } from 'react'
import { Pressable, useWindowDimensions, View } from 'react-native'

import { Card } from '../../components/atoms'
import { resolveWidgetGridMetrics } from '../../lib/today/widget-grid-metrics'
import { resolveWidgetPositions } from '../../lib/today/widget-layout'
import type { TabRouteName } from '../../navigation/routes'
import { useOpenTab } from '../use-open-tab'
import type { TodayViewModel } from './view-model'
import { TILE_LAYOUT } from './widgets/layout'
import { WIDGET_BY_ID } from './widgets/registry'

export interface WidgetGridProps {
  data: TodayViewModel
}

export function WidgetGrid({ data }: WidgetGridProps): React.JSX.Element {
  const openTab = useOpenTab()
  const { width } = useWindowDimensions()
  const metrics = resolveWidgetGridMetrics(width)
  const [autoHeights, setAutoHeights] = useState<Readonly<Record<string, number>>>({})

  const { tiles, containerHeightPx } = resolveWidgetPositions(TILE_LAYOUT, metrics, autoHeights)
  const tileById = new Map(tiles.map((tile) => [tile.id, tile]))

  /** 같은 값이면 **같은 객체를 돌려준다**. 안 그러면 측정 → 렌더 → 측정으로 도는 고리가 된다. */
  function measureAuto(id: string, heightPx: number): void {
    setAutoHeights((current) =>
      current[id] === heightPx ? current : { ...current, [id]: heightPx },
    )
  }

  // 타일 탭은 today(그룹 행)에서 하위 층으로 한 층 내려가는 이동이라, 층이 스택이 된 뒤로는
  // 그냥 그 층을 여는 것으로 끝난다. 바 기록을 손으로 맞출 일이 없다.
  function open(target: TabRouteName): void {
    openTab(target)
  }

  return (
    <View testID="widget-grid" style={{ height: containerHeightPx }}>
      {TILE_LAYOUT.map((placement) => {
        const { Component, target } = WIDGET_BY_ID[placement.id]
        const tile = tileById.get(placement.id)
        if (tile === undefined) return null

        const isAuto = placement.h === 'auto'
        // auto 타일은 **최소** 높이만 정하고 내용이 그 위로 자란다. 고정 높이를 주면 잰 값이 늘
        // 그 값이라 아무것도 못 재고, 늘어나는 것과 스크롤하는 것은 다르다.
        const box = isAuto ? { minHeight: tile.heightPx } : { height: tile.heightPx }

        // `onLayout` 은 내용에 붙는다. 최소 높이를 진 상자에 붙이면 안 된다.
        //
        // 바깥 래퍼(= `minHeight` 를 진 `Card` 를 감싼 상자)를 재면 그 값이 `max(minHeight,
        // 내용)` 이고 그것이 다시 다음 `minHeight` 가 되어 높이가 늘기만 하고 줄지 않는다.
        // 아코디언을 한 번 펼쳤다 접으면 접힌 내용 위로 펼쳤을 때의 높이가 그대로 남는다.
        //
        // 안쪽에서 재면 그 고리가 끊긴다. 이 상자에는 최소 높이가 없어 언제나 내용의 높이다.
        const widget = <Component w={placement.w} h={placement.h} data={data} />
        const measured = isAuto ? (
          <View
            testID={`widget-measure-${placement.id}`}
            onLayout={(event: { nativeEvent: { layout: { height: number } } }) => {
              measureAuto(placement.id, event.nativeEvent.layout.height)
            }}
          >
            {widget}
          </View>
        ) : (
          widget
        )

        return (
          <View
            key={placement.id}
            testID={`widget-tile-${placement.id}`}
            style={{ position: 'absolute', left: tile.leftPx, top: tile.topPx, width: tile.widthPx }}
          >
            {target === undefined ? (
              <Card style={box}>{measured}</Card>
            ) : (
              <Pressable role="button" onPress={() => open(target)}>
                <Card style={box}>{measured}</Card>
              </Pressable>
            )}
          </View>
        )
      })}
    </View>
  )
}
