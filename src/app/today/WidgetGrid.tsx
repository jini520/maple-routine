/**
 * 위젯 격자 — 배치(`widgets/layout.ts`)와 표(`widgets/registry.ts`)를 잇는 **껍데기**
 * ([[ADR-147]] 결정 2·3·5 · 정정 1).
 *
 * ## 재지 않고 계산한다 — 단 하나만 뺀다
 *
 * 치수는 창 폭 하나에서 나오고(`resolveWidgetGridMetrics`) 좌표는 순수 함수가 푼다
 * (`resolveWidgetPositions`). **`onLayout` 이 붙는 것은 `h: 'auto'` 타일뿐이다** — 나머지는 계산으로
 * 나오는 값이라 재면 첫 프레임에 0 이고, 그 0 이 그대로 좌표가 된다([[ADR-132]] 정정 30 이 하단바에서
 * 같은 결론에 먼저 도달했다).
 *
 * auto 타일에서만 재는 이유는 그 값이 **계산으로 나오지 않기 때문**이다(캐릭터 수 × 행 높이는 내용의
 * 함수다). 잰 값은 최소 높이보다 클 때만 뜻이 있고, 그때 아래 타일 전부가 같은 값으로 내려간다 —
 * auto 가 `w === 4` 에서만 허용되므로 옆 칸이 없어 겹칠 자리가 없다([[ADR-147]] 정정 1).
 *
 * ## 좌우 여백은 이 컴포넌트가 그리지 않는다
 *
 * `GRID_SIDE_PADDING`(16)은 앱 공통 `px-4` 이고, 다른 화면과 같이 **화면의 래퍼**가 준다. 여기서 또
 * 주면 두 겹이 되어 격자가 `창폭 − 64` 안에 들어가는데, 열 폭 계산은 `창폭 − 32` 를 전제로 서 있다.
 *
 * ## 탭 이동은 광고 게이트를 탔었다
 *
 * today 자신이 그룹이라 여기서 나가는 것은 전부 **그룹 이동**이고([[ADR-147]] 결정 5 · [[ADR-132]]
 * 결정 9), 바를 거치지 않으므로 같은 비교를 여기서 한 번 더 했다. [[ADR-150]] 이 전면광고를 걷으며
 * 지웠다 — 노출 지점이 바 하나에서 여기까지 저절로 둘로 늘었던 것이 그 결정의 근거 중 하나다.
 */

import { useState } from 'react'
import { Pressable, useWindowDimensions, View } from 'react-native'

import { Card } from '../../components/atoms/Card/Card'
import { resolveWidgetGridMetrics } from '../../lib/widget-grid-metrics'
import { resolveWidgetPositions } from '../../lib/widget-layout'
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

  /** 같은 값이면 **같은 객체를 돌려준다** — 안 그러면 측정 → 렌더 → 측정으로 도는 고리가 된다. */
  function measureAuto(id: string, heightPx: number): void {
    setAutoHeights((current) =>
      current[id] === heightPx ? current : { ...current, [id]: heightPx },
    )
  }

  // 타일 탭은 today(그룹 행)에서 하위 층으로 **한 층 내려가는 이동**이라, 층이 스택이 된 뒤로는
  // 그냥 그 층을 여는 것으로 끝난다([[ADR-167]] 결정 6).
  //
  // 예전에는 여기서 바 기록을 손으로 맞춰야 했다. 안 맞추면 하위 행의 ← 가 «기록이 없으면 페이지는
  // 그대로 두고 그룹 행만 연다» 는 안전망에 걸려 **가계부가 활성인 채로** 그룹 행이 열렸다. 되돌아갈
  // 단이 실재하는 지금은 그 안전망도, 그것을 피하려고 적던 기록도 없다.
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
        // auto 타일은 «최소» 높이만 정하고 내용이 그 위로 자란다 — 고정 높이를 주면 잰 값이 늘
        // 그 값이라 아무것도 못 재고, 늘어나는 것과 스크롤하는 것은 다르다([[ADR-147]] 정정 1).
        const box = isAuto ? { minHeight: tile.heightPx } : { height: tile.heightPx }

        // ⚠️ **`onLayout` 은 «내용» 에 붙는다 — 최소 높이를 진 상자에 붙이면 안 된다.**
        //
        // 한때 바깥 래퍼(= `minHeight` 를 진 `Card` 를 감싼 상자)를 쟀다. 그러면 재는 값이
        // `max(minHeight, 내용)` 이고 그 값이 다시 다음 `minHeight` 가 되어 **높이가 늘기만 하고
        // 줄지 않는다**(래칫). 아코디언을 한 번 펼쳤다 접으면 접힌 내용 위로 펼쳤을 때의 높이가
        // 그대로 남아 빈 자리가 생긴다 — 자기가 크기를 정하는 것을 재고 있었던 것이다.
        //
        // 안쪽에서 재면 그 고리가 끊긴다: 이 상자에는 최소 높이가 없어 **언제나 내용의 높이**다.
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
