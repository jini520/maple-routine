# Step 3: settings-store

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`의 "[설정 화면 — ...]" 데이터 흐름 블록 전체
- `src/features/onboarding/store.ts` (이번 step이 강하게 참고할 파일 — `fetchCharacterList`/`setApiKey`/`setSelectedAccountId`/`prefetchAccountData`를 조합하는 방식을 그대로 재사용한다. 단, 아래 "작업"에 적힌 대로 이 스토어는 전역 라우팅 상태를 바꾸지 않는다는 점이 결정적으로 다르다)
- `src/features/onboarding/prefetch.ts` (그대로 재사용할 `prefetchAccountData(apiKey, characters, onProgress)`)
- `src/features/settings/state.ts` (이전 step에서 만든 `settingsReducer`/`SettingsState`/`SettingsEvent`)
- `src/storage/api-key.ts` (`getAuthConfig`/`setApiKey`/`setSelectedAccountId`/`clearAuthConfig` — 전부 그대로 재사용, 새 storage 함수는 만들지 않는다)
- `src/nexon/character/index.ts`, `src/nexon/errors.ts` (`fetchCharacterList`, `NexonAuthError`/`NexonRateLimitError`)

## 배경

설정 화면에서 하는 두 가지 "계정 목록을 가져오는" 동작은 트리거만 다르다:
- **API 키 재입력**: 사용자가 새로 입력한 키로 `fetchCharacterList`를 호출하고, 성공하면 `setApiKey`로 저장한다.
- **계정 변경**: 키 재입력 없이, `getAuthConfig()`로 이미 저장된 키를 읽어 그 키로 `fetchCharacterList`를 다시 호출한다. `setApiKey`는 호출하지 않는다(키가 안 바뀌었으므로).

두 경우 모두 그 다음(계정이 1개면 자동 확정+예열, 2개 이상이면 선택 대기 → 선택 시 예열)은 완전히 동일한 흐름이다.

**결정적으로 중요한 제약**: `AppShell`(`src/App.tsx`)은 `useOnboardingStore().status === 'completed'` 여부로 전체 라우팅을 온보딩 화면으로 되돌릴지 결정한다. 설정 화면에서 API 키를 바꾸거나 계정을 바꾸는 동안 이 값을 건드리면, 사용자가 설정 화면에 있는 도중 앱 전체가 온보딩 화면으로 튕겨나간다 — 이건 명백히 잘못된 동작이다. 그래서 이 스토어는 `useOnboardingStore`의 상태를 절대 직접 변경하지 않는다(딱 하나, "연결 해제" 시 의도적으로 되돌려야 하는 예외는 아래 `disconnect()` 참고).

## 작업

`src/features/settings/store.ts` (신규, Zustand)를 작성하라.

```ts
export interface SettingsStore extends SettingsState {
  changeApiKey(apiKey: string): Promise<void>
  refreshAccounts(): Promise<void>
  selectAccount(accountId: string): Promise<void>
  disconnect(): Promise<void>
  reset(): void
}

