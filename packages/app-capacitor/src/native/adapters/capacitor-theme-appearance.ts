import { buildThemeCss } from '@core/lib/theme-registry'
import type { ThemeAppearancePort } from '@core/native/ports'

/** 주입한 테마 변수 스타일 태그의 id — 전환할 때 이 하나만 갈아끼운다. */
const THEME_STYLE_ID = 'theme-vars'

/**
 * 테마를 문서에 반영한다 — 웹뷰 구현([[ADR-127]]). 전에는 `features/theme/store.ts` 안에 있었다.
 *
 * 선택한 테마의 34토큰을 `<style>` 태그 하나로 주입한다([[ADR-064]] 결정 10). 전에는 `index.css` 에
 * 테마별 `:root[data-theme]` 블록을 손으로 적었는데, 테마를 수십 개로 늘릴 계획이라 그 방식으로는
 * 감당이 안 된다. 이제 `job-themes.json` 을 읽어 규칙을 만들어 붙인다 — 번들 CSS 뒤에 오므로
 * `@theme` 기본값(머쉬맘)을 덮는다. 일러스트 카드용 `.media-scope` 규칙도 같은 태그에 함께 들어간다.
 *
 * 라이트/다크는 테마 데이터의 `mode` 가 정한다(옛 `DARK_THEMES` Set 수동 관리 폐기, 결정 8).
 * `data-theme` 속성은 이제 스타일에 쓰이지 않지만, 지금 어떤 테마인지 눈으로 확인할 수 있게
 * 계속 붙여둔다.
 */
export const capacitorThemeAppearancePort: ThemeAppearancePort = {
  apply: (theme, definition) => {
    let style = document.getElementById(THEME_STYLE_ID)
    if (style === null) {
      style = document.createElement('style')
      style.id = THEME_STYLE_ID
      document.head.append(style)
    }
    style.textContent = buildThemeCss(definition)

    document.documentElement.dataset.theme = theme
    // 라이트/다크를 **CSS 선택자로도** 노출한다([[ADR-122]]). 토큰만으로 못 푸는 규칙이 있다 —
    // 스크림 위 패널 테두리처럼 **같은 토큰이 모드에 따라 반대 역할**을 하는 자리다. 테마 이름으로
    // 분기하면 [[ADR-064]] 결정 8이 폐기한 `DARK_THEMES` 수동 목록이 CSS 쪽에 되살아난다.
    document.documentElement.dataset.mode = definition.mode

    const isDark = definition.mode === 'dark'
    // 테마의 라이트/다크를 **CSS 에도** 알린다([[ADR-099]]). 브라우저는 스크롤 인디케이터·폼
    // 컨트롤처럼 우리가 그리지 않는 UI 크롬의 색을 이 값으로 고른다 — 안 걸어두면 자기 기본값을
    // 쓰고, 화면 스크롤 컨테이너에서는 그것이 **흰 인디케이터**로 드러났다(실기기 관측
    // 2026-08-06). 문서 스크롤일 때는 WebKit 이 페이지 배경색에서 유추해 우연히 맞았을 뿐이라,
    // 이건 컨테이너가 만든 문제가 아니라 원래 비어 있던 선언이다.
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
    // `color-scheme` 만으로는 **라이트 테마에서 인디케이터가 흰색으로 남았다**(실기기 2026-08-06 —
    // 다크 테마는 정상). 요소 스크롤러의 인디케이터 색을 WebKit 이 무엇으로 정하는지에 의존하지
    // 말고 표준 프로퍼티로 직접 지정한다. 값은 iOS 기본 인디케이터와 같은 반투명 무채색이고
    // 트랙은 없다.
    document.documentElement.style.scrollbarColor = isDark
      ? 'rgba(255, 255, 255, 0.35) transparent'
      : 'rgba(0, 0, 0, 0.35) transparent'
  },
}
