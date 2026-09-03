/**
 * 안전영역 페이드. 덮는 것이 아니라 **콘텐츠의 알파를 깎는** 계산.
 *
 * 콘텐츠가 크롬과 겹치는 자리에서 알파를 0 으로 보낸다. 위는 상태바 밑, 아래는 홈 인디케이터
 * 자리다.
 *
 * **스크림이 아니다.** 그라디언트를 덮는 길이 더 싸지만 그것은 스크롤과 무관하게 늘 보이는 띠다.
 * 알파를 깎으면 뒤의 벽지가 그대로 남고 스크롤 0 에서는 화면이 한 픽셀도 안 바뀐다.
 *
 * 이 파일이 갖는 것은 값 둘이다. 어디를(`resolveSafeAreaFade`)과 어떻게(`FADE_MASK_*`). 그리는
 * 일은 `ScreenScroll` 이 한다.
 */

import type { ScreenBottomInset } from './bottom-inset'

/**
 * 떠 있는 바 위로 페이드가 얼마나 올라가는가. 바 몫의 절반.
 *
 * 0 이면 콘텐츠가 선명한 채로 캡슐 밑에 들어간다. 바 전체면 캡슐 윗변에서 이미 완전히
 * 투명하지만 너무 높아 목록의 마지막 두 카드쯤이 늘 흐릿하다. 절반이면 캡슐 한가운데에서 0
 * 이라, 콘텐츠는 캡슐에 닿기 전에 옅어지기 시작하고 흐려지는 구간은 바 뒤에 대부분 숨는다.
 *
 * 바 높이에서 파생시킨다. 숫자를 따로 적으면 바 높이가 바뀔 때 둘이 어긋난다.
 */
function barFadePx(barSpacePx: number): number {
  return barSpacePx / 2
}

export interface SafeAreaFade {
  /** 화면 위 끝에서 이만큼이 페이드 구간이다. 0이면 상단은 깎지 않는다. */
  topPx: number
  /** 화면 아래 끝에서 이만큼. 0이면 하단은 깎지 않는다. */
  bottomPx: number
}

/**
 * 페이드 길이. 콘텐츠가 크롬과 겹치는 자리에만 둔다.
 *
 * | | 값 | 0 이 되는 경우 |
 * |---|---|---|
 * | 상단 | 상단 안전영역(안드로이드는 하한 48) | 헤더가 없는 화면. 셸이 스크롤포트를 그만큼 내려, 깎으면 콘텐츠의 첫 줄을 깎는다 |
 * | 하단 | 하단 안전영역(안드로이드는 하한 34) + 바의 절반(탭 화면) | 안드로이드 3버튼 내비의 하위 페이지. 스크롤포트가 이미 인셋 위에서 끝난다 |
 *
 * 하단이 안전영역 위로 올라가는 것이 요점이다. 안전영역까지만 두면 콘텐츠가 선명한 채로 캡슐
 * 밑에 들어가고 녹는 것은 이미 바가 가린 뒤가 된다. 콘텐츠가 크롬과 처음 겹치는 자리는 바닥이
 * 아니라 바의 윗변이다. 다만 바 전체만큼 올리면 너무 높아 절반만 올린다.
 *
 * 안전영역 몫에서 `portBottomPx` 를 뺀다. 스크롤포트가 이미 그만큼 위에서 끝났으면 그 자리에
 * 깎을 콘텐츠가 없다. 그 판정을 여기서 다시 적지 않고 `bottom-inset.ts` 의 값을 받는 것은 값이
 * 두 벌이 되면 한쪽만 고쳐도 페이드가 빈 자리를 깎거나 겹치는 자리를 놓치기 때문이다.
 */
export function resolveSafeAreaFade(options: {
  /** 헤더를 받았는가. 상단 안전영역을 누가 먹는지가 여기서 갈린다(`ScreenScroll` 의 계약). */
  hasHeader: boolean
  /** 아래에 떠 있는 바가 있는가. 페이드가 안전영역 위로 얼마나 올라가는지가 갈린다. */
  hasTabBar: boolean
  /**
   * `useTopSafeAreaPx()`. **인셋이 아니다**. 안드로이드는 하한 48 이다.
   *
   * 이름이 아래 `insetBottomPx` 와 갈리는 것이 일부러다. 이 값은 헤더 패딩과 **같은 함수**에서
   * 와야 하고(제목 윗변 = 이 페이드의 끝선), 인셋을 그대로 넣으면 안드로이드에서 페이드가 제목보다
   * 16.7px 짧아져 그 선이 갈라진다.
   */
  topSafeAreaPx: number
  /**
   * `useBottomSafeAreaPx()`. 인셋이 아니다. 안드로이드는 하한 34 다.
   *
   * 위 `topSafeAreaPx` 와 같은 사정이다. 이 값은 떠 있는 바가 뜨는 높이와 같은 함수에서 와야
   * 하고, 인셋을 그대로 넣으면 안드로이드에서 페이드가 캡슐 한가운데보다 19px 아래에서 0 이
   * 되어 콘텐츠가 선명한 채로 캡슐에 들어간다.
   */
  bottomSafeAreaPx: number
  /** 떠 있는 바가 먹는 세로 몫. `bottom-inset.ts` 에 넘기는 값과 **같은 값**이어야 한다. */
  barSpacePx: number
  /** `resolveScreenBottomInset()` 이 정한 값. 스크롤포트가 이미 비운 몫은 깎을 것이 없다. */
  portBottomPx: ScreenBottomInset['portBottomPx']
}): SafeAreaFade {
  return {
    topPx: options.hasHeader ? options.topSafeAreaPx : 0,
    bottomPx:
      Math.max(0, options.bottomSafeAreaPx - options.portBottomPx) +
      (options.hasTabBar ? barFadePx(options.barSpacePx) : 0),
  }
}