export const useSettingsStore = create<SettingsStore>()((set, get) => ({ /* ... */ }))
```

### `changeApiKey(apiKey)`

1. `VERIFY_START` 디스패치
2. `fetchCharacterList(apiKey)` 호출 — 실패 시 에러를 `SettingsError`로 매핑해(`NexonAuthError` → `invalidApiKey`, `NexonRateLimitError` → `rateLimited`, 그 외 → `network`) `VERIFY_FAILED` 디스패치 후 종료. **이 매핑 함수는 `onboarding/store.ts`의 `toOnboardingError`를 import해서 재사용하지 말고, `settings/store.ts` 안에 똑같은 3줄짜리 헬퍼를 새로 작성하라** — 두 feature가 서로의 내부 구현을 참조하게 만들지 않기 위함(아래 "금지사항" 참고).
3. 성공하면 `setApiKey(apiKey)` 호출 (실패 시 `VERIFY_FAILED`에 `{ kind: 'storageWriteFailed' }`로 디스패치 후 종료)
4. `finalizeAccounts(accounts, apiKey)` 호출(아래 공용 헬퍼, `refreshAccounts`와 공유)

### `refreshAccounts()`

1. `getAuthConfig()`로 저장된 키를 읽는다. `null`이면(이론상 설정 화면은 이미 연결된 상태에서만 진입 가능하므로 일어나지 않아야 하지만) `VERIFY_FAILED`에 `{ kind: 'network' }`로 디스패치하고 종료.
2. `VERIFY_START` 디스패치
3. `fetchCharacterList(apiKey)` 호출 — 실패 처리는 `changeApiKey`와 동일(`setApiKey` 호출은 하지 않는다)
4. 성공하면 `finalizeAccounts(accounts, apiKey)` 호출

### 공용 내부 헬퍼 `finalizeAccounts(accounts, apiKey)`

- `ACCOUNTS_VERIFIED` 디스패치(reducer가 1개/2개 이상 분기를 처리한다)
- 디스패치 후 `get().status === 'prefetching'`이면(계정이 1개였던 경우), **먼저 `setSelectedAccountId(accounts[0].accountId)`를 호출**하고 나서 `runPrefetch(apiKey, accounts[0].characters)`를 실행한다(아래 `runPrefetch`는 `selectAccount`와도 공유).

### `selectAccount(accountId)`

1. `setSelectedAccountId(accountId)` 호출 — 실패 시 `ACCOUNT_SELECTION_FAILED`에 `{ kind: 'storageWriteFailed' }`로 디스패치 후 종료.
2. `SELECT_ACCOUNT` 디스패치
3. `get().accounts`에서 `accountId`로 계정을 찾고, `getAuthConfig()`로 apiKey를 다시 읽어 `runPrefetch(apiKey, account.characters)` 실행

### 공용 내부 헬퍼 `runPrefetch(apiKey, characters)`

- `prefetchAccountData(apiKey, characters, onProgress)`를 호출하며 `onProgress`에서 `PREFETCH_PROGRESS` 디스패치
- 끝나면 `PREFETCH_FINISHED` 디스패치

### `disconnect()`

```ts
async disconnect() {
  await useOnboardingStore.getState().reset()
}
```

- `useOnboardingStore.getState().reset()`이 이미 `clearAuthConfig()` 호출과 `RESET` 이벤트 디스패치(→ `status: 'awaitingApiKey'`)를 전부 처리한다 — 이 함수를 호출하는 것 외에 `disconnect()`가 직접 할 일은 없다.
- **이 함수 안에서만** `src/features/onboarding/store.ts`를 import한다. `changeApiKey`/`refreshAccounts`/`selectAccount`는 절대 `useOnboardingStore`를 참조하지 않는다(위 "배경" 참고).

### `reset()`

- 동기 함수. `set(initialSettingsState)`만 한다 — `error` 상태에서 사용자가 "다시 시도"를 누르기 전에 화면을 초기 상태로 되돌리는 용도(비동기 작업 없음, storage 접근 없음).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `changeApiKey`/`refreshAccounts`/`selectAccount`/`finalizeAccounts`/`runPrefetch` 어디에도 `useOnboardingStore`를 import하지 않았는가(오직 `disconnect()`만 예외)?
   - `nexon/`·`storage/` 어댑터를 거치지 않고 `@capacitor/preferences`나 `fetch`를 직접 호출하지 않았는가?
3. `src/features/settings/__tests__/store.test.ts`(신규)에 `src/features/onboarding/__tests__/store.test.ts`와 유사하게 `nexon/character`·`storage/api-key`·`features/onboarding/prefetch`를 모킹해 다음을 검증한다:
   - `changeApiKey`: 성공 시 `setApiKey` 호출 여부, 계정 1개면 자동으로 `prefetching`까지 진행, 계정 2개면 `selectingAccount`에서 멈추는지, 각 에러 타입(401/429/네트워크)이 올바른 `SettingsError.kind`로 매핑되는지
   - `refreshAccounts`: `setApiKey`가 호출되지 **않는지**(계정 변경은 키를 바꾸지 않으므로), 나머지는 `changeApiKey`와 동일하게 동작하는지
   - `selectAccount`: `setSelectedAccountId` 호출 후 예열이 진행되는지
   - `disconnect`: `useOnboardingStore.getState().reset`이 정확히 1번 호출되는지(모킹으로 검증), 그 외 `settingsStore` 상태는 이 테스트에서 직접 검증할 필요 없음(reset의 내부 동작은 onboarding 쪽 테스트가 이미 검증함)
4. 결과에 따라 `phases/settings/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `disconnect()` 이외의 함수에서 `features/onboarding`의 어떤 것도 import하지 마라. 이유: 설정 화면의 계정/키 변경 작업이 전역 라우팅 상태(`useOnboardingStore().status`)를 건드리면 사용자가 설정 화면에 있는 도중 온보딩 화면으로 튕겨나간다.
- `onboarding/store.ts`의 `toOnboardingError`를 import해서 재사용하지 마라 — 같은 모양의 작은 헬퍼를 이 파일 안에 새로 작성하라(두 feature 간 직접 참조를 만들지 않기 위함).
- `storage/theme.ts`를 이 step에서 건드리지 마라(테마는 별도 스토어, Step 1에서 이미 완료).
- 기존 `features/onboarding/store.ts`의 동작이나 시그니처를 바꾸지 마라.
- 기존 테스트를 깨뜨리지 마라.
