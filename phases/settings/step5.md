# Step 5: settings-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/PRD.md`의 "6. 설정 화면" 섹션, "확인이 필요한 사항" #39~42(진입 경로는 이미 하단 탭으로 확정됐고, 계정 변경 시 재입력 불필요도 확정됐다 — 이 두 항목은 더 이상 열린 질문이 아니다)
- `/docs/ARCHITECTURE.md`의 "[설정 화면 — ...]" 데이터 흐름 블록, `App.tsx` 라우팅 구조를 설명하는 부분
- `/docs/UI_GUIDE.md`의 "온보딩 예열 진행률 바" 섹션(예열 진행률 UI를 그대로 재사용)
- `src/App.tsx` (이번 step에서 라우트·탭을 추가할 파일)
- `src/__tests__/App.test.tsx` (이번 step에서 함께 갱신할 테스트 — 기존 mock 패턴을 그대로 따른다)
- `src/features/settings/store.ts`, `src/features/settings/state.ts` (Step 2, 3에서 만든 `useSettingsStore`/`SettingsStatus`/`SettingsError`)
- `src/features/theme/store.ts` (Step 1에서 만든 `useThemeStore`)
- `src/app/settings/ThemeSelector.tsx`, `src/app/settings/DisconnectConfirm.tsx` (Step 4에서 만든 컴포넌트, 그대로 재사용)
- `src/app/onboarding/ApiKeyForm.tsx`, `src/app/onboarding/AccountSelectionList.tsx`, `src/app/onboarding/error-message.ts`, `src/app/onboarding/OnboardingScreen.tsx` (재사용/참고할 기존 컴포넌트와 status 분기 렌더링 패턴)

## 작업

### 1. `src/app/settings/error-message.ts` (신규)

```ts
export function formatSettingsError(error: SettingsError): string
```

`src/app/onboarding/error-message.ts`의 `formatOnboardingError`와 내용은 동일하지만(같은 4개 kind, 같은 문구), `SettingsError` 타입을 받는 별도 파일로 새로 작성한다 — import해서 재사용하지 않는다(Step 3에서 정한 "settings는 onboarding 내부를 참조하지 않는다" 원칙을 UI 레이어에도 동일하게 적용).

### 2. `src/app/settings/SettingsScreen.tsx` (신규)

`useSettingsStore()`와 `useThemeStore()`를 구독하는 화면 컴포넌트. 3개 섹션을 세로로 배치한다(`space-y-4`, 기존 화면들과 동일한 페이지 패딩 `p-4`):

**계정 섹션** (`SettingsStore.status`에 따라 분기):
- 공통: "API 키 변경" 버튼, "계정 변경" 버튼을 상단에 둔다. "API 키 변경" 클릭 시 로컬 state(`showApiKeyForm`)를 토글해 `ApiKeyForm`을 인라인으로 펼치고, 제출되면 `settingsStore.changeApiKey(apiKey)`를 호출한다. "계정 변경" 클릭 시 바로 `settingsStore.refreshAccounts()`를 호출한다(별도 폼 없음 — 저장된 키를 그대로 쓰므로).
- `status === 'selectingAccount'`: `AccountSelectionList`를 렌더링, `accounts`/`errorMessage`(= `formatSettingsError(error)` 또는 `null`)/`isSubmitting`(= `false`, 이 상태 자체가 이미 선택 대기 중이므로) props를 전달하고 `onSelect`는 `settingsStore.selectAccount`.
- `status === 'prefetching'`: "온보딩 예열 진행률 바"(`docs/UI_GUIDE.md`) 컴포넌트를 그대로 재사용해 `role="progressbar"` + `aria-valuenow`/`aria-valuemin`/`aria-valuemax`로 `prefetchProgress`를 표시한다(새 컴포넌트를 만들지 말고 `OnboardingScreen.tsx`가 이미 쓰고 있는 마크업을 그대로 옮겨온다).
- `status === 'error'`: `formatSettingsError(error)` 메시지와 "다시 시도" 버튼(클릭 시 `settingsStore.reset()`)을 보여준다.
- `status === 'verifying'`: 위 두 버튼을 `disabled`로 만들어 중복 제출을 막는다.

**테마 섹션**: `<ThemeSelector theme={themeStore.theme} onSelect={themeStore.selectTheme} />`

