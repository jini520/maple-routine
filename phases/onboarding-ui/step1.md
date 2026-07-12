# Step 1: onboarding-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — `app/`이 `features/`의 상태를 구독해 렌더링만 담당한다는 규칙
- `src/features/onboarding/state.ts` — `OnboardingStatus`(`'awaitingApiKey' | 'verifyingApiKey' | 'selectingAccount' | 'completed' | 'error'`), `OnboardingState`, `OnboardingError`
- `src/features/onboarding/store.ts` — `useOnboardingStore`(Zustand 훅). `OnboardingStore`는 `OnboardingState`를 확장해 `restoreFromStorage(): Promise<void>`, `submitApiKey(apiKey: string): Promise<void>`, `selectAccount(accountId: string): Promise<void>`, `reset(): Promise<void>`를 제공한다.
- `src/app/onboarding/ApiKeyForm.tsx`, `src/app/onboarding/AccountSelectionList.tsx`, `src/app/onboarding/error-message.ts` — 이전 step(`onboarding-components`)에서 만든 프레젠테이션 컴포넌트와 에러 문구 헬퍼. 정확한 props 시그니처를 그 파일에서 직접 확인하라.
- `src/App.tsx` — 현재 Vite 스캐폴드 기본 내용(placeholder `<p>메이플 루틴</p>`). 이번 step에서 실제 온보딩 화면을 마운트하도록 교체한다.

## 배경

이번 step은 `useOnboardingStore`를 실제로 구독해서, `OnboardingStatus`에 따라 이전 step의 프레젠테이션 컴포넌트 중 알맞은 것을 골라 렌더링하는 컨테이너 컴포넌트를 만든다. **컨테이너는 상태 분기와 스토어 연결만 하고, 입력 폼 UI 자체(텍스트박스 마크업 등)는 만들지 마라 — 그건 이미 이전 step에서 끝났다.**

**status별 렌더링 분기 (정확히 지켜라)**:
- `awaitingApiKey` → `ApiKeyForm`(`isSubmitting={false}`, `errorMessage={null}`, `onSubmit={submitApiKey}`)
- `verifyingApiKey` → 폼이 아니라 단순 로딩 표시("확인 중입니다..." 등 텍스트나 스피너 하나면 충분, 과한 디자인 넣지 마라)
- `selectingAccount` → `AccountSelectionList`(`accounts`, `isSubmitting={false}`, `errorMessage={null}`, `onSelect={selectAccount}`)
- `completed` → 다른 화면이 아직 없으므로 "연동이 완료됐습니다" 같은 최소 placeholder 텍스트만(다음 task에서 실제 목적지 화면으로 교체될 것 — 지금 새 화면을 만들지 마라)
- `error` — **분기가 두 갈래다**: `state.accounts.length === 0`이면 아직 API 키 검증 단계에서 실패한 것이므로 `ApiKeyForm`(`errorMessage={formatOnboardingError(state.error)}`)을 다시 보여주고, `state.accounts.length > 0`이면 계정 선택 단계(저장 실패 등)에서 실패한 것이므로 `AccountSelectionList`(`errorMessage={formatOnboardingError(state.error)}`)를 다시 보여준다. 두 경우 모두 `isSubmitting={false}`로 재시도 가능하게 하라.

**마운트 시점에 한 번**(컴포넌트가 처음 렌더링될 때) `restoreFromStorage()`를 호출해 저장된 세션을 복원 시도하라 — 재호출을 막기 위해 `useEffect`의 의존성 배열을 빈 배열로 둬라.

## 작업

`src/app/onboarding/OnboardingScreen.tsx`:
```ts
export function OnboardingScreen(): JSX.Element
```
- `useOnboardingStore()`로 상태와 액션을 구독한다.
- `useEffect(() => { restoreFromStorage() }, [])`로 마운트 시 1회 복원을 시도한다.
- 위 "status별 렌더링 분기"를 그대로 구현한다.

`src/App.tsx`를 수정해 기존 placeholder 대신 `<OnboardingScreen />`을 렌더링하도록 교체하라. 최상위 레이아웃(배경색 등 기존 wrapper `div`)은 유지해도 되고 `OnboardingScreen`으로 옮겨도 된다 — 재량.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `OnboardingScreen`이 5가지 status를 전부 분기하는가, 특히 `error`의 두 갈래(계정 목록 유무에 따른 분기)를 정확히 구현했는가?
   - `restoreFromStorage()`가 마운트 시 정확히 1번만 호출되는가(의존성 배열 빈 배열)?
   - 이전 step의 컴포넌트(`ApiKeyForm`/`AccountSelectionList`)를 수정하지 않고 그대로 재사용했는가?
3. `src/app/onboarding/__tests__/OnboardingScreen.test.tsx`(`// @vitest-environment jsdom`)에 테스트를 먼저 작성한 뒤(TDD) 구현하라. `src/features/onboarding/store`를 `vi.mock`으로 모킹해(Zustand 훅을 각 테스트에서 원하는 상태를 반환하도록 스텁) 최소 다음을 검증하라:
   - 마운트 시 `restoreFromStorage`가 정확히 1번 호출된다.
   - `status: 'awaitingApiKey'`일 때 `ApiKeyForm`이 렌더링된다.
   - `status: 'selectingAccount'`일 때 `AccountSelectionList`가 렌더링된다.
   - `status: 'error'`이고 `accounts: []`일 때 `ApiKeyForm`이 렌더링된다.
   - `status: 'error'`이고 `accounts`가 비어있지 않을 때 `AccountSelectionList`가 렌더링된다.
4. 결과에 따라 `phases/onboarding-ui/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성/수정한 파일과 핵심 분기 로직을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `ApiKeyForm.tsx`/`AccountSelectionList.tsx`의 내부 마크업을 고치지 마라. 이유: 이 step은 연결(wiring)만 다루고, 컴포넌트 자체는 이전 step에서 이미 완성됐다.
- `completed` 상태를 위한 새 화면(예: 캐릭터 목록 화면)을 만들지 마라. 이유: 다른 기능은 별도 task 범위다 — 지금은 placeholder면 충분하다.
- `restoreFromStorage`를 렌더링마다 반복 호출하게 만들지 마라(`useEffect` 의존성 배열을 빈 배열로 고정). 이유: 매 렌더링마다 Nexon API를 재호출하면 불필요한 네트워크 호출과 상태 진동이 생긴다.
- 기존 테스트를 깨뜨리지 마라.
