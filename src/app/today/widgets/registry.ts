/**
 * 위젯 열의 표. 존재 · 폭 · 목적지를 한 자리에 둔다.
 *
 * 배치(`layout.ts`)는 id 만 가리키고 격자는 이 표에서 그림과 목적지를 찾는다. 그래서 위젯이 하나
 * 늘 때 손댈 곳이 표 한 줄과 배치 한 줄로 고정되고, 그 둘이 어긋나면 `validateWidgetLayout` 이
 * 잡는다(선언 안 한 폭 · 겹침 · 빈 줄).
 */

import { CrystalLimitWidget } from './CrystalLimitWidget'
import { NextPartyScheduleWidget } from './NextPartyScheduleWidget'
import { RemainingScheduleWidget } from './RemainingScheduleWidget'
import { SharedContentsWidget } from './SharedContentsWidget'
import { ResetCountdownWidget } from './ResetCountdownWidget'
import { RepresentativeCharacterWidget } from './RepresentativeCharacterWidget'
import { TopValuableItemWidget } from './TopValuableItemWidget'
import type { WidgetDefinition, WidgetId } from './types'
import { UnpricedDropsWidget } from './UnpricedDropsWidget'
import { WeeklyIncomeWidget } from './WeeklyIncomeWidget'

export const WIDGETS: readonly WidgetDefinition[] = [
  { id: 'representative-character', width: 4, Component: RepresentativeCharacterWidget },
  { id: 'shared-contents', width: 4, Component: SharedContentsWidget },
  { id: 'remaining-schedule', width: 4, Component: RemainingScheduleWidget },
  // 위젯 안에서 세그먼트와 캐릭터 줄을 누르므로 타일 전체는 누를 수 없다.
  { id: 'weekly-income', width: 4, Component: WeeklyIncomeWidget },
  { id: 'top-valuable-item', width: 2, target: 'DropPrice', Component: TopValuableItemWidget },
  { id: 'crystal-limit', width: 2, target: 'Profit', Component: CrystalLimitWidget },
  { id: 'reset-countdown', width: 2, Component: ResetCountdownWidget },
  { id: 'unpriced-drops', width: 2, target: 'DropPrice', Component: UnpricedDropsWidget },
  {
    id: 'next-party-schedule',
    width: 4,
    // 보여 줄 회차가 없으면 맨 아래 줄로 내려가 새 스케줄 등록 칸을 그린다.
    placeLast: (data) => data.nextParty.length === 0,
    Component: NextPartyScheduleWidget,
  },
]

export const WIDGET_BY_ID: Readonly<Record<WidgetId, WidgetDefinition>> = Object.fromEntries(
  WIDGETS.map((widget) => [widget.id, widget]),
) as Record<WidgetId, WidgetDefinition>

/**
 * 검증이 읽는 폭 표. 표에서 파생시킨다.
 *
 * `validateWidgetLayout` 이 레지스트리를 import 하지 않고 이 값을 인자로 받으므로(검증이
 * 순수 함수로 남는다), 그 인자를 손으로 적으면 같은 목록이 두 벌이 된다.
 */
export const WIDGET_WIDTH_BY_ID: Readonly<Record<WidgetId, number>> = Object.fromEntries(
  WIDGETS.map((widget) => [widget.id, widget.width]),
) as Record<WidgetId, number>