**연결 해제 섹션**: "연결 해제" 버튼(로컬 state `isDisconnectOpen`을 `true`로) + `<DisconnectConfirm isOpen={isDisconnectOpen} isDisconnecting={...} onConfirm={...} onCancel={...} />`. `onConfirm`은 `settingsStore.disconnect()`를 호출한다 — **호출 후 수동으로 라우팅하지 않는다**: `disconnect()`가 내부적으로 `useOnboardingStore`의 `status`를 되돌리면, `App.tsx`의 기존 라우트 가드(`isCompleted ? <SettingsScreen/> : <Navigate to="/onboarding" replace/>`)가 자동으로 온보딩 화면으로 리다이렉트한다.

### 3. `src/App.tsx` 수정

- `import { Settings } from 'lucide-react'` 추가, `TAB_ITEMS`에 `{ to: '/settings', label: '설정', Icon: Settings }`를 마지막 항목으로 추가.
- `import { SettingsScreen } from './app/settings/SettingsScreen'` 추가.
- `<Routes>` 안에 기존 `/profit` 라우트와 동일한 패턴으로 추가:
  ```tsx
  <Route
    path="/settings"
    element={isCompleted ? <SettingsScreen /> : <Navigate to="/onboarding" replace />}
  />
  ```

### 4. `src/__tests__/App.test.tsx` 수정

- `useSettingsStore`(`../features/settings/store`)와 `useThemeStore`(`../features/theme/store`)를 기존 3개 스토어와 동일한 방식(`vi.mock` + `mockedUse...Store.mockReturnValue(...)`)으로 모킹하는 코드를 추가한다. `useSettingsStore`는 `status: 'idle'`, 빈 `accounts`, `null` `error`/`prefetchProgress`와 5개 액션 전부 `vi.fn()`으로, `useThemeStore`는 `theme: '렌'`과 `restoreFromStorage`/`selectTheme`을 `vi.fn()`으로 채운다.
- 기존 `'status가 completed일 때 하단 탭바(컨텐츠/보스/수익 탭)가 보인다'` 테스트에 "설정" 탭 존재 검증을 추가하거나, 별도 테스트로 `screen.getByRole('link', { name: '설정' })`를 검증한다.
- `/settings` 경로에 대한 리다이렉트 테스트(미완료 시 온보딩으로) + 완료 시 정상 진입 테스트를 기존 `/profit` 테스트와 동일한 패턴으로 추가한다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `SettingsScreen.tsx`가 `storage/`·`nexon/`을 직접 import하지 않고 `features/settings`·`features/theme`을 통해서만 접근하는가?
   - 기존 `/content`·`/boss`·`/profit` 라우트의 동작(가드, 리다이렉트)이 그대로 유지되는가?
3. `src/app/settings/__tests__/SettingsScreen.test.tsx`(신규)에 다음을 검증한다(`useSettingsStore`/`useThemeStore`를 모킹):
   - `status: 'selectingAccount'`일 때 `AccountSelectionList`가 렌더링됨
   - `status: 'prefetching'`일 때 진행률 바(`role="progressbar"`)가 렌더링됨
   - `status: 'error'`일 때 에러 메시지와 "다시 시도" 버튼이 렌더링되고, 클릭 시 `settingsStore.reset`이 호출됨
   - "연결 해제" 버튼 클릭 → `DisconnectConfirm`이 열리고, 확인 클릭 시 `settingsStore.disconnect`가 호출됨
   - 테마 버튼 클릭 시 `themeStore.selectTheme`가 호출됨
4. `npm test`로 `src/__tests__/App.test.tsx`를 포함한 전체 테스트가 통과하는지 확인한다.
5. 결과에 따라 `phases/settings/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `formatOnboardingError`를 import해서 재사용하지 마라 — `formatSettingsError`를 새로 작성한다.
- `disconnect()` 이후 `navigate('/onboarding')` 같은 수동 라우팅 코드를 넣지 마라 — 기존 라우트 가드가 자동으로 처리한다(중복 라우팅은 깜빡임이나 이중 네비게이션을 유발할 수 있다).
- 기존 `/content`·`/boss`·`/profit` 라우트나 탭 순서를 바꾸지 마라 — "설정" 탭은 마지막(4번째)에 추가한다.
- 기존 테스트를 깨뜨리지 마라.
