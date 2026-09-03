/**
 * 화면 하단 인셋을 스크롤포트에서 뺄 몫과 콘텐츠 여백으로 남길 몫으로 가르는 계산.
 *
 * | 조각 | 무엇 | 콘텐츠가 |
 * |---|---|---|
 * | 스크롤포트에서 뺀다 | 안드로이드 3버튼 내비 높이 | 지나가면 안 된다. 버튼 사이로 글자가 비친다 |
 * | 콘텐츠 여백으로 남긴다 | 홈 인디케이터 · 제스처 핸들 | 지나가도 된다 |
 *
 * 여백을 스크롤포트가 아니라 **콘텐츠**에 넣는다. 스크롤 가능한 높이가 그만큼 늘어나야 끝의 여백이
 * 되고, 스크롤포트를 줄이면 그냥 화면이 작아진다.
 *
 * ⚠️ **RN 은 3버튼과 제스처를 구분하지 못한다.** 바닥 인셋 하나만 준다. 높이로 어림잡는 것은
 * 금지라 **플랫폼으로 가른다**. iOS 는 인셋의 정체가 홈 인디케이터뿐이라 전부 통과시키고,
 * 안드로이드는 모르므로 보수적인 쪽을 고른다. 대가는 제스처 기기 바닥에 배경색 띠가 남는 것이다.
 *
 * 하한이 더한 몫은 인셋이 아니라 리듬이라 지나가도 되는 쪽에 든다. 그것까지 막으면 제스처 기기의
 * 띠가 그만큼 커진다.
 */
export interface ScreenBottomInset {
  /** 스크롤포트를 화면 바닥에서 올릴 양. */
  portBottomPx: number
  /** 스크롤 콘텐츠 끝에 남기는 여백. */
  contentBottomPx: number
}

export function resolveScreenBottomInset(options: {
  /**
   * 아래에 탭바가 있는가.
   *
   * 떠 있는 바는 화면 위에 있어 콘텐츠가 그 아래로 지나간다. 그래서 스크롤포트는 그대로 두고
   * (`portBottomPx: 0`) 콘텐츠 끝에 바의 몫 + 안전영역을 남긴다.
   *
   * 안드로이드 3버튼 내비가 지나가면 안 되는 조각인 것은 그대로지만, 떠 있는 바가 그 위에 있어
   * 콘텐츠가 거기까지 닿지 않는다. 그래서 여기서도 조각을 가르지 않고 한 값으로 더한다.
   */
  hasTabBar: boolean
  /**
   * `useSafeAreaInsets().bottom`. 내비바가 실제로 차지하는 자리다.
   *
   * 안드로이드 하위 페이지에서만 쓴다. 그 한 자리가 이 함수에서 지나가면 안 되는 조각이고,
   * 나머지는 전부 아래 `bottomSafeAreaPx` 가 정한다.
   */
  insetBottomPx: number
  /**
   * `useBottomSafeAreaPx()`. **인셋이 아니다**. 안드로이드는 하한 34 다.
   *
   * 이름이 위 `insetBottomPx` 와 갈리는 것이 일부러다. 이 값은 떠 있는 바가 뜨는 높이와 **같은
   * 함수**에서 와야 하고(콘텐츠 끝 = 바의 윗변), 인셋을 그대로 넣으면 안드로이드 제스처 기기에서
   * 마지막 카드가 19px 만큼 캡슐 뒤로 들어간다.
   *
   * **`insetBottomPx` 보다 작지 않다**(`resolveBottomSafeAreaPx` 가 `Math.max` 라서). 아래
   * 안드로이드 분기의 뺄셈이 그 성질에 기댄다.
   */
  bottomSafeAreaPx: number
  /**
   * 떠 있는 바가 먹는 세로 몫. `resolveBottomBarMetrics(창 폭).spacePx`.
   *
   * 상수로 두면 `BottomBar` 의 `BAR_HEIGHT + LIFT` 와 같은 값이어야 한다 는 약속을 손으로
   * 지켜야 하는데, 그 값이 기기마다 달라진 뒤로는 손으로 옮길 수 없다. 어긋나면 콘텐츠가 바
   * 뒤로 들어가거나(작으면) 바닥에 빈 띠가 남는다(크면).
   *
   * `hasTabBar` 가 거짓이면 안 쓴다. 하위 페이지에는 바가 없다.
   */
  barSpacePx: number
  /** `Platform.OS`. */
  platform: string
}): ScreenBottomInset {
  if (options.hasTabBar) {
    return { portBottomPx: 0, contentBottomPx: options.bottomSafeAreaPx + options.barSpacePx }
  }

  return options.platform === 'ios'
    ? { portBottomPx: 0, contentBottomPx: options.bottomSafeAreaPx }
    : {
        portBottomPx: options.insetBottomPx,
        contentBottomPx: options.bottomSafeAreaPx - options.insetBottomPx,
      }
}
