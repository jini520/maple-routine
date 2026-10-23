/** today 빠른 이동이 열 수 있는 화면 하나 */
export type QuickLinkId =
  | 'appointments'
  | 'content'
  | 'boss'
  | 'profit'
  | 'cashbook'
  | 'stats'
  | 'utility'
  | 'boss-manage'
  | 'characters'
  | 'item-split'
  | 'boss-profit-calculator'
  | 'mvp-grade'
  | 'notices'
  | 'notice-alerts'
  | 'app-settings'

/** 위젯의 줄 수. 한 줄에 칸 다섯 */
export type QuickLinkRows = 1 | 2

export interface QuickLinksConfig {
  rows: QuickLinkRows
  /** 위젯에 놓이는 차례 그대로. 길이는 `rows × 5` 를 넘지 않는다 */
  ids: QuickLinkId[]
}
