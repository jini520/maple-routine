# Step 1: onboarding-store

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — `features/*` 계층 규칙
- `/docs/ADR.md` — 특히 [[ADR-007]](Nexon Open API 연동 전체)과 [[ADR-008]](에러 핸들링 정책, 특히 "온보딩 중 API 키 저장 실패" 처리)
- `src/features/onboarding/state.ts` — 이전 step(`onboarding-state`)에서 만든 `OnboardingState`/`OnboardingEvent`/`onboardingReducer`/`initialOnboardingState`. **이 step은 반드시 이 리듀서를 통해서만 상태를 바꿔야 한다.**
- `src/nexon/client.ts`, `src/nexon/errors.ts` — `foundation` task에서 만든 `fetchCharacterList(apiKey: string): Promise<MapleAccount[]>`와 에러 클래스 `NexonAuthError`(401/403)·`NexonRateLimitError`(429)·`NexonNetworkError`(그 외 네트워크/파싱 실패). 전부 `NexonApiError`를 상속한다.
- `src/storage/api-key.ts` — `foundation` task에서 만든 `getAuthConfig(): Promise<NexonAuthConfig | null>`, `setApiKey(apiKey: string): Promise<void>`, `setSelectedAccountId(accountId: string | null): Promise<void>`, `clearAuthConfig(): Promise<void>`. `NexonAuthConfig`는 `{ apiKey: string; selectedAccountId: string | null }`이고, `getAuthConfig()`는 `apiKey`가 저장돼 있지 않으면 `null`을 반환한다.

이전 step들에서 만들어진 코드를 꼼꼼히 읽고, 정확한 함수 시그니처를 확인한 뒤 작업하라.

## 배경

이번 step은 `onboarding-state`의 순수 리듀서를 실제 비동기 연동(Nexon API 호출 + 로컬 저장)과 연결하는 Zustand 스토어를 만든다.

**온보딩 흐름 3가지 진입 경로**:
1. **최초 실행**: 저장된 게 없음 → `awaitingApiKey` 상태로 사용자의 API 키 입력을 기다린다.
2. **API 키 최초 제출**: `submitApiKey`로 `fetchCharacterList` 호출 → 성공하면 계정이 1개면 자동 완료, 2개 이상이면 선택 대기(`onboardingReducer`의 `API_KEY_VERIFIED` 규칙 그대로).
3. **앱 재시작 후 복원**: 저장된 `apiKey`가 있으면 재입력 없이 복원한다. 이미 `selectedAccountId`까지 저장돼 있으면 바로 `completed`. `apiKey`만 있고 `selectedAccountId`가 없는 경우(예: 계정 선택 전에 앱이 종료됨)는 `fetchCharacterList`를 다시 호출해 **`submitApiKey`와 동일한 `API_KEY_VERIFIED` 이벤트로 재개**한다 — "계정 1개 자동완료" 규칙이 재개 경로에서도 동일하게 적용돼야 하므로 별도 이벤트를 만들지 말고 반드시 같은 경로를 태워라.

## 작업

`npm install zustand`로 의존성을 추가하라.

`src/features/onboarding/store.ts`를 작성하라:

```ts
export interface OnboardingStore extends OnboardingState {
  restoreFromStorage(): Promise<void>
  submitApiKey(apiKey: string): Promise<void>
  selectAccount(accountId: string): Promise<void>
  reset(): Promise<void>
}

export const useOnboardingStore: /* zustand의 create<OnboardingStore>()(...) 결과 타입 그대로 */
```

**각 메서드가 반드시 지켜야 할 규칙**:

- **`restoreFromStorage()`**: `getAuthConfig()`를 호출한다.
  - `null`이면 아무 이벤트도 디스패치하지 않는다(초기 상태 `awaitingApiKey` 그대로 유지).
  - `selectedAccountId`가 있으면 `RESTORE_COMPLETED` 이벤트를 디스패치한다.
  - `apiKey`만 있고 `selectedAccountId`가 없으면, `SUBMIT_API_KEY`를 디스패치한 뒤 `fetchCharacterList(apiKey)`를 호출하고 위 "배경"에서 설명한 대로 성공 시 `API_KEY_VERIFIED`, 실패 시 `API_KEY_REJECTED`(아래 에러 매핑 규칙 참고)를 디스패치한다.

- **`submitApiKey(apiKey)`**: `SUBMIT_API_KEY`를 디스패치하고 `fetchCharacterList(apiKey)`를 호출한다. 실패하면 에러를 매핑해 `API_KEY_REJECTED`를 디스패치한다. 성공하면 `setApiKey(apiKey)`로 키를 저장한 뒤 `API_KEY_VERIFIED`를 디스패치한다.