/**
 * 정지점 아홉. 구간 선형 근사라 개수가 곧 매끄러움이다.
 *
 * 곡선에 딸린 값이지 취향이 아니다. 곡선을 제곱해 가팔라지면 다섯으로는 오차가 3.5% → 6.1%
 * 로 커지고, 아홉이 그것을 2.0% 로 되돌린다. 곡선을 더 세게 바꾸면 이 개수도 함께 올려야 하고,
 * 그 관계는 `safe-area-fade.test.ts` 가 오차를 직접 계산해 지킨다.
 */
const STOP_COUNT = 9

/**
 * `expo-linear-gradient` 가 요구하는 둘 이상의 튜플. 개수가 `STOP_COUNT` 에서 나오므로
 * 타입만으로는 그것을 못 보이고, 그래서 아래 값들이 `as` 로 좁혀진다.
 */
type AtLeastTwo<T> = readonly [T, T, ...T[]]

/**
 * 페이드 곡선의 정지점(0 → 1). `LinearGradient` 의 `locations` 로 그대로 나간다.
 */
export const FADE_MASK_LOCATIONS = Array.from(
  { length: STOP_COUNT },
  (_, i) => i / (STOP_COUNT - 1),
) as unknown as AtLeastTwo<number>

/**
 * 각 정지점의 마스크 알파 = smoothstep 의 제곱(`(3t²−2t³)²`).
 *
 * 마스크 한 겹이면 곡선을 직접 고를 수 있고, smoothstep 은 양 끝의 기울기가 0 이라 페이드가
 * 시작·끝나는 선이 안 보인다. 선형은 끝에서 기울기가 꺾여 옅은 주름이 남는데, 그 주름이 이
 * 페이드가 없애려는 딱 끊김 의 작은 판본이다.
 *
 * 제곱은 더 강하게를 그 성질을 깨지 않고 하는 방법이다. 구간 한가운데 알파가 0.5 → 0.25 로
 * 내려가 대부분이 거의 투명해지는데, `(s²)' = 2s·s'` 라 양 끝 기울기는 여전히 0 이다. 알파를
 * 상수로 누르거나(`s·k`) 구간을 잘라 옮기면 끝점이나 기울기가 깨져 선이 보인다.
 */
export const FADE_MASK_ALPHAS = FADE_MASK_LOCATIONS.map(
  (t) => (t * t * (3 - 2 * t)) ** 2,
) as unknown as AtLeastTwo<number>

/**
 * 페이드 구간 **밖**. 콘텐츠가 그대로 보이는 자리. 마스크는 알파만 읽으므로 색은 아무 불투명한
 * 값이어도 되지만, 그라디언트와 같은 검정으로 두어 이 판은 색을 나르지 않는다 를 한눈에 둔다.
 */
export const FADE_MASK_OPAQUE = '#000'

/**
 * 마스크 그라디언트의 색. **검정의 알파뿐**이다.
 *
 * 색이 섞이는 순간 그것은 콘텐츠를 깎는 것이 아니라 화면을 덮는 스크림이 되고, 벽지 위에
 *  이 걷어낸 띠를 만든다. 그 실수는 **벽지 없는 테마 넷에서는 눈으로 구분되지 않아서**
 * 색을 만드는 자리를 곡선 옆에 둔다. 두 값이 한 파일에 있으면 여기는 알파만 나른다 가 한 번만
 * 읽히면 된다.
 *
 * @param direction `'in'` 은 화면 끝에서 안쪽으로 **드러나는** 쪽(상단), `'out'` 은 그 반대(하단).
 *   화면 끝이 알파 0인 것은 위아래가 같고, 뒤집히면 그림이 조용히 정반대가 된다.
 */
export function fadeMaskColors(direction: 'in' | 'out'): AtLeastTwo<string> {
  const alphas = direction === 'in' ? FADE_MASK_ALPHAS : [...FADE_MASK_ALPHAS].reverse()
  return alphas.map((alpha) => `rgba(0, 0, 0, ${alpha})`) as unknown as AtLeastTwo<string>
}
