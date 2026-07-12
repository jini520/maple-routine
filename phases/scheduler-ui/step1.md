# Step 1: app-shell

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — `app/`이 "라우트별 화면 (React Router)"라는 설명
- `src/App.tsx`, `src/app/onboarding/OnboardingScreen.tsx` — 현재 `App.tsx`는 항상 `<OnboardingScreen />`만 렌더링한다. `OnboardingScreen`은 마운트 시 `restoreFromStorage()`를 직접 호출한다.
- `src/features/onboarding/store.ts` — `useOnboardingStore`의 `status`(`'awaitingApiKey' | 'verifyingApiKey' | 'selectingAccount' | 'completed' | 'error'`)와 `restoreFromStorage(): Promise<void>`

`react-router-dom`은 이미 설치돼 있다(package.json 확인).

## 배경

지금까지는 화면이 온보딩 하나뿐이라 라우팅이 필요 없었다. 이번 step부터 일간(`/daily`)·주간(`/weekly`) 화면이 추가되므로 실제 라우팅을 도입한다.

**라우트 구성**:
- `/onboarding` → `OnboardingScreen`. 단, `status === 'completed'`면 `/daily`로 리다이렉트한다(온보딩이 이미 끝났는데 이 경로에 남아있지 않도록).
- `/daily` → `DailyScreen`(다음 step에서 만들 예정 — 이번 step에서는 아직 없으니 임시 placeholder만 넣어도 된다). 단, `status !== 'completed'`면 `/onboarding`으로 리다이렉트한다.
- `/weekly` → `WeeklyScreen`(마찬가지로 다음 step 몫, 이번 step은 placeholder). 같은 리다이렉트 규칙.
- `/` → `status === 'completed'`면 `/daily`로, 아니면 `/onboarding`으로 리다이렉트.
- `status === 'completed'`일 때만 보이는 간단한 내비게이션(예: "일간"/"주간" 링크 두 개)을 화면 상단에 둔다. 디자인은 최소한으로 — 아직 `UI_GUIDE.md`가 없다.

**CRITICAL — `restoreFromStorage()` 호출 위치를 옮겨라**: 지금 `OnboardingScreen`이 마운트 시 직접 호출하고 있는데, 이번 step부터는 라우팅 최상위(예: `App.tsx`의 최상위 컴포넌트)에서 **한 번만** 호출하도록 옮겨라. `OnboardingScreen`에서는 그 호출을 제거하라. 이유: 최상위 라우팅이 리다이렉트 여부를 판단하려면 `restoreFromStorage()`가 끝난 뒤의 `status`를 알아야 하는데, `OnboardingScreen`은 `/onboarding` 경로일 때만 마운트되므로 다른 경로(`/`, `/daily`)에 있을 때는 호출되지 않아 복원이 안 될 수 있다. 최상위에서 한 번만 호출하고 모든 라우트 가드가 그 결과(`status`)를 공유해서 참조하게 하라.

## 작업

`src/App.tsx`를 다시 작성하라(`BrowserRouter`/`Routes`/`Route`/`Navigate` 사용):
- 최상위 컴포넌트가 마운트 시 1회 `useOnboardingStore().restoreFromStorage()`를 호출한다.
- 위 "라우트 구성"을 그대로 구현한다. `/daily`·`/weekly`의 실제 화면은 다음 step들이 채울 것이므로, 이번 step에서는 각각 아주 단순한 placeholder(`<p>일간 화면 준비 중</p>` 등)만 넣어도 된다 — 파일 위치는 `src/app/daily/DailyScreen.tsx`/`src/app/weekly/WeeklyScreen.tsx`로 미리 만들어 다음 step이 그 안을 채우게 하라.
- `status === 'completed'`일 때만 보이는 내비게이션을 추가한다.

`src/app/onboarding/OnboardingScreen.tsx`에서 `restoreFromStorage` 관련 `useEffect`를 제거하라(상위로 옮겼으므로). 다른 로직은 그대로 둔다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `restoreFromStorage()`가 앱 전체에서 정확히 한 곳(최상위)에서만 호출되는가?
   - `/daily`·`/weekly`·`/onboarding`·`/` 네 경로 모두 `status`에 따른 리다이렉트 규칙이 정확히 구현됐는가?
3. `src/__tests__/App.test.tsx`(`// @vitest-environment jsdom`)에 테스트를 먼저 작성한 뒤(TDD) 구현하라. `src/features/onboarding/store`를 `vi.mock`으로 모킹해 원하는 `status`를 스텁하고, `MemoryRouter`(또는 동등한 테스트용 라우터)로 특정 경로에서 시작시켜 검증하라(react-router 테스트 시 실제 `BrowserRouter` 대신 `MemoryRouter` 계열을 쓰는 것이 일반적이니, `App.tsx`가 라우터 자체를 감싸고 있다면 테스트에서 라우터만 분리해 감쌀 수 있는 구조로 만들어도 된다 — 재량).
   - `status: 'awaitingApiKey'`일 때 `/daily`로 접근하면 온보딩으로 리다이렉트된다.
   - `status: 'completed'`일 때 `/onboarding`으로 접근하면 `/daily`로 리다이렉트된다.
   - `status: 'completed'`일 때 내비게이션(일간/주간 링크)이 보인다.
   - 마운트 시 `restoreFromStorage`가 정확히 1번 호출된다.
4. 결과에 따라 `phases/scheduler-ui/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성/수정한 파일과 라우트 규칙을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `restoreFromStorage()`를 `OnboardingScreen`과 최상위 양쪽에서 중복 호출하지 마라. 이유: 세션 복원 중이면 Nexon API가 두 번 불필요하게 호출된다.
- `DailyScreen`/`WeeklyScreen`의 실제 내용(스토어 연결, 콘텐츠 목록 렌더링)을 이번 step에서 만들지 마라. 이유: 그건 다음 두 step의 몫이고, 이번 step은 라우팅 뼈대만 다룬다.
- 기존 테스트를 깨뜨리지 마라(단, `OnboardingScreen`의 `restoreFromStorage` 호출 제거로 인해 기존 `OnboardingScreen` 테스트가 그 호출을 검증하고 있었다면, 그 부분만 이번 변경에 맞게 고쳐도 된다).