- **CRITICAL — `completed` 상태에 도달하는 시점에는 반드시 그 시점의 `selectedAccountId`가 `storage`에 먼저 성공적으로 저장되어 있어야 한다.** 계정이 정확히 1개라 리듀서가 자동으로 `selectedAccountId`를 채워 `completed`로 전이시키는 경우도 예외가 아니다 — `submitApiKey`가 `fetchCharacterList` 결과 계정이 1개뿐인 걸 확인했다면, `API_KEY_VERIFIED`를 디스패치하기 전(또는 직후, 순서는 재량)에 `setSelectedAccountId(accounts[0].accountId)`도 호출해 저장하라. 이 저장이 실패하면 `API_KEY_VERIFIED`를 디스패치하지 말고 대신 `error: { kind: 'storageWriteFailed' }`로 `API_KEY_REJECTED`(또는 `ACCOUNT_SELECTION_FAILED`, 상황에 맞게 재량)를 디스패치해 `completed`로 넘어가지 않게 하라. 이유: [[ADR-008]] "온보딩 중 API 키/계정 저장 실패 시 완료 상태로 넘기지 않고 재시도를 유도한다".

- **`selectAccount(accountId)`**: `setSelectedAccountId(accountId)`를 먼저 호출한다. 성공하면 `SELECT_ACCOUNT` 이벤트를 디스패치한다. 저장이 실패하면 `ACCOUNT_SELECTION_FAILED` 이벤트를(`error: { kind: 'storageWriteFailed' }`) 디스패치한다 — 위와 같은 이유로 저장 성공 전에는 `completed`로 만들지 않는다.

- **`reset()`**: `clearAuthConfig()`를 호출한 뒤 `RESET` 이벤트를 디스패치한다. ([[ADR-007]] "나중에 계정을 변경할 수 있어야 한다" — 설정 화면이 이 메서드를 호출해 온보딩을 처음부터 다시 시작시킬 것이다. 설정 화면 자체는 이 step 범위 밖이다.)

**에러 매핑 규칙** (Nexon 호출 실패 시 `OnboardingError`로 변환):
- `NexonAuthError` → `{ kind: 'invalidApiKey' }`
- `NexonRateLimitError` → `{ kind: 'rateLimited' }`
- 그 외(`NexonNetworkError` 포함 모든 에러) → `{ kind: 'network' }`
- `storage` 쓰기 실패(위 CRITICAL 규칙들) → `{ kind: 'storageWriteFailed' }`

**상태 갱신은 반드시 `onboardingReducer`를 거쳐라** — Zustand의 `set` 안에서 `set((state) => onboardingReducer(state, event))` 형태로 호출하고, 상태 필드(`status`, `accounts` 등)를 리듀서를 거치지 않고 직접 조립해 `set`하지 마라. 이유: 두 step으로 나눈 목적이 상태 전이 규칙을 한 곳(리듀서)에만 두기 위함이다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/features/onboarding/`에만 파일을 추가했는가?
   - 모든 상태 갱신이 `onboardingReducer`를 거치는가(리듀서를 우회해 직접 상태를 조립하지 않았는가)?
   - `completed` 상태로 전이되는 모든 경로(1개 계정 자동완료 포함)에서 `selectedAccountId`가 먼저 storage에 저장됐는가?
3. `src/features/onboarding/__tests__/store.test.ts`에 테스트를 먼저 작성한 뒤(TDD) 구현하라. `src/nexon/client`와 `src/storage/api-key`는 `vi.mock`으로 모킹하라. 최소한 다음을 검증하라:
   - `restoreFromStorage()`: 저장된 게 없으면 상태 변화 없음. `selectedAccountId`까지 있으면 즉시 `completed`. `apiKey`만 있으면 `fetchCharacterList`를 다시 호출해 재개한다.
   - `submitApiKey()`: 계정이 1개면 `setSelectedAccountId`까지 자동으로 호출되고 `completed`가 된다. 계정이 2개 이상이면 `selectingAccount`가 되고 `setSelectedAccountId`는 호출되지 않는다.
   - `submitApiKey()`가 `NexonAuthError`/`NexonRateLimitError`/그 외 에러를 만나면 각각 올바른 `OnboardingError.kind`로 `error` 상태가 된다.
   - 계정 1개 자동완료 시 `setSelectedAccountId`가 실패하면 `completed`가 되지 않고 `error`(`storageWriteFailed`) 상태가 된다.
   - `selectAccount()`가 저장 실패 시 `completed`로 넘어가지 않고 `error`(`storageWriteFailed`) 상태가 된다.
   - `reset()`이 `clearAuthConfig`를 호출하고 상태를 `initialOnboardingState`로 되돌린다.
4. 결과에 따라 `phases/onboarding/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일과 핵심 메서드를 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `onboardingReducer`를 거치지 않고 Zustand `set`으로 상태 필드를 직접 조립하지 마라. 이유: 리듀서를 우회하면 상태 전이 규칙이 두 곳에 흩어져 `onboarding-state` step으로 분리한 의미가 없어진다.
- 계정이 1개뿐이라 자동 완료되는 경로에서 `setSelectedAccountId` 저장을 생략하지 마라. 이유: 그러면 다음 앱 재시작 시 `restoreFromStorage`가 `selectedAccountId` 없음을 보고 불필요하게 API를 재호출하게 된다.
- `app/` 디렉토리에 화면 컴포넌트를 만들지 마라. 이유: 화면은 별도 task다.
- 기존 테스트를 깨뜨리지 마라.
