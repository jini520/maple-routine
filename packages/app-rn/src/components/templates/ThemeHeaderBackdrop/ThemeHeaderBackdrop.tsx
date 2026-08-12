import { useThemeAppearance } from '../../../theme/context'

/**
 * 페이지 상단 헤더가 덮는 자리에 **테마 배경 이미지 조각**을 그린다([[ADR-088]] 결정 5-1).
 *
 * 헤더는 불투명해야 한다 — 반투명하게 열면 배경만이 아니라 **그 밑으로 스크롤된 카드까지** 비친다
 * (사용자 반려). 그래서 헤더를 여는 대신, 헤더가 자기 자리에 해당하는 그림을 직접 그려 백드롭과
 * 이어 붙인다. 정렬은 조각을 **뷰포트 크기**로 그리고 부모가 잘라내는 방식으로 보장한다(`cover` 는
 * 그리는 상자 기준이라 헤더 상자에 주면 배율이 어긋난다).
 *
 * ## 지금은 **항상 아무것도 그리지 않는다** — 에셋 레이어를 기다린다
 *
 * 두 갈래로 갈리고 오늘은 둘 다 `null` 이다.
 *
 * | 테마 | 웹 | RN |
 * |---|---|---|
 * | 배경 선언 없음(넷) | 조각 없음 | **같다** — DOM 이 늘지 않는다 |
 * | 배경 선언 있음(혼테일·검은마법사) | 조각을 그린다 | **아직 안 그린다** |
 *
 * 두 번째 칸의 이유가 [[ADR-129]] 로 바뀌었다. **그림은 이제 번들에 있다** —
 * `getThemeBackgroundUrl` 이 진짜 에셋 참조를 돌려준다(전에는 항상 `null` 이었다). 남은 것은
 * **그리는 일**이다: RN 은 벽지를 CSS 배경이 아니라 `<Image>` 로 앉히므로 `buildThemeCss` 의
 * `--theme-bg-*` 를 그대로 쓸 수 없고(그 값이 RN 에선 URL 문자열이 아니다), RN 쪽 변수 맵은 색만
 * 낸다(`theme/theme-vars.ts`). 그래서 앱은 여전히 그 두 테마를 `bg` 단색으로 연다.
 *
 * 첫 번째 칸의 판정은 **지금도 진짜로 한다.** 그것이 이 파일이 `return null` 한 줄이 아닌 이유다 —
 * 조건은 웹과 같은 곳(`definition.background`)에서 읽고, 두 번째 칸의 몸통만 채우면 된다. 그리는
 * 형태는 `absolute inset-0 overflow-hidden` 안에 뷰포트 크기 `<Image resizeMode="cover">` +
 * `dim` 오버레이이고, `source` 에는 `getThemeBackgroundUrl(slug)` 을 그대로 넘긴다.
 * `size`·`position`·`dim` 값은 지금도 진짜다.
 *
 * ## 순서만으로 충분하다 — `z-index: -1` 이 필요 없다
 *
 * 웹은 조각을 헤더 **자신의 배경 위, 콘텐츠 아래**에 두려고 `z-index: -1` 을 썼다. RN 에서는 형제
 * 순서가 곧 그리는 순서라, 헤더의 **첫 자식**으로 두면 같은 결과가 나온다(웹 주석의 *"형제보다 먼저
 * 놓는다"* 가 여기서는 관례가 아니라 메커니즘이다).
 */
export function ThemeHeaderBackdrop(): React.JSX.Element | null {
  const { definition } = useThemeAppearance()

  // 배경을 선언하지 않은 테마 — 웹과 같은 이유로 아무것도 그리지 않는다(뷰가 늘지 않는다).
  if (definition.background === undefined) return null

  // 선언한 둘도 오늘은 그릴 것이 없다(파일 머리). 여기가 에셋 레이어의 자리다.
  return null
}
