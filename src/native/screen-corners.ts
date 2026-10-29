import { getScreenCornersPort } from './ports'

/** 화면 모서리 반경(pt). 모르면 `null`, 각진 화면은 0. 바텀시트가 아래 모서리를 화면 곡률에 맞출 때 읽는다 */
export function screenCornerRadius(): number | null {
  return getScreenCornersPort().radius()
}
