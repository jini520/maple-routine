/**
 * 위젯 격자 — 배치(`widgets/layout.ts`)와 표(`widgets/registry.ts`)를 잇는 **껍데기**
 * ([[ADR-146]] 결정 2·3·5 · 정정 1).
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
 * auto 가 `w === 4` 에서만 허용되므로 옆 칸이 없어 겹칠 자리가 없다([[ADR-146]] 정정 1).
 *
 * ## 좌우 여백은 이 컴포넌트가 그리지 않는다
 *
 * `GRID_SIDE_PADDING`(16)은 앱 공통 `px-4` 이고, 다른 화면과 같이 **화면의 래퍼**가 준다. 여기서 또
 * 주면 두 겹이 되어 격자가 `창폭 − 64` 안에 들어가는데, 열 폭 계산은 `창폭 − 32` 를 전제로 서 있다.
 *
 * ## 탭 이동은 광고 게이트를 탄다
 *
 * today 자신이 그룹이라 여기서 나가는 것은 전부 **그룹 이동**이다([[ADR-146]] 결정 5 · [[ADR-132]]
 * 결정 9). 바를 거치지 않으므로 `shouldGateAd` 의 'group' 갈래와 같은 비교를 여기서 하되, 그룹 표는
 * `BAR_GROUPS` 하나를 본다 — 목적지가 today 그룹 안이면(그런 위젯은 아직 없다) 게이트가 서지 않는다.
 */

import { useState } from 'react'
import { Pressable, useWindowDimensions, View } from 'react-native'

import { maybeShowTabSwitchAd } from '@core/features/ads/tab-switch-ad'

import { Card } from '../../components/atoms/Card/Card'
import { resolveWidgetGridMetrics } from '../../lib/widget-grid-metrics'
import { resolveWidgetPositions } from '../../lib/widget-layout'
import { groupOfPage } from '../../navigation/bar-model'
import type { TabRouteName } from '../../navigation/routes'
import { useScreenNavigation } from '../use-screen-navigation'
import type { TodayViewModel } from './view-model'
import { TILE_LAYOUT } from './widgets/layout'
import { WIDGET_BY_ID } from './widgets/registry'

/** 이 격자가 사는 화면. 광고 게이트가 «어느 그룹에서 나가는가» 를 물을 때 쓴다. */
const HOST_PAGE: TabRouteName = 'Today'

export interface WidgetGridProps {
  data: TodayViewModel
}

export function WidgetGrid({ data }: WidgetGridProps): React.JSX.Element {
  const navigation = useScreenNavigation()
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

  function open(target: TabRouteName): void {
    navigation.navigate('Tabs', { screen: target })

    // **막지 않는다** — 이동은 위에서 이미 끝났고 광고는 준비된 것이 있을 때만 뜬다
    // ([[ADR-090]] 결정 3 «광고는 이동을 지연시키지 않는다»).
    if (groupOfPage(HOST_PAGE).id !== groupOfPage(target).id) void maybeShowTabSwitchAd()
  }

  return (
    <View testID="widget-grid" style={{ height: containerHeightPx }}>
      {TILE_LAYOUT.map((placement) => {
        const { Component, target } = WIDGET_BY_ID[placement.id]
        const tile = tileById.get(placement.id)
        if (tile === undefined) return null

        const isAuto = placement.h === 'auto'
        // auto 타일은 «최소» 높이만 정하고 내용이 그 위로 자란다 — 고정 높이를 주면 잰 값이 늘
        // 그 값이라 아무것도 못 재고, 늘어나는 것과 스크롤하는 것은 다르다([[ADR-146]] 정정 1).
        const box = isAuto ? { minHeight: tile.heightPx } : { height: tile.heightPx }
        const widget = <Component w={placement.w} h={placement.h} data={data} />

        return (
          <View
            key={placement.id}
            testID={`widget-tile-${placement.id}`}
            style={{ position: 'absolute', left: tile.leftPx, top: tile.topPx, width: tile.widthPx }}
            // 조건부 전개다 — `onLayout={undefined}` 로 넘겨도 동작은 같지만, «auto 타일만 잰다» 가
            // 렌더 트리에서도 보여야 그 규칙이 다음 사람에게 남는다.
            {...(isAuto
              ? {
                  onLayout: (event: {
                    nativeEvent: { layout: { height: number } }
                  }) => {
                    measureAuto(placement.id, event.nativeEvent.layout.height)
                  },
                }
              : null)}
          >
            {target === undefined ? (
              <Card style={box}>{widget}</Card>
            ) : (
              <Pressable role="button" onPress={() => open(target)}>
                <Card style={box}>{widget}</Card>
              </Pressable>
            )}
          </View>
        )
      })}
    </View>
  )
}
