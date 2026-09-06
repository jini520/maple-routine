/**
 * 테마 38토큰을 CSS 커스텀 프로퍼티 이름과 값의 맵으로 내는 함수. NativeWind 의 `vars()` 가 그
 * 맵을 받아 렌더 트리에 내려보내고 `className` 이 `var(--color-*)` 로 읽는다.
 *
 * 문자열을 만들지 않는다. `ThemeDefinition extends ThemeTokens` 라 굳기 전의 값이 이미 객체로 있다.
 *
 * ⚠️ **이름 규칙이 한 글자도 달라선 안 된다.** `tailwind.config.js` 가 만든 유틸리티가
 * `var(--color-surface-2)` 를 참조하는데 여기서 `--color-surface2` 를 내면 색이 조용히 사라진다.
 * NativeWind 는 못 찾은 변수를 버린다.
 */

import { hexToOklch, oklchToHex, parseHex, toHex, withLightness } from '../lib/color'
import { THEME_TOKEN_KEYS, deriveMediaScope } from '../lib/theme/theme-derive'
import type { ThemeDefinition } from '../types/theme'

/** `mediaInkMuted` → `--color-media-ink-muted`. core 의 `toCustomPropertyName` 과 같은 규칙이다. */
export function toColorVariableName(token: string): string {
  return `--color-${token.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()}`
}

/**
 * 스크림 위 패널의 테두리. RN 에는 선택자가 없어서 값으로 만든다.
 *
 * 라이트에서 합성된 중간 회색 위에 테두리를 녹이는 계산이다. 그 결과를 토큰 하나로 미리 만들어
 * 두면 호출부는 `border-panel-border` 라고만 쓰면 되고, 모드 분기는 이 함수 안에서 딱 한 번
 * 일어난다.
 *
 * 분기 기준은 반드시 `definition.mode` 다. 테마 이름으로 가르면 `DARK_THEMES` 수동 목록이
 * 되살아난다. 테마를 수십 개로 늘릴 계획이라 특히 안 된다.
 *
 * 다크에서 테두리를 그대로 두는 것도 결정이다. 그쪽은 패널과 배경 대비가 1.07~1.18 이라 경계를
 * 그리는 것이 테두리뿐이다. 라이트에서만 `text` 쪽으로 눌러 합성된 배경색에 가라앉힌다.
 */
export const PANEL_BORDER_TOKEN = 'panel-border'

/** 라이트에서 `border` 를 `text` 쪽으로 미는 비중. 실기기에서 세 번 만에 잡은 값. */
const PANEL_BORDER_RATIO = 0.4

/**
 * `color-mix(in srgb, base <ratio>%, other)` 와 같은 계산.
 *
 * core 의 `mixOklab` 을 쓰지 않는 것은 이 값들을 **`in srgb`** 로 잡았기 때문이다
 * (틴트 파생은 `in oklab` 이라 색 공간이 다르다). 색 공간을 바꾸면 실기기에서 확정한
 * 세 값이 전부 달라진다.
 */
function mixSrgb(base: string, other: string, ratio: number): string {
  const a = parseHex(base)
  const b = parseHex(other)
  const channel = (x: number, y: number): number => x * ratio + y * (1 - ratio)

  return toHex({
    r: channel(a.r, b.r),
    g: channel(a.g, b.g),
    b: channel(a.b, b.b),
  })
}

export function resolvePanelBorder(definition: ThemeDefinition): string {
  return definition.mode === 'light'
    ? mixSrgb(definition.border, definition.text, PANEL_BORDER_RATIO)
    : definition.border
}

/**
 * 펼친 캐릭터 카드의 **본문 바탕**. 보스 목록이 앉는 면이다.
 *
 * 38토큰에는 이 자리에 맞는 색이 없다. 카드(`surface`)와도 페이지(`bg`)와도 갈려야 하는데
 * `surface-2` 는 그 조건은 만족하지만 라이트에서 칙칙한 청회색이고, `bg` 를 쓰면 본문이 페이지에
 * 녹는다. 그래서 `panel-border` 와 같은 방식으로 모드에서 파생해 만든다.
 *
 * 두 모드가 하는 일이 다르다(사용자 지정).
 *
 * - **라이트**: 배경보다 **연한 파스텔**. 밝기를 페이지와 카드 사이에 앉히고 메인 컬러의
 *   색상만 아주 옅게 얹는다. 테마를 따라가므로 어느 테마에서도 그 테마의 색이 된다.
 * - **다크**: 배경보다 **조금 밝은 톤온톤**. 밝기만 한 단 올리고 색상·채도는 카드에서 가져와
 *   같은 계열로 남긴다.
 */
export const CARD_BODY_TOKEN = 'card-body'

/** 라이트에서 페이지→카드 사이 어디에 앉힐지. 0.5 면 한가운데다. */
const CARD_BODY_LIGHT_RATIO = 0.4
/**
 * 라이트에서 **페이지까지 합친** 채도의 상한. 이보다 높으면 색면이 된다.
 *
 * 패널의 채도를 상수로 두면 안 된다. 페이지가 이미 물든 테마(엔젤릭버스터의 `#F9E9F1`)에서
 * 분홍 위에 분홍이 되어 진해진다. 페이지가 낸 만큼을 빼고 **모자란 만큼만** 얹는다.
 */
const CARD_BODY_LIGHT_CHROMA = 0.03
/** 페이지가 이미 상한만큼 물들어 있어도 패널이 흰색과는 갈려야 한다. */
const CARD_BODY_LIGHT_CHROMA_FLOOR = 0.008
/** 다크에서 배경보다 올리는 밝기. 카드와도 최소 0.02 는 갈리는 값이다(테마 여섯 실측). */
const CARD_BODY_DARK_STEP = 0.04

