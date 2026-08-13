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
 */
export interface ScreenBottomInset {
  /** 스크롤포트를 화면 바닥에서 이만큼 올려 끝낸다. */
  portBottomPx: number
  /** 스크롤 콘텐츠 끝에 남기는 여백. */
  contentBottomPx: number
}

export function resolveScreenBottomInset(options: {
  /**
   * 아래에 탭바가 있는가. `true` 면 **둘 다 0 이다** — 탭 내비게이터가 이미 탭바를 뺀 상자를 화면에
   * 주고, 홈 인디케이터는 탭바가 자기 패딩으로 처리한다. 웹에서 `--tab-bar-h` 를 실측해 스크롤포트를
   * 줄이던 일([[ADR-099]] 결정 7)이 RN 에서는 구조로 해결된다 — 잴 것도, 어긋날 것도 없다.
   */
  hasTabBar: boolean
  /** `useSafeAreaInsets().bottom`. */
  bottomInsetPx: number
  /** `Platform.OS`. */
  platform: string
}): ScreenBottomInset {
  if (options.hasTabBar) return { portBottomPx: 0, contentBottomPx: 0 }

  return options.platform === 'ios'
    ? { portBottomPx: 0, contentBottomPx: options.bottomInsetPx }
    : { portBottomPx: options.bottomInsetPx, contentBottomPx: 0 }
}
