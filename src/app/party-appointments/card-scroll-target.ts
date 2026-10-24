/**
 * 시간표 막대를 눌러 목록 카드로 갈 때의 스크롤 자리.
 *
 * 헤더가 있는 화면은 스크롤 영역이 화면 맨 위(상태 표시줄 밑)부터라, 상단 안전영역을 빼야 카드가 다이내믹 아일랜드와 페이드 밑에 숨지 않는다.
 * 안전영역은 헤더 여백과 같은 `useTopSafeAreaPx()` 의 값이어야 한다. 인셋을 그대로 쓰면 안드로이드에서 하한이 빠진다.
 */
export function cardScrollY(options: {
  /** 스크롤 내용 맨 위부터 카드 윗변까지 */
  cardY: number
  topSafeAreaPx: number
  /** 카드 위에 남기는 여백 */
  gapPx: number
}): number {
  return Math.max(0, options.cardY - options.topSafeAreaPx - options.gapPx)
}
