# Step 1: theme-system

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- **`/docs/features/theme.md`** (테마 정책 — 정독하라)
- `/docs/foundation/design-system.md`
- `/docs/ADR.md` 에서 **[[ADR-127]] · [[ADR-009]] · [[ADR-064]] · [[ADR-099]] · [[ADR-104]] · [[ADR-122]]** 만 열어라
- `packages/core/src/features/theme/store.ts` (**포트를 부르는 쪽**)
- `packages/core/src/lib/theme-registry.ts` (`buildThemeCss` — 웹이 쓰는 것)
- `packages/core/src/types/theme.ts` (`ThemeDefinition extends ThemeTokens`)
- `packages/core/src/data/job-themes.json` (**[[ADR-006]] 대상 — 값을 바꾸지 마라**)
- `packages/app-capacitor/src/native/adapters/capacitor-theme-appearance.ts` (**참조 구현 — 무엇을 하는지 전부 읽어라**)
- `packages/app-rn/src/native/adapters/not-implemented.ts` (지금 던지고 있는 자리)
- **이전 step 산출물**: NativeWind 설정 · 공유 Tailwind 토큰 · 스냅샷 관례

## 배경

**`ThemeAppearancePort` 를 해소한다.** 지금 RN 구현은 *"단계 3에서 재설계된다"* 며 던지고 있다.

웹 구현이 하는 일은 넷이다.

| | 하는 일 | RN 대응 |
|---|---|---|
| 1 | `buildThemeCss(definition)` 를 `<style>` 태그에 주입 | **CSS 가 없다** — 아래 §1 |
| 2 | `data-theme` 속성 (눈으로 확인용) | 불필요 |
| 3 | `data-mode` 속성 ([[ADR-122]] — 같은 토큰이 모드에 따라 반대 역할) | 모드 값을 상태로 노출 |
| 4 | `colorScheme` · `scrollbarColor` ([[ADR-099]] 실기기에서 흰 인디케이터 관측) | RN 은 스크롤 인디케이터를 prop 으로 정한다 |

### 요점 — 토큰은 이미 구조화된 데이터다

`ThemeDefinition extends ThemeTokens` 다. 즉 **CSS 문자열을 만들기 전의 값이 이미 객체로 있다.**
RN 은 `buildThemeCss` 를 부를 이유가 없고 `definition` 을 그대로 소비하면 된다.

**`buildThemeCss` 를 지우지 마라** — `app-capacitor` 가 계속 쓴다.

## 작업

### 1. 테마를 React 상태로 내려라

RN 에서 테마 적용은 **side-effect 가 아니라 상태**다. `ThemeProvider`(이름은 재량)가
`features/theme/store.ts` 의 현재 테마를 구독해 `ThemeDefinition` 을 context 로 내려주고, 컴포넌트가
그것을 읽는 구조로 만들어라.

**`features/theme/store.ts` 를 고치지 마라.** 그 파일은 `packages/core` 에 있고 `app-capacitor` 와
공유된다. 시그니처도 동작도 그대로다([[ADR-127]] 결정 4).

### 2. `ThemeAppearancePort` 의 RN 구현

포트는 `apply(theme, definition)` 을 요구한다. RN 구현은 그 값을 **위 상태로 흘려보내는 것**이 일이다
(전역 저장소든 이벤트든 재량). `not-implemented.ts` 에서 이 포트를 빼고 `boot.ts` 배선을 갱신하라.

**포트 인터페이스를 바꾸지 마라.** `packages/core` 는 수정 대상이 아니다.

### 3. 토큰을 NativeWind 가 쓰게 하라

step 0 이 공유한 것은 테마 무관 축(간격·타이포)이었다. **색은 테마마다 바뀐다** — 런타임에 바뀌는
값을 NativeWind 가 어떻게 읽게 할지 정하고 근거를 summary 에 적어라(CSS 변수 방식, 인라인 스타일
병용 등 — NativeWind 버전이 지원하는 범위에서).

되도록 **`className` 을 그대로 쓸 수 있는 쪽**을 골라라. 그것이 step 3~6 의 163곳을 싸게 만드는
전제다.

### 4. [[ADR-122]] 의 모드 분기를 잃지 마라

*"같은 토큰이 모드에 따라 반대 역할을 하는 자리"* 가 있다 — 스크림 위 패널 테두리가 그 예다.
웹은 `data-mode` 선택자로 풀었다. RN 에는 선택자가 없으니 **모드를 읽어 분기하는 방법**을 마련하라.

**테마 이름으로 분기하지 마라.** [[ADR-064]] 결정 8이 폐기한 `DARK_THEMES` 수동 목록이 되살아난다.
분기는 반드시 `definition.mode` 로 한다.

### 5. 테스트

- `ThemeDefinition` 이 바뀌면 소비자가 새 값을 받는가
- `mode` 가 `'dark'`/`'light'` 일 때 [[ADR-122]] 분기가 갈리는가
- `job-themes.json` 의 실제 테마 몇 개로 토큰이 흘러가는가 (**값을 손으로 적지 말고 데이터에서 읽어라**)

## Acceptance Criteria

```bash
npm test           # vitest 199파일/3044개(증감 0) + jest 전부 통과
npm run build      # app-capacitor 영향 없음 — buildThemeCss 가 살아 있어야 한다
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo export --platform android --output-dir /tmp/rn-theme-check
```

포트가 더 이상 던지지 않는지:

```bash
grep -n "ThemeAppearance" packages/app-rn/src/native/adapters/not-implemented.ts   # 없어야 한다
grep -n "setThemeAppearancePort" packages/app-rn/src/boot.ts                        # 실구현을 넣어야 한다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `packages/core` 를 수정했는가? **했다면 잘못된 것이다**(`features/theme/store.ts`·`theme-registry`·포트 전부)
   - 모드 분기를 **테마 이름**으로 하지 않았는가? ([[ADR-064]] 결정 8)
   - `job-themes.json` 의 값을 바꾸지 않았는가? ([[ADR-006]])
   - `app-capacitor` 의 테마가 여전히 동작하는가? (`npm run dev` 로 부팅 확인)
3. `phases/rn-components/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "테마 상태 구조·NativeWind 색 연결 방식과 근거·ADR-122 모드 분기 방법"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

**"테마가 화면에 제대로 보인다"고 쓰지 마라.** 아직 화면이 없다. 확인한 것은 값이 흐르는 것까지다.

## 금지사항

- **`packages/core` 를 수정하지 마라.** `features/theme/store.ts`·`lib/theme-registry.ts`·
  `native/ports.ts` 전부. 이유: `app-capacitor` 와 공유되고, 고치면 배포 중인 앱이 함께 바뀐다.
- **`buildThemeCss` 를 지우거나 바꾸지 마라.** 이유: 웹 앱이 계속 쓴다.
- **`job-themes.json` 의 색 값을 바꾸지 마라.** 이유: [[ADR-006]] — 값은 사람이 확인해 커밋한 것이다.
- **모드 분기를 테마 이름 목록으로 하지 마라.** 이유: [[ADR-064]] 결정 8이 폐기한 `DARK_THEMES`
  수동 관리가 되살아난다. 테마를 늘릴 때마다 목록을 고쳐야 하고, 빠뜨리면 조용히 틀린다.
- **컴포넌트를 옮기지 마라.** step 3 부터다.
- 기존 테스트를 깨뜨리지 마라.
