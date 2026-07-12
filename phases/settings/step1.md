# Step 1: theme-runtime

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-009 "재개(2026-07-12, 설정 화면 task 범위 포함)" 문단
- `/docs/ARCHITECTURE.md`의 "테마 시스템 ([[ADR-009]])" 섹션, "상태 관리" 섹션
- `src/index.css` (이번 step에서 수정할 파일 — 현재 `@theme` 블록에 "렌"의 13개 토큰 값이 정적으로 들어있는 상태다. 이 블록은 그대로 두고 오버라이드만 추가한다)
- `src/types/theme.ts`, `src/storage/theme.ts` (이전 step에서 만든 파일 — `ThemeName`/`getTheme`/`setTheme`을 그대로 사용)
- `src/features/onboarding/store.ts` (Zustand 스토어 작성 패턴 참고 — `create<T>()((set, get) => ({...}))` 스타일)
- `src/App.tsx` (이번 step에서 `restoreFromStorage` 호출을 추가할 파일 — `useOnboardingStore`의 `restoreFromStorage()`가 이미 `useEffect`로 호출되는 부분을 참고)

## 배경

Step 0에서 만든 `job-themes.json`은 이번 step에서 런타임 코드가 직접 읽지 않는다 — 값은 `src/index.css`에 CSS로 직접 반영한다(Step 0 step 파일의 "배경" 참고). `job-themes.json`은 이 CSS 값의 근거 자료로만 존재한다.

## 작업

### 1. `src/index.css` 수정

기존 `@theme` 블록(렌 값, 현재 앱의 기본 활성 팔레트)은 값을 바꾸지 않고 그대로 둔다. 그 블록 바로 아래에 레테 오버라이드를 추가한다:

```css
/* 레테(다크) 테마 — 데이터 출처: src/data/job-themes.json, 값 근거는 docs/UI_GUIDE.md "테마 시스템" 표 (ADR-009) */
:root[data-theme='레테'] {
  --color-bg: #0c080f;
  --color-surface: #1a1720;
  --color-surface-2: #28232e;
  --color-border: #37323e;
  --color-border-strong: #54444e;
  --color-primary: #9975b3;
  --color-primary-hover: #85639f;
  --color-primary-text: #61417b;
  --color-secondary: #d1c093;
  --color-info-tint: #c9d6f2;
  --color-error: #d8608f;
  --color-text: #e8dfec;
  --color-text-muted: #b89cbd;
  --color-text-disabled: #8a758d;
}
```

`--color-*` 커스텀 프로퍼티 이름은 `@theme` 블록에 이미 있는 이름(`--color-bg`, `--color-surface-2` 등)과 정확히 동일해야 한다 — Tailwind v4 유틸리티(`bg-primary`, `text-text` 등)가 이 변수명을 그대로 참조하기 때문에 이름이 하나라도 다르면 그 토큰만 조용히 적용되지 않는다.

### 2. `src/features/theme/store.ts` (신규, Zustand)

```ts
export interface ThemeStore {
  theme: ThemeName
  restoreFromStorage(): Promise<void>
  selectTheme(theme: ThemeName): Promise<void>
}

export const useThemeStore = create<ThemeStore>()((set) => ({
  theme: '렌',
  async restoreFromStorage() { /* ... */ },
  async selectTheme(theme) { /* ... */ },
}))
```

- `restoreFromStorage()`: `storage/theme.ts`의 `getTheme()`을 호출해 저장된 값이 있으면 그 값으로, 없으면(`null`) 기본값 `'렌'`을 유지한 채로 DOM에 적용한다.
- `selectTheme(theme)`: `storage/theme.ts`의 `setTheme(theme)`으로 영속화한 뒤 `set({ theme })`으로 상태를 갱신하고 DOM에 적용한다.
- **핵심 규칙 — DOM 적용 로직은 두 함수가 공유하는 내부 헬퍼로 뽑아라** (`applyThemeToDocument(theme: ThemeName): void` 등):
  - `theme === '레테'`이면 `document.documentElement.dataset.theme = '레테'`로 **설정**한다.
  - `theme === '렌'`이면 `delete document.documentElement.dataset.theme`로 속성을 **제거**한다(`'렌'`이라는 문자열을 세팅하지 않는다 — `:root[data-theme='렌']` CSS 규칙 자체가 없고, 기본 `@theme` 블록이 이미 렌 값이므로 속성이 아예 없는 상태가 렌이다).
- 저장 실패(`setTheme` reject) 시 상태를 롤백할 필요는 없다 — 이 앱의 다른 storage 쓰기 실패와 동일하게 예외가 호출부까지 그대로 전파되면 된다(`docs/ARCHITECTURE.md` 에러 핸들링 표의 "로컬 저장소 쓰기 실패" 행 참고, 이 화면의 UI 처리는 이후 step에서 다룬다).

### 3. `src/App.tsx` 수정

`AppShell` 컴포넌트의 기존 `useEffect(() => { restoreFromStorage() }, [])` 옆에, `useThemeStore`의 `restoreFromStorage()`도 호출하도록 추가한다. **온보딩 완료 여부(`isCompleted`)와 무관하게 항상 실행**되어야 한다 — 온보딩 화면 자체도 테마가 적용된 상태로 보여야 하기 때문에, 기존 `useEffect` 안에 나란히 추가하거나 별도 `useEffect`로 추가하되 조건부 렌더링(`isCompleted ? ... : ...`) 바깥에 둔다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `features/theme/store.ts`가 `storage/theme.ts`를 거치지 않고 `@capacitor/preferences`를 직접 호출하지 않는가(어댑터 레이어 우회 금지, CLAUDE.md CRITICAL 규칙)?
   - `App.tsx` 외에 다른 화면 컴포넌트를 건드리지 않았는가?
3. `src/features/theme/__tests__/store.test.ts`(신규, 파일 상단에 `// @vitest-environment jsdom` 필요 — `document` 조작을 검증하므로)에 다음을 검증하는 테스트를 작성한다:
   - 초기 `theme`은 `'렌'`이다
   - `storage/theme.ts`를 모킹해 `getTheme()`이 `'레테'`를 반환하도록 하고 `restoreFromStorage()` 호출 후 `theme === '레테'`이고 `document.documentElement.dataset.theme === '레테'`인지 확인
   - `getTheme()`이 `null`을 반환하면 `restoreFromStorage()` 후에도 `theme === '렌'`이고 `document.documentElement.dataset.theme`이 설정되지 않은 상태(`undefined`)인지 확인
   - `selectTheme('레테')` 호출 시 `storage/theme.ts`의 `setTheme`이 `'레테'`로 호출되고, `document.documentElement.dataset.theme === '레테'`가 되는지 확인
   - `selectTheme('레테')` 이후 `selectTheme('렌')`을 호출하면 `document.documentElement.dataset.theme`이 다시 제거되는지(`undefined`) 확인 — 이 케이스가 위 "핵심 규칙"의 제거 로직을 직접 검증한다
4. 결과에 따라 `phases/settings/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이 step에서는 설정 화면 UI(`app/settings/`, `features/settings/`)를 만들지 마라 — 다음 step들에서 다룬다.
- 기존 `@theme` 블록의 값(렌)을 바꾸지 마라 — 오버라이드 블록만 추가한다.
- `job-themes.json`을 이 step에서 import하지 마라 — CSS 값은 직접 하드코딩한다(Step 0의 "배경" 참고, 이 파일은 현재 런타임에서 소비되지 않는 근거 자료다).
- 기존 테스트를 깨뜨리지 마라.
