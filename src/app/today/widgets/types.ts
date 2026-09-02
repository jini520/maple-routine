/**
 * 위젯 규약 — 레지스트리 하나가 위젯의 존재 를 선언하고, 배치는 그 id 를 가리킬 뿐이다
 *
 *
 * ## 위젯이 `w`·`h` 로 갈라 스스로 다르게 그린다
 *
 * 같은 데이터를 다른 밀도로 말하는 것이지, 큰 타일이 작은 타일을 늘린 것이 아니다(iOS 위젯의
 * small/medium/large 와 같은 규약). 그래서 **타일은 스스로 커지거나 줄지 않는다**. 크기는 배치가
 * 주고, 넘치면 자르거나 접는다(타일 안 스크롤 금지: 페이지 스크롤과 제스처를 두고 싸운다).
 *
 * ## `sizes` 는 위젯이 선언하고 배치가 그것을 지킨다
 *
 * `validateWidgetLayout` 의 네 번째 규칙이 그 약속을 강제한다. 선언 안 한 크기를 받으면 위젯은
 * 그리는 방법을 모른다. 배치가 코드 상수인 v1 에서는 **아무도 안 쓰는 크기 선언이 남는데**, 그것은
 * 결정 2가 열어 둔 나중에 편집이 오면 배열만 저장소로 옮긴다 가 성립하려면 그때 고를 크기가 이미
 * 있어야 하기 때문이다(사용자 확정).
 */

import type { WidgetHeight, WidgetSize } from '../../../lib/today/widget-layout'
import type { TabRouteName } from '../../../navigation/routes'
import type { TodayViewModel } from '../view-model'

export type WidgetId =
  | 'representative-character'
  | 'shared-contents'
  | 'remaining-schedule'
  | 'weekly-boss-profit'
  | 'top-valuable-item'
  | 'crystal-limit'
  | 'reset-countdown'
  | 'unpriced-drops'
  | 'valuable-drought'

export interface WidgetProps {
  w: number
  /**
   * **선언한 값 그대로**다. `'auto'` 를 숫자로 접지 않는다.
   *
   * 위젯이 갈라 그리는 기준이 내가 선언한 어느 크기인가 라, 선언에 없는 값(auto 타일의 nominal 1)
   * 을 넘기면 그 분기가 가리키는 크기가 실제로는 존재하지 않는 크기가 된다. 최소 높이는 배치를 푸는
   * 쪽(`resolveWidgetPositions`)의 사정이지 위젯이 알 일이 아니다.
   */
  h: WidgetHeight
  /** 화면이 한 번 모아 나눠 주는 값 — **위젯은 스토어를 모른다**. */
  data: TodayViewModel
}

export interface WidgetDefinition {
  id: WidgetId
  /** 이 위젯이 감당하는 크기. 배치가 이 밖의 크기를 주면 검증이 잡는다. */
  sizes: readonly WidgetSize[]
  /**
   * 타일을 누르면 가는 곳. **없으면 누를 수 없는 타일이다**. 갈 데가 없는 것을 누를 수 있게 두면
   * 무반응이 고장 으로 읽힌다.
   */
  target?: TabRouteName
  Component: React.ComponentType<WidgetProps>
}
