/**
 * 화면 하단 인셋을 **두 조각**으로 가른다([[ADR-120]] 결정 16·19).
 *
 * | 조각 | 무엇 | 콘텐츠가 |
 * |---|---|---|
 * | 스크롤포트에서 뺀다 | 안드로이드 3버튼 내비가 차지하는 높이 | **지나가면 안 된다** — 불투명 버튼 사이로 글자가 비친다 |
 * | 콘텐츠 여백으로 남긴다 | 홈 인디케이터·제스처 핸들 | 지나가도 된다 — 끝에 그만큼 여백만 |
 *
 * 여백을 **스크롤포트가 아니라 콘텐츠**에 넣는 것이 결정 16 의 요점이다 — 스크롤 가능한 높이가
 * 그만큼 늘어나야 "끝에 여백"이 되고, 스크롤포트를 줄이면 그냥 화면이 작아진다.
 *
 * ## ⚠️ RN 은 그 둘을 **구분하지 못한다** — 여기가 이 파일이 따로 있는 이유다
 *
 * 웹뷰 구현은 `tappableElement` 인셋으로 갈랐다(3버튼은 실제로 눌리는 영역이고 제스처 핸들은 0이다,
 * `SystemBarsPlugin.calcNavSolidBottom`). `react-native-safe-area-context` 는 그 구분을 주지 않고
 * **바닥 인셋 하나**만 준다.
 *
 * 높이로 어림잡는 것은 [[ADR-120]] 결정 19 가 명시적으로 금지했다(*"높이로 어림잡지 않는다"*).
 * 그래서 **플랫폼으로 가른다** — 각 결정이 실제로 다루던 기기가 그것이다:
 *
 * - **iOS** — 인셋의 정체가 홈 인디케이터 하나뿐이다. 결정 16 그대로 전부 통과시킨다.
 * - **안드로이드** — 3버튼인지 제스처인지 모른다. 모르면 **보수적인 쪽**(결정 19)을 고른다.
 *   대가는 제스처 내비 기기에서 콘텐츠가 지나가도 될 자리를 안 쓰는 것이고(바닥에 배경색 띠가
 *   그만큼 남는다), 반대로 걸었다면 3버튼 기기에서 결정 19 가 거부한 화면이 나온다.
 *
 * 되살리려면 `modules/app-system-bars` 에 `tappableElement` 바닥값을 얹으면 된다 — 그 모듈이 이미
 * 안드로이드 창(window)을 들고 있다. 인셋은 회전·내비 모드 변경으로 바뀌므로 값 하나를 더 읽는
 * 것이 아니라 **구독**이 필요해서, 실기기에서 이 대가가 실제로 거슬리는지 본 뒤에 판단한다.
 *
 * ## 하한이 깔린 뒤로 두 조각은 «인셋» 이 아니라 «안전영역» 을 나눈다 ([[ADR-132]] 정정 31)
 *
 * 안드로이드 하단 안전영역에 하한(34)이 생기면서 위 표의 «안드로이드 = 전부 막는다» 가 두 뜻으로
 * 갈렸다 — 막아야 하는 것은 **내비바가 실제로 차지하는 자리**(인셋)이지 하한이 더한 몫이 아니다.
 * 그 몫은 리듬일 뿐이라 [[ADR-120]] 결정 16 의 «지나가도 되는 여백» 쪽에 든다.
 *
 * 하한을 `portBottomPx` 에 통째로 실었다면 제스처 기기의 스크롤포트가 34 위에서 끝나 위 「대가」의
 * 배경색 띠가 그만큼 커졌을 것이다 — 모르는 것을 보수적으로 다루는 것과 **아는 것까지 보수적으로
 * 다루는 것**은 다르다.
 */
export interface ScreenBottomInset {
  /** 스크롤포트를 화면 바닥에서 이만큼 올려 끝낸다. */
  portBottomPx: number
  /** 스크롤 콘텐츠 끝에 남기는 여백. */
  contentBottomPx: number
}

export function resolveScreenBottomInset(options: {
  /**
   * 아래에 탭바가 있는가.
   *
   * **`true` 의 뜻이 [[ADR-132]] 로 바뀌었다.** 예전 탭바는 화면 상자 밖에 있어 둘 다 0이면 됐지만
   * (탭 내비게이터가 탭바를 뺀 상자를 줬다), 새 바는 **화면 위에 떠 있어** 콘텐츠가 그 아래로
   * 지나간다. 그래서 스크롤포트는 그대로 두고(`portBottomPx: 0`) **콘텐츠 끝에** 바의 몫 + 안전영역을
   * 남긴다 — 결정 16 이 홈 인디케이터에 대해 세운 «지나가도 되는 여백» 과 같은 형태다.
   *
   * 안드로이드 3버튼 내비가 «지나가면 안 되는» 조각인 것은 그대로지만, **떠 있는 바가 그 위에 있어**
   * 콘텐츠가 거기까지 닿지 않는다 — 그래서 여기서도 조각을 가르지 않고 한 값으로 더한다.
   */
  hasTabBar: boolean
  /**
   * `useSafeAreaInsets().bottom` — **내비바가 실제로 차지하는 자리**다(파일 머리 마지막 절).
   *
   * 안드로이드 하위 페이지에서만 쓴다. 그 한 자리가 이 함수에서 «지나가면 안 되는» 조각이고,
   * 나머지는 전부 아래 `bottomSafeAreaPx` 가 정한다.
   */
  insetBottomPx: number
  /**
   * `useBottomSafeAreaPx()` — **인셋이 아니다**([[ADR-132]] 정정 31: 안드로이드는 하한 34).
   *
   * 이름이 위 `insetBottomPx` 와 갈리는 것이 일부러다. 이 값은 떠 있는 바가 뜨는 높이와 **같은
   * 함수**에서 와야 하고(콘텐츠 끝 = 바의 윗변), 인셋을 그대로 넣으면 안드로이드 제스처 기기에서
   * 마지막 카드가 19px 만큼 캡슐 뒤로 들어간다.
   *
   * **`insetBottomPx` 보다 작지 않다**(`resolveBottomSafeAreaPx` 가 `Math.max` 라서) — 아래
   * 안드로이드 분기의 뺄셈이 그 성질에 기댄다.
   */
  bottomSafeAreaPx: number
  /**
   * 떠 있는 바가 먹는 세로 몫 — `resolveBottomBarMetrics(창 폭).spacePx` ([[ADR-132]] 정정 30).
   *
   * **예전에는 이 파일의 상수(`FLOATING_BAR_SPACE_PX = 72`)였다.** 그 주석이 *"`BottomBar.tsx` 의
   * `BAR_HEIGHT + LIFT` 와 같은 값이어야 한다"* 였다는 것이 이 인자의 근거다 — 원래부터 파생값을
   * 손으로 옮겨 적고 테스트로 그 약속을 지키던 자리였고, 정정 30 이 기기마다 다른 값을 만들면서
   * 손으로 옮길 수 없게 됐다. 어긋나면 콘텐츠가 바 뒤로 들어가거나(작으면) 바닥에 빈 띠가
   * 남는다(크면).
   *
   * `hasTabBar` 가 거짓이면 안 쓴다 — 하위 페이지에는 바가 없다([[ADR-120]] 결정 4).
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
