// NativeWind(Tailwind v3) 설정 — `withNativeWind` 가 이 파일을 찾아 Tailwind CLI 에 넘긴다.
//
// **테마와 무관한 축**(간격·radius·container)은 웹이 쓰는 Tailwind v4 의 `theme.css` 에서 판다
// (`tailwind-v4-axes.cjs` — 왜 그런 다리가 필요한지도 거기 적혀 있다).
//
// ── 색은 값이 아니라 `var()` 를 가리킨다 ─────────────────────────────────────────────
//
// 색 38종은 테마마다 다르고 런타임에 바뀐다. 그래서 유틸리티에는 **값 대신 변수 참조**를 넣고
// (`bg-primary` → `background-color: var(--color-primary)`), 실제 값은 `ThemeProvider` 가
// NativeWind 의 `vars()` 로 렌더 트리에 내려보낸다. 웹의 구조(`@theme` 이 만든 유틸리티 +
// `<style id="theme-vars">` 가 덮는 변수)와 **같은 모양**이라, `className` 을 그대로 옮길 수 있다 —
// 그것이 step 3~6 의 163곳을 싸게 만드는 전제다([[ADR-128]] 3단계).
//
// 이름은 손으로 적지 않고 **`job-themes.json` 의 키에서 판다**([[ADR-064]] 결정 10 — 테마 추가는
// JSON 한 블록이고 개별 파일을 손으로 동기화하지 않는다). 베껴 두면 토큰이 하나 늘 때 여기만 빠져
// 그 클래스가 **조용히 사라진다**(변수를 못 찾으면 스타일 속성 자체가 빠진다).
//
// 이름 규칙(camelCase → kebab)이 `src/theme/theme-vars.ts` 에도 있는 것은 CJS 가 TS 를 못 읽기
// 때문이고, 두 벌이 갈라지는 것은 `src/theme/__tests__/theme-vars.test.ts` 가 막는다(이 파일의
// `theme.colors` 키와 그쪽이 내는 변수 이름을 직접 대조한다).
const jobThemes = require('../core/src/data/job-themes.json')
const { theme } = require('../../tailwind-v4-axes.cjs')

/** `job-themes.json` 항목에서 색 토큰이 **아닌** 필드. 나머지는 전부 38토큰이다. */
const NON_TOKEN_FIELDS = new Set(['mode', 'category', 'background'])

/** `mediaInkMuted` → `media-ink-muted`. */
function toKebabCase(token) {
  return token.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()
}

/** 등록된 테마 **전부**의 키를 합집합으로 모은다 — 한 테마만 보면 선택 필드를 놓친다. */
const tokenNames = [
  ...new Set(Object.values(jobThemes).flatMap((definition) => Object.keys(definition))),
]
  .filter((field) => !NON_TOKEN_FIELDS.has(field))
  .map(toKebabCase)

const colors = {
  // 테마를 안 따라가는 셋. 값이 그대로 RN 색이라 `var()` 를 거치지 않는다.
  // `current`·`inherit` 은 **일부러 뺐다** — RN 에 `currentColor` 개념이 없어 넣어도 무효한 색이
  // 되고, 그러면 "클래스는 있는데 색은 없는" 상태가 된다. 웹에서 `bg-current` 를 쓰는 한 자리는
  // 컴포넌트를 옮길 때 명시 토큰으로 바꾼다.
  transparent: 'transparent',
  white: '#fff',
  black: '#000',
  ...Object.fromEntries(tokenNames.map((name) => [name, `var(--color-${name})`])),
  // 38토큰에 없고 **모드에서 파생되는** 토큰 — 스크림 위 패널 테두리([[ADR-122]]). 웹은 선택자로
  // 풀지만 RN 에는 선택자가 없어 값으로 만든다(`src/theme/theme-vars.ts`).
  'panel-border': 'var(--color-panel-border)',
}

module.exports = {
  // `global.css` 의 `@source` 가 아니라 여기서 스캔 범위를 정한다(v3 방식). `android/`·`ios/` 를
  // 안 훑도록 두 갈래만 적는다.
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // `extend` 가 아니라 **교체**다 — `extend` 로 더하면 v3 의 옛 계단(`rounded-sm` = 2px)이 남아
  // 웹과 다른 값이 그대로 산다. 색도 같은 이유로 교체다: v3 기본 팔레트(`red-500` 등)를 남겨 두면
  // 테마를 안 따라가는 색을 쓰고도 빌드가 성공한다.
  theme: { ...theme, colors },
}