export function resolveCardBody(definition: ThemeDefinition): string {
  const bg = hexToOklch(definition.bg)
  const surface = hexToOklch(definition.surface)

  if (definition.mode === 'light') {
    return oklchToHex({
      // 카드가 페이지보다 어두운 테마가 와도 **배경보다 연한** 것은 지켜야 하므로 폭을 절댓값으로 쓴다.
      l: bg.l + Math.abs(surface.l - bg.l) * CARD_BODY_LIGHT_RATIO,
      c: Math.max(CARD_BODY_LIGHT_CHROMA - bg.c, CARD_BODY_LIGHT_CHROMA_FLOOR),
      h: hexToOklch(definition.primary).h,
    })
  }

  return oklchToHex({ l: bg.l + CARD_BODY_DARK_STEP, c: surface.c, h: surface.h })
}

/**
 * `:root` 에 해당하는 변수 맵. 38토큰 + 모드에서 파생되는 `--color-panel-border`.
 *
 * 배경 이미지(`--theme-bg-*`)는 내지 않는다. RN 은 벽지를 CSS 배경이 아니라 `<Image>` 로 그리므로
 * 값의 형태 자체가 다르다. 로 에셋이 들어온 뒤에도 그대로다(core 는 `url("…")` 을
 * 내지만 RN 에서 그 안의 값은 URL 문자열이 아니다). 그리는 것은 `ThemeBackdrop` 몫이고,
 * **그리는 곳은 그 하나뿐이다**.
 */
export function buildThemeVariables(definition: ThemeDefinition): Record<string, string> {
  const variables: Record<string, string> = {}
  for (const token of THEME_TOKEN_KEYS) {
    variables[toColorVariableName(token)] = definition[token]
  }
  variables[toColorVariableName(PANEL_BORDER_TOKEN)] = resolvePanelBorder(definition)
  variables[toColorVariableName(CARD_BODY_TOKEN)] = resolveCardBody(definition)
  return variables
}

/**
 * 시트 스코프. 미디어 스코프와 같은 기법, 다른 목적이다.
 *
 * `BottomSheet` 의 몸통이 `definition.bg` 면 자기가 덮고 있는 페이지와 같은 토큰이다. 스크림을
 * 합성한 배경과 견주면 다크에서 대비가 1.03~1.05 다(라이트는 같은 코드가 4.18~4.29).
 *
 * 스크림 쪽으로는 못 고친다. 다크의 `bg` 는 이미 OKLCH L 0.13~0.15 라 그 아래 여유가 없어,
 * 백드롭을 완전 불투명 검정으로 만들어도 대비는 1.07 이 천장이다. 라이트가 멀쩡한 이유도 같다.
 * 거기는 L 0.95 에서 0.55 까지 0.40 을 내려갈 수 있다. 그래서 고칠 곳은 시트이고, 다크에서
 * 떠 있음은 어둡게가 아니라 밝게로 만든다.
 *
 * 넷을 함께 올린다. 몸통만 올리면 시트 안 `bg-surface` 타일이 몸통과 같은 색이 되고, 몸통을
 * 더 올리면 이번엔 타일이 몸통보다 어두워진다. 계열째 올려야 안쪽의 위아래 관계가 그대로
 * 남는다. 그래서 시트 안 코드는 한 줄도 안 고친다.
 *
 * 라이트는 안 건드린다. 대비가 이미 멀쩡하고 한 칸 더 올리면 `#FFFFFF` 에 부딪혀 눌린다.
 * 분기 재료는 반드시 `definition.mode` 다. 다만 라이트에서도 넷을 다 낸다. 값이 같아 재선언이
 * 무해하고 호출부에 모드 분기가 안 생긴다.
 */
const SHEET_SCOPE_TOKENS = ['bg', 'surface', 'surface2', 'track'] as const

/**
 * 한 칸. `deriveMediaScope` 가 카드 안 `surface → surface-2` 를 벌릴 때 쓰는 폭과 **같은 수**다.
 *
 * 새 눈금을 만들지 않는다. 이 앱에서 표면 한 단계 는 이미 이 값이고, 두 벌이 되면 어느 쪽이
 * 진짜인지 알 수 없게 된다(테스트가 두 값의 일치를 지킨다).
 */
export const SHEET_LIFT = 0.09

export function buildSheetScopeVariables(definition: ThemeDefinition): Record<string, string> {
  const lift = (hex: string): string =>
    definition.mode === 'dark' ? withLightness(hex, hexToOklch(hex).l + SHEET_LIFT) : hex

  return Object.fromEntries(
    SHEET_SCOPE_TOKENS.map((token) => [toColorVariableName(token), lift(definition[token])]),
  )
}

/**
 * `.media-scope` 에 해당하는 변수 맵.
 *
 * 일러스트 카드 안은 바탕이 `surface` 가 아니라 `mediaSurface` 라 표면·텍스트·완료 배지를 **다시
 * 선언**해야 한다. 커스텀 프로퍼티는 선언된 요소에서 `var()` 가
 * 해석된다")가 RN 에서도 **그대로 성립한다**. `vars()` 는 렌더 트리를 따라 상속되고 하위에서 같은
 * 이름을 다시 선언하면 그 서브트리만 새 기준을 쓴다.
 */
export function buildMediaScopeVariables(definition: ThemeDefinition): Record<string, string> {
  const scope = deriveMediaScope(definition, definition.mode)
  return Object.fromEntries(
    Object.entries(scope).map(([token, value]) => [toColorVariableName(token), value]),
  )
}
