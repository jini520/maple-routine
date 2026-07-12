# Step 0: theme-data-storage

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-009 전체, 특히 마지막 "재개(2026-07-12, 설정 화면 task 범위 포함)" 문단
- `/docs/ARCHITECTURE.md`의 "테마 시스템 ([[ADR-009]])" 섹션 전체
- `/docs/UI_GUIDE.md`의 "테마 시스템 ([[ADR-009]])" 섹션 — 특히 13개 시맨틱 토큰 표(레테/렌 각 컬럼)
- `src/storage/api-key.ts` (이번 step에서 만들 `storage/theme.ts`가 그대로 따라야 할 패턴 — `Preferences.get`/`set`/`remove` 직접 사용, 별도 캐싱 레이어 없음)
- `src/storage/keys.ts` (키 빌더를 추가할 파일)
- `src/types/auth.ts`, `src/types/index.ts` (타입 파일을 어디에 두고 어떻게 재export하는지 스타일 참고)
- `src/storage/__tests__/character-selection.test.ts` (`@capacitor/preferences`를 `Map` 기반으로 모킹하는 기존 테스트 패턴)
- `src/data/__tests__/data-consistency.test.ts` (기존 `src/data/*.json` 값을 검증하는 테스트 스타일 참고 — 이번 step에서 `job-themes.json`용으로 유사한 테스트를 추가한다)

## 배경

설정 화면(신규 핵심 기능 6, `docs/PRD.md` 참고)에 "레테/렌 테마 수동 선택"이 포함되기로 확정되면서, ADR-009에서 보류했던 런타임 다중 테마 인프라 착수를 재개한다. 이번 step은 그 첫 단계로 데이터·저장소 계층만 다룬다 — 런타임에 실제로 테마를 적용하는 로직(CSS 오버라이드, Zustand 스토어)은 다음 step(`theme-runtime`)에서 다룬다.

`job-themes.json`은 이번 CSS 정적 오버라이드 방식에서는 런타임 JS가 직접 import하지 않는다(다음 step에서 `:root[data-theme]` CSS 블록으로 값을 직접 반영한다). 이 파일은 컬러 값의 근거 자료(추후 테마-직업 자동 매핑 작업 시 실제로 소비될 예정, `docs/ADR.md` ADR-009 "여전히 미확정" 참고)로 존재하며, `docs/UI_GUIDE.md` 표 값과 정확히 일치해야 한다 — 이번 step 마지막에 이 일치 여부를 테스트로 고정한다.

## 작업

### 1. `src/types/theme.ts` (신규)

```ts
export type ThemeName = '레테' | '렌'

export interface ThemeTokens {
  bg: string
  surface: string
  surface2: string
  border: string
  borderStrong: string
  primary: string
  primaryHover: string
  primaryText: string
  secondary: string
  infoTint: string
  error: string
  text: string
  textMuted: string
  textDisabled: string
}

export type JobThemes = Record<ThemeName, ThemeTokens>
```

`src/types/index.ts`에 `export * from './theme'` 한 줄을 추가한다(기존 4개 export와 동일한 스타일).

### 2. `src/data/job-themes.json` (신규)

아래 값을 그대로 반영하라(`docs/UI_GUIDE.md` "테마 시스템" 표에서 그대로 옮긴 것 — AI가 임의로 만든 값이 아니다):

```json
{
  "레테": {
    "bg": "#0C080F",
    "surface": "#1A1720",
    "surface2": "#28232E",
    "border": "#37323E",
    "borderStrong": "#54444E",
    "primary": "#9975B3",
    "primaryHover": "#85639F",
    "primaryText": "#61417B",
    "secondary": "#D1C093",
    "infoTint": "#C9D6F2",
    "error": "#D8608F",
    "text": "#E8DFEC",
    "textMuted": "#B89CBD",
    "textDisabled": "#8A758D"
  },
  "렌": {
    "bg": "#F6F5F5",
    "surface": "#FFFFFF",
    "surface2": "#E5E6E9",
    "border": "#DBD3D6",
    "borderStrong": "#C8C1C6",
    "primary": "#DC171D",
    "primaryHover": "#B33946",
    "primaryText": "#803440",
    "secondary": "#437B71",
    "infoTint": "#C9EEF2",
    "error": "#B91C1C",
    "text": "#171721",
    "textMuted": "#525475",
    "textDisabled": "#8A8089"
  }
}
```

### 3. `src/storage/keys.ts`

`STORAGE_KEYS` 객체에 `theme: 'theme'` 필드를 추가한다(기존 `apiKey`/`selectedAccountId`와 같은 레벨).

### 4. `src/storage/theme.ts` (신규)

```ts
export async function getTheme(): Promise<ThemeName | null>
export async function setTheme(theme: ThemeName): Promise<void>
```

- `src/storage/api-key.ts`의 `getAuthConfig`/`setApiKey`와 동일한 패턴으로 `Preferences.get`/`Preferences.set`을 직접 사용한다. 별도 직렬화(`JSON.stringify`) 불필요 — 값 자체가 `'레테'` 또는 `'렌'` 문자열이다.
- **핵심 규칙**: `getTheme`은 저장된 값이 `null`이거나 `'레테'`/`'렌'` 둘 중 하나가 아니면(저장소가 손상되었거나 예전 형식의 값이 남아있는 경우) `null`을 반환한다. 이유: 잘못된 문자열이 그대로 `document.documentElement.dataset.theme`에 흘러 들어가 존재하지 않는 CSS 선택자를 만드는 것을 막기 위함(다음 step에서 소비).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `data/`·`storage/`·`types/` 레이어에만 변경이 있는가(다른 레이어를 건드리지 않았는가)?
   - CLAUDE.md의 "게임 레퍼런스 데이터를 AI가 임의로 추정해 하드코딩하지 말 것" 규칙을 지켰는가 — `job-themes.json` 값이 `docs/UI_GUIDE.md` 표와 정확히 일치하는가?
3. `src/storage/__tests__/theme.test.ts`(신규)에 다음을 검증하는 테스트를 작성한다:
   - 저장 전 `getTheme()`은 `null`을 반환한다
   - `setTheme('레테')` 후 `getTheme()`은 `'레테'`를 반환한다(`'렌'`도 동일하게 검증)
   - `Preferences`에 `'레테'`/`'렌'`이 아닌 임의의 문자열이 저장되어 있으면 `getTheme()`은 `null`을 반환한다
4. `src/data/__tests__/job-themes.test.ts`(신규)에 다음을 검증하는 테스트를 작성한다:
   - `job-themes.json`이 정확히 `'레테'`/`'렌'` 두 키만 가진다
   - 각 테마가 `ThemeTokens`의 14개 필드를 전부 가진다
   - 각 테마의 값이 위 "작업" 섹션에 명시한 값과 정확히 일치한다(하드코딩된 기댓값과 비교 — 데이터가 몰래 바뀌는 것을 막기 위한 회귀 테스트)
5. 결과에 따라 `phases/settings/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이 step에서는 `src/index.css`, `features/theme/`, UI 컴포넌트를 건드리지 마라 — 런타임 적용은 다음 step(`theme-runtime`)에서 한다.
- `job-themes.json`의 값을 표와 다르게 임의로 보정하거나 "더 나아 보이는" 색으로 바꾸지 마라. 표 값을 그대로 옮겨라.
- 기존 `storage/api-key.ts`·`storage/character-selection.ts`의 동작이나 시그니처를 바꾸지 마라.
- 기존 테스트를 깨뜨리지 마라.
