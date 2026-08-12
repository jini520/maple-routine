/**
 * `@core/lib/theme-backgrounds` 의 RN 대체 — `core-shims.js` 가 번들러 수준에서 이 파일로 갈아끼운다
 * (왜 갈아끼우는지는 그 파일에 있다).
 *
 * **시그니처는 한 글자도 다르지 않다**([[ADR-128]] 원칙 1). 부르는 쪽(`buildThemeCss`)은 자기가
 * 어느 구현을 쓰는지 모른다.
 *
 * ## 지금은 항상 `null` 이다
 *
 * 원본이 돌려주는 것은 CSS `url()` 에 넣을 **문자열 URL** 인데, RN 에는 CSS 배경이 없다 — 벽지는
 * `<Image source={require(...)} />` 로 그린다. 즉 이 함수의 반환 타입 자체가 웹 전용이라, RN 에서
 * 정직하게 채울 값이 없다. 그리고 Metro 는 `require()` 경로를 **정적으로** 알아야 해서 슬러그로 파일을
 * 찾는 원본의 방식(`import.meta.glob`)을 그대로 옮길 수도 없다.
 *
 * `null` 은 원본이 이미 정의해 둔 정상 경로다 — *"슬러그에 해당하는 파일이 없으면 `null`(배경만
 * 사라지고 테마는 그대로 산다)"*. 그래서 `buildThemeCss` 는 `--theme-bg-*` 를 **한 줄도 내지 않고**
 * ([[ADR-088]] 결정 3), 테마 색 38토큰은 전부 그대로 흐른다.
 *
 * **대가**: 배경을 가진 두 테마(혼테일·검은마법사, [[ADR-108]]·[[ADR-109]])가 RN 에서 `bg` 단색으로
 * 열린다. 테마 배경 백드롭(`ThemeHeaderBackdrop` 포함)은 뷰 레이어라 그것을 만들 때 이 파일이 함께
 * 채워진다 — 그때 필요한 것은 URL 문자열이 아니라 슬러그 → `require()` 매핑이므로, 이 함수가 아니라
 * 별개 API 가 생길 가능성이 크다. 조용히 잊히지 않게 `src/__tests__/core-shims.test.ts` 가 이 상태를
 * 테스트로 적어 둔다.
 */
export function getThemeBackgroundUrl(slug: string): string | null {
  void slug
  return null
}
