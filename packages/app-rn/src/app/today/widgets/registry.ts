/**
 * 위젯 여덟의 **표** — 존재·크기·목적지([[ADR-146]] 결정 3·6 · 정정 13).
 *
 * ## 왜 «표» 인가
 *
 * 배치(`layout.ts`)는 id 만 가리키고, 격자(`WidgetGrid.tsx`)는 이 표에서 그림과 목적지를 찾는다.
 * 그래서 위젯이 하나 늘 때 손댈 곳이 «표 한 줄 + 배치 한 줄» 로 고정되고, 그 둘이 어긋나면
 * `validateWidgetLayout` 이 잡는다(선언 안 한 크기·중복·겹침).
 *
 * ## 굵은 것이 기본 크기이고, 나머지는 **아직 아무도 안 쓴다**
 *
 * 배치가 코드 상수인 v1 에서 실제로 그려지는 크기는 `layout.ts` 가 적은 여덟뿐이다. 그래도 나머지를
 * 선언해 두는 것이 [[ADR-146]] 정정 13 의 결정이다 — 나중에 편집이 오면 **그때 고를 크기가 이미
 * 있어야** 하고, 대가는 «아무도 안 부르는 렌더 분기가 스냅샷으로만 검증된다» 는 것이다.
 *
 * ## `target` 은 **제안값**이다
 *
 * 특히 결정석 한도·아이템 드롭 가뭄이 `Profit` 인지 `/profit/drops`(전 기간 히스토리)인지는
 * 실기기에서 눌러 보고 정한다([[ADR-146]] 열린 질문).
 */

import type { WidgetSize } from '../../../lib/widget-layout'
import { CrystalLimitWidget } from './CrystalLimitWidget'
import { RemainingScheduleWidget } from './RemainingScheduleWidget'
import { ResetCountdownWidget } from './ResetCountdownWidget'
import { RepresentativeCharacterWidget } from './RepresentativeCharacterWidget'
import { stubWidget } from './StubWidget'
import { TopValuableItemWidget } from './TopValuableItemWidget'
import type { WidgetDefinition, WidgetId } from './types'
import { WeeklyBossProfitWidget } from './WeeklyBossProfitWidget'

export const WIDGETS: readonly WidgetDefinition[] = [
  {
    id: 'representative-character',
    sizes: [
      { w: 4, h: 1 },
      { w: 4, h: 2 },
      { w: 2, h: 2 },
    ],
    // 대표를 바꾸는 자리가 캐릭터 관리이고, 그 자리는 설정 하나다([[ADR-140]] 결정 1).
    target: 'Settings',
    Component: RepresentativeCharacterWidget,
  },
  {
    // 크기가 하나뿐인 유일한 위젯이다 — 캐릭터를 «전부» 출력하므로 높이를 미리 알 수 없고,
    // `h: 'auto'` 는 가로를 다 쓰는 타일에만 허용된다([[ADR-146]] 정정 1).
    id: 'remaining-schedule',
    sizes: [{ w: 4, h: 'auto' }],
    target: 'Content',
    Component: RemainingScheduleWidget,
  },
  {
    id: 'weekly-boss-profit',
    sizes: [
      { w: 4, h: 3 },
      { w: 4, h: 2 },
      { w: 2, h: 2 },
      { w: 2, h: 1 },
    ],
    target: 'Profit',
    Component: WeeklyBossProfitWidget,
  },
  {
    id: 'top-valuable-item',
    sizes: [
      { w: 2, h: 1 },
      { w: 4, h: 2 },
      { w: 2, h: 2 },
      { w: 1, h: 1 },
    ],
    target: 'Profit',
    Component: TopValuableItemWidget,
  },
  {
    id: 'crystal-limit',
    sizes: [
      { w: 2, h: 1 },
      { w: 4, h: 1 },
      { w: 2, h: 2 },
      { w: 1, h: 1 },
    ],
    target: 'Profit',
    Component: CrystalLimitWidget,
  },
  {
    // **목적지가 없는 유일한 위젯**이다 — 초기화 시각은 이 타일이 다 말하고, 더 볼 화면이 없다.
    id: 'reset-countdown',
    sizes: [
      { w: 2, h: 1 },
      { w: 2, h: 2 },
      { w: 4, h: 1 },
      { w: 1, h: 1 },
    ],
    Component: ResetCountdownWidget,
  },
  {
    id: 'unpriced-drops',
    sizes: [
      { w: 2, h: 1 },
      { w: 2, h: 2 },
      { w: 1, h: 1 },
    ],
    target: 'Profit',
    Component: stubWidget('unpriced-drops'),
  },
  {
    id: 'valuable-drought',
    sizes: [
      { w: 4, h: 1 },
      { w: 2, h: 2 },
      { w: 2, h: 1 },
    ],
    target: 'Profit',
    Component: stubWidget('valuable-drought'),
  },
]

export const WIDGET_BY_ID: Readonly<Record<WidgetId, WidgetDefinition>> = Object.fromEntries(
  WIDGETS.map((widget) => [widget.id, widget]),
) as Record<WidgetId, WidgetDefinition>

/**
 * 검증이 읽는 «선언된 크기» 표 — **표에서 파생시킨다.**
 *
 * `validateWidgetLayout` 이 레지스트리를 import 하지 않고 이 값을 인자로 받는 것이 step 5 의 결정이라
 * (검증이 순수 함수로 남는다), 그 인자를 손으로 적으면 같은 목록이 두 벌이 된다.
 */
export const WIDGET_SIZES_BY_ID: Readonly<Record<WidgetId, readonly WidgetSize[]>> =
  Object.fromEntries(WIDGETS.map((widget) => [widget.id, widget.sizes])) as Record<
    WidgetId,
    readonly WidgetSize[]
  >
