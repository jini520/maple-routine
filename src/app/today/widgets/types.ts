/**
 * 위젯 규약. 레지스트리 하나가 위젯의 존재를 선언하고 배치는 그 id 를 가리킬 뿐이다.
 *
 * 위젯은 폭 하나만 그린다. 높이는 내용이 정하고, 같은 줄의 위젯끼리는 격자가 가장 높은 것에 맞춘다.
 * 타일 안에서 스크롤하지 않는다. 타일 안 스크롤은 페이지 스크롤과 제스처를 두고 싸운다.
 *
 * `width` 는 위젯이 선언하고 배치가 그것을 지킨다. `validateWidgetLayout` 이 그 약속을 강제한다.
 */

import type { TabRouteName } from '../../../navigation/routes'
import type { TodayViewModel } from '../view-model'

export type WidgetId =
  | 'representative-character'
  | 'shared-contents'
  | 'remaining-schedule'
  | 'weekly-income'
  | 'top-valuable-item'
  | 'crystal-limit'
  | 'reset-countdown'
  | 'unpriced-drops'
  | 'next-party-schedule'

/**
 * 탭 이름이거나 루트 스택 화면 `DropPrice`. 그 화면은 파라미터를 안 받으면 열리는 순간의 이번 주로
 * 열리므로 타일이 넘길 것이 없다.
 */
export type WidgetTarget = TabRouteName | 'DropPrice'

export interface WidgetProps {
  data: TodayViewModel
}

export interface WidgetDefinition {
  id: WidgetId
  /** 그리는 폭(칸 수). 1..4 */
  width: number
  /**
   * 타일을 누르면 갈 곳. 없으면 누를 수 없는 타일이다. 갈 곳이 없는데 누를 수 있으면 반응이 없는
   * 것이 고장으로 읽힌다.
   */
  target?: WidgetTarget
  /**
   * 참이면 맨 아래 줄로 옮긴다. 보여 줄 것이 없을 때 다른 모양(등록 칸)으로 그리는 위젯이 쓴다. 가로 전체 타일만 쓸 수
   * 있다(옆 칸이 있으면 빈 칸이 남는다)
   */
  placeLast?: (data: TodayViewModel) => boolean
  Component: React.ComponentType<WidgetProps>
}
